import { ArrowLeft, Pencil, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AccountSummary from '@/components/customers/AccountSummary'
import ArticlesTable from '@/components/customers/ArticlesTable'
import CustomerForm from '@/components/customers/CustomerForm'
import RemitoSheet from '@/components/customers/RemitoSheet'
import { Button } from '@/components/ui/button'
import { listCustomerAccounts } from '@/services/accounts/account.service'
import { getCustomer } from '@/services/customers/customer.service'
import { listCustomerCashSales } from '@/services/sales/sale.service'
import type { CreditAccount } from '@/types/account.types'
import type { Customer } from '@/types/customer.types'
import type { Sale } from '@/types/sale.types'
import { describeError } from '@/utils/errors'
import { peso } from '@/utils/format'

type Loaded = { customer: Customer; accounts: CreditAccount[]; cashSales: Sale[] }

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Ficha de un cliente, con el formato de la ficha formal (el remito): sus datos, los artículos con precio y total,
// los pagos y el saldo. Se puede imprimir. Reemplaza a la pantalla de Cuentas corrientes (D22).
export default function CustomerFichaPage() {
  const { id } = useParams()
  const customerId = Number(id)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null) // confirmación de un pago o de recargos aplicados
  const [editing, setEditing] = useState(false)
  const [reload, setReload] = useState(0)
  // Fecha que lleva el remito (la de hoy, al abrir la ficha).
  const [today] = useState(() => {
    const now = new Date()
    return { day: String(now.getDate()).padStart(2, '0'), month: String(now.getMonth() + 1).padStart(2, '0'), year: String(now.getFullYear()) }
  })

  useEffect(() => {
    let ignore = false
    Promise.all([getCustomer(customerId), listCustomerAccounts(customerId), listCustomerCashSales(customerId)])
      .then(([customer, accounts, cashSales]) => {
        if (!ignore) {
          setData({ customer, accounts, cashSales })
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
  if (!data) return <p className="text-muted-foreground">Cargando…</p>

  const { customer, accounts, cashSales } = data
  const open = accounts.find((account) => account.status === 'OPEN')
  const cancelled = accounts.filter((account) => account.status === 'CANCELLED')
  const annulled = open?.sales.filter((sale) => sale.status === 'ANNULLED') ?? []

  return (
    <section className="grid gap-5">
      <div>
        {back}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold print:hidden">{customer.name}</h2>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={() => setEditing(true)} disabled={editing}>
              <Pencil />
              Editar datos
            </Button>
            <Button onClick={() => window.print()}>
              <Printer />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="print:hidden">
          <CustomerForm
            customer={customer}
            onSaved={() => {
              setEditing(false)
              setReload((n) => n + 1)
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800 print:hidden">
          {notice}
        </p>
      )}

      {/* Datos que el remito no tiene: solo en pantalla. */}
      <dl className="grid gap-x-6 gap-y-1 rounded-md border border-border bg-white p-4 text-sm sm:grid-cols-2 print:hidden">
        <Field label="DNI" value={customer.dni} />
        <Field label="Teléfono" value={customer.phone} />
        <Field label="Crédito" value={customer.creditAuthorized ? 'Autorizado a comprar a cuenta corriente' : 'Solo contado'} />
        <Field label="Estado" value={customer.active ? 'Activo' : 'De baja'} />
        {customer.notes && <Field label="Observaciones" value={customer.notes} />}
      </dl>

      {!open && (
        <p className="text-sm text-muted-foreground print:hidden">
          {customer.creditAuthorized
            ? 'No tiene una ficha abierta. Se abre con la primera venta a crédito.'
            : 'No tiene una ficha abierta. El cliente no está autorizado a comprar a crédito.'}
        </p>
      )}

      {/* La ficha formal: el remito "X" con los artículos de la cuenta corriente abierta. */}
      <RemitoSheet
        customerName={customer.name}
        address={customer.address}
        sales={open?.sales ?? []}
        condition={open ? 'CURRENT_ACCOUNT' : null}
        date={today}
      />

      {annulled.length > 0 && (
        <p className="text-sm text-muted-foreground print:hidden">
          Ventas anuladas (no figuran en el remito):{' '}
          {annulled.map((sale) => `#${sale.id} del ${day.format(new Date(sale.createdAt))} por ${peso.format(Number(sale.total))}`).join(' · ')}
        </p>
      )}

      {open && (
        <section>
          <h3 className="mb-2 text-lg font-semibold">Estado de la cuenta</h3>
          <AccountSummary
            account={open}
            onChanged={(message) => {
              setNotice(message)
              setReload((n) => n + 1)
            }}
          />
        </section>
      )}

      {cashSales.length > 0 && (
        <details className="rounded-md border border-border bg-white p-3 print:hidden">
          <summary className="cursor-pointer text-sm font-semibold">Compras de contado ({cashSales.length})</summary>
          <div className="mt-3">
            <ArticlesTable sales={cashSales} totalLabel="Total de las compras de contado" />
          </div>
        </details>
      )}

      {cancelled.length > 0 && (
        <section className="print:hidden">
          <h3 className="mb-2 text-lg font-semibold">Historial de fichas canceladas</h3>
          <div className="grid gap-2">
            {cancelled.map((account) => (
              <details key={account.id} className="rounded-md border border-border bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Ficha del {day.format(new Date(account.openedAt))} al {day.format(new Date(account.closedAt ?? account.dueDate))}
                </summary>
                <div className="mt-3">
                  <ArticlesTable sales={account.sales} totalLabel="Total de las ventas" />
                  <div className="mt-3">
                    <AccountSummary account={account} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground print:text-black">{label}:</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  )
}
