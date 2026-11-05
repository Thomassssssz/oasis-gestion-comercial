import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AccountActions from '@/components/accounts/AccountActions'
import RemitoSheet from '@/components/customers/RemitoSheet'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { listCustomerAccounts, updateAccountRemito } from '@/services/accounts/account.service'
import { customerData, getCustomer, updateCustomer } from '@/services/customers/customer.service'
import { getBusinessSettings, updateBusinessSettings } from '@/services/settings/setting.service'
import type { CreditAccount } from '@/types/account.types'
import type { Customer } from '@/types/customer.types'
import type { BusinessSettings } from '@/types/setting.types'
import { describeError } from '@/utils/errors'
import {
  ACCOUNT_KEYS,
  BUSINESS_KEYS,
  buildRemito,
  CUSTOMER_KEYS,
  isTaxCondition,
  normalizeValue,
  serverValues,
  type FieldKey,
  type RemitoValues,
} from '@/utils/remito'

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Día, mes y año como los casilleros de la fecha del remito.
const dateParts = (d: Date) => ({ day: String(d.getDate()).padStart(2, '0'), month: String(d.getMonth() + 1).padStart(2, '0'), year: String(d.getFullYear()) })

type Loaded = { customer: Customer; accounts: CreditAccount[]; business: BusinessSettings }
type Edits = Partial<Record<FieldKey, string>> // lo escrito en el remito que todavía no se guardó

// Ficha de un cliente: el remito "X" del comercio, y nada más. Cada dato del remito se toca y se edita;
// lo cambiado se guarda con la barra "Guardar cambios" (D22, D23). Se puede imprimir.
export default function CustomerFichaPage() {
  const { id } = useParams()
  const customerId = Number(id)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null) // confirmación de un guardado, un pago o recargos aplicados
  const [edits, setEdits] = useState<Edits>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null) // ficha elegida a mano; null = la abierta o, si no hay, la última pagada
  const [reload, setReload] = useState(0)
  // Sin ficha, la fecha del remito es la de hoy y se puede cambiar (no se guarda: la hoja de papel la lleva a mano).
  // Con ficha, es el día en que se abrió y no se cambia (ver `remitoDate`).
  const [date, setDate] = useState(() => dateParts(new Date()))

  useEffect(() => {
    let ignore = false
    Promise.all([getCustomer(customerId), listCustomerAccounts(customerId), getBusinessSettings()])
      .then(([customer, accounts, business]) => {
        if (!ignore) {
          setData({ customer, accounts, business })
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [customerId, reload])

  // Las fichas del cliente: la pendiente primero y después las pagadas, la última pagada arriba.
  const accounts = useMemo(
    () =>
      [...(data?.accounts ?? [])].sort(
        (a, b) =>
          Number(b.status === 'OPEN') - Number(a.status === 'OPEN') || new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime() || b.id - a.id,
      ),
    [data],
  )
  const account = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null
  const saved = useMemo(() => (data ? serverValues(data.customer, account, data.business) : null), [data, account])
  const values = useMemo(() => (saved ? ({ ...saved, ...edits } as RemitoValues) : null), [saved, edits])
  // Un campo está "cambiado" si lo escrito es distinto de lo guardado (sin contar espacios sobrantes ni guiones del CUIT).
  // Los números del remito pertenecen a la ficha que se está viendo; si se cambia de ficha, lo escrito ahí se descarta.
  const changed = useMemo(() => {
    const keys = new Set<FieldKey>()
    if (saved) {
      for (const key of Object.keys(edits) as FieldKey[]) {
        if (normalizeValue(key, edits[key] ?? '') !== normalizeValue(key, saved[key])) keys.add(key)
      }
    }
    return keys
  }, [saved, edits])

  const back = (
    <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline print:hidden">
      <ArrowLeft className="size-4" />
      Volver a Clientes
    </Link>
  )

  if (error) {
    return (
      <section>
        {back}
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      </section>
    )
  }
  if (!data || !values) return <p className="text-muted-foreground">Cargando…</p>

  const { customer, business } = data
  const remito = buildRemito(account)
  const paid = account?.status === 'CANCELLED'

  function setField(key: FieldKey, value: string) {
    setNotice(null)
    setEdits((previous) => ({ ...previous, [key]: value }))
  }

  const anyChanged = (keys: readonly FieldKey[]) => keys.some((key) => changed.has(key))
  const clean = (key: FieldKey) => normalizeValue(key, values![key])

  // Guarda cada grupo de datos que cambió en su lugar: el cliente, la ficha y el comercio. Si uno falla, los demás igual se guardan
  // y el error dice cuál no se pudo; lo que no se guardó sigue escrito en el remito para corregirlo.
  async function save() {
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    const done: FieldKey[] = []
    const failures: string[] = []

    if (anyChanged(CUSTOMER_KEYS)) {
      try {
        await updateCustomer(
          customer.id,
          customerData(customer, {
            name: clean('customerName'),
            address: clean('address'),
            locality: clean('locality'),
            taxCondition: isTaxCondition(values!.taxCondition) ? values!.taxCondition : null,
            cuit: clean('cuit'),
          }),
        )
        done.push(...CUSTOMER_KEYS)
      } catch (e) {
        failures.push(`Datos del cliente: ${describeError(e)}`)
      }
    }
    if (account && anyChanged(ACCOUNT_KEYS)) {
      try {
        await updateAccountRemito(account.id, { number: clean('number'), remitoNumber: clean('remitoNumber') })
        done.push(...ACCOUNT_KEYS)
      } catch (e) {
        failures.push(`Números del remito: ${describeError(e)}`)
      }
    }
    if (anyChanged(BUSINESS_KEYS)) {
      try {
        await updateBusinessSettings({
          name: clean('bizName'),
          owner: clean('bizOwner'),
          address: clean('bizAddress'),
          taxCondition: isTaxCondition(values!.bizTaxCondition) ? values!.bizTaxCondition : null,
          cuit: clean('bizCuit'),
          grossIncome: clean('bizGrossIncome'),
          activityStart: clean('bizActivityStart'),
        })
        done.push(...BUSINESS_KEYS)
      } catch (e) {
        failures.push(`Datos del comercio: ${describeError(e)}`)
      }
    }

    setEdits((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !done.includes(key as FieldKey))))
    if (failures.length > 0) setSaveError(failures.join(' · '))
    else setNotice('Cambios guardados')
    if (done.length > 0) setReload((n) => n + 1)
    setSaving(false)
  }

  function discard() {
    setEdits({})
    setSaveError(null)
  }

  return (
    <section className="grid gap-4">
      <div>
        {back}
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm text-muted-foreground">Tocá cualquier dato del remito para cambiarlo. Los artículos salen de las ventas.</p>
          <Button onClick={() => window.print()}>
            <Printer />
            Imprimir
          </Button>
        </div>
      </div>

      {changed.size > 0 && (
        <div
          role="group"
          aria-label="Cambios sin guardar"
          className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm print:hidden">
          <span>
            Tenés {changed.size} {changed.size === 1 ? 'cambio' : 'cambios'} sin guardar
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              Guardar cambios
            </Button>
            <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
              Descartar
            </Button>
          </span>
        </div>
      )}

      {saveError && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 print:hidden">
          {saveError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800 print:hidden">
          {notice}
        </p>
      )}

      {/* Si el cliente tiene más de una ficha (una pendiente y otras ya pagadas) se elige cuál ver. */}
      {accounts.length > 1 && account && (
        <label className="mx-auto flex w-full max-w-3xl items-center gap-2 text-sm print:hidden">
          Ficha
          <Select
            className="max-w-sm"
            value={String(account.id)}
            onChange={(e) => {
              // Los números del remito escritos y sin guardar eran de la ficha anterior: no se llevan a la otra.
              setEdits((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !(ACCOUNT_KEYS as readonly string[]).includes(key))))
              setSelectedId(Number(e.target.value))
              setShowPay(false)
            }}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.status === 'OPEN' ? 'Pendiente' : 'Pagada'} · desde {day.format(new Date(a.openedAt))}
                {a.status === 'CANCELLED' && a.closedAt ? ` hasta ${day.format(new Date(a.closedAt))}` : ''}
              </option>
            ))}
          </Select>
        </label>
      )}

      <RemitoSheet
        values={values}
        changed={changed}
        onChange={setField}
        accountFields={account !== null}
        condition={account ? 'CURRENT_ACCOUNT' : null}
        // La fecha es la del primer producto que se llevó el cliente: queda antes del vencimiento que figura al pie.
        date={account ? dateParts(new Date(account.openedAt)) : date}
        dateLocked={account !== null}
        onDateChange={(part, value) => setDate((previous) => ({ ...previous, [part]: value }))}
        remito={remito}
        dueDate={account?.dueDate ?? null}
        overdueMonths={account?.overdue ? account.monthsOverdue : null}
        paid={paid}
        closedAt={account?.closedAt ?? null}
        onPayClick={account && !paid ? () => setShowPay((open) => !open) : undefined}
      />

      {/* Se abre al tocar el pie del remito: registrar un pago y aplicar los recargos que ya corresponden (D18). */}
      {account && showPay && (
        <div className="mx-auto w-full max-w-3xl print:hidden">
          <AccountActions
            account={account}
            onChanged={(message) => {
              setNotice(message)
              setShowPay(false)
              setReload((n) => n + 1)
            }}
          />
        </div>
      )}

      {/* La empresa todavía no cargó sus datos: se avisa en pantalla para que se complete el encabezado. */}
      {!business.name && (
        <p className="text-center text-xs text-muted-foreground print:hidden">El encabezado del comercio está vacío: tocalo para completarlo (se guarda una sola vez).</p>
      )}
    </section>
  )
}
