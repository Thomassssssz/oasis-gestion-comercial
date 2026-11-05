import { ArrowLeft, Pencil, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AccountSheet from '@/components/customers/AccountSheet'
import ArticlesTable from '@/components/customers/ArticlesTable'
import CustomerForm from '@/components/customers/CustomerForm'
import { Button } from '@/components/ui/button'
import { listCustomerAccounts } from '@/services/accounts/account.service'
import { getCustomer } from '@/services/customers/customer.service'
import { listCustomerCashSales } from '@/services/sales/sale.service'
import type { CreditAccount } from '@/types/account.types'
import type { Customer } from '@/types/customer.types'
import type { Sale } from '@/types/sale.types'
import { describeError } from '@/utils/errors'

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
  const [printedOn] = useState(() => day.format(new Date())) // fecha que sale en el encabezado impreso

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

  return (
    <section className="grid gap-5">
      <div>
        {back}
        {/* Encabezado que solo sale en papel. No es una factura: el sistema no factura (fuera de alcance). */}
        <div className="mb-4 hidden border-b border-black pb-2 print:block">
          <p className="text-lg font-bold">Librería Oasis</p>
          <p className="text-sm">Ficha de cliente · Documento no válido como factura · {printedOn}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{customer.name}</h2>
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

      <dl className="grid gap-x-6 gap-y-1 rounded-md border border-border bg-white p-4 text-sm sm:grid-cols-2 print:border-black">
        <Field label="Señor/es" value={customer.name} />
        <Field label="DNI" value={customer.dni} />
        <Field label="Domicilio" value={customer.address} />
        <Field label="Teléfono" value={customer.phone} />
        <Field label="Condiciones de venta" value={customer.creditAuthorized ? 'Contado o cuenta corriente' : 'Contado'} />
        <Field label="Estado" value={customer.active ? 'Activo' : 'De baja'} />
        {customer.notes && <Field label="Observaciones" value={customer.notes} />}
      </dl>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Ficha de cuenta corriente</h3>
        {open ? (
          <AccountSheet
            account={open}
            onChanged={(message) => {
              setNotice(message)
              setReload((n) => n + 1)
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {customer.creditAuthorized
              ? 'No tiene una ficha abierta. Se abre con la primera venta a crédito.'
              : 'No tiene una ficha abierta. El cliente no está autorizado a comprar a crédito.'}
          </p>
        )}
        <p className="mt-6 hidden text-sm print:block">Recibí conforme: ______________________________</p>
      </section>

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
                  <AccountSheet account={account} />
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
