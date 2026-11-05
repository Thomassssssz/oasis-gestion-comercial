import { Pencil, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CustomerForm from '@/components/customers/CustomerForm'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { listAccounts } from '@/services/accounts/account.service'
import { customerData, listCustomers, updateCustomer } from '@/services/customers/customer.service'
import type { CreditAccount } from '@/types/account.types'
import type { Customer, CustomerFilters } from '@/types/customer.types'
import { describeError } from '@/utils/errors'
import { peso } from '@/utils/format'

export default function CustomersPage() {
  const [filters, setFilters] = useState<CustomerFilters>({ search: '', status: 'active', credit: 'all', debt: 'all' })
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null = formulario cerrado, 'new' = cliente nuevo, o el cliente que se está editando.
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [reload, setReload] = useState(0)

  // Fichas pendientes: de ahí salen el saldo y el aviso de vencido de cada cliente. Hay una sola ficha abierta por cliente (D17).
  const [openAccounts, setOpenAccounts] = useState<Map<number, CreditAccount> | null>(null)

  // La lista se vuelve a pedir cuando cambian los filtros o hay que recargar.
  useEffect(() => {
    let ignore = false
    Promise.all([listCustomers(filters), listAccounts('OPEN')])
      .then(([list, accounts]) => {
        if (!ignore) {
          setCustomers(list)
          setOpenAccounts(new Map(accounts.map((account) => [account.customer.id, account])))
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [filters, reload])

  // "Con deuda" se filtra acá: la API de clientes no conoce las cuentas.
  const visible = useMemo(
    () => (customers && openAccounts && filters.debt === 'with-debt' ? customers.filter((c) => openAccounts.has(c.id)) : customers),
    [customers, openAccounts, filters.debt],
  )

  async function toggleActive(customer: Customer) {
    try {
      await updateCustomer(customer.id, customerData(customer, { active: !customer.active }))
      setReload((n) => n + 1)
    } catch (e) {
      setError(describeError(e))
    }
  }

  function handleSaved() {
    setEditing(null)
    setReload((n) => n + 1)
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <Button onClick={() => setEditing('new')} disabled={editing !== null}>
          <Plus />
          Nuevo cliente
        </Button>
      </div>

      {editing !== null && (
        <CustomerForm
          // La clave hace que el formulario empiece de cero al cambiar de cliente.
          key={editing === 'new' ? 'new' : editing.id}
          customer={editing === 'new' ? null : editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mb-4 grid items-center gap-2 sm:grid-cols-4">
        <SearchInput
          label="Buscar cliente"
          placeholder="Buscar por nombre, DNI o teléfono"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          aria-label="Filtrar por estado"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as CustomerFilters['status'] })}
        >
          <option value="active">Activos</option>
          <option value="inactive">Dados de baja</option>
          <option value="all">Todos</option>
        </Select>
        <Select
          aria-label="Filtrar por crédito"
          value={filters.credit}
          onChange={(e) => setFilters({ ...filters, credit: e.target.value as CustomerFilters['credit'] })}
        >
          <option value="all">Con o sin crédito</option>
          <option value="authorized">Con crédito autorizado</option>
          <option value="not-authorized">Sin crédito</option>
        </Select>
        <Select
          aria-label="Filtrar por deuda"
          value={filters.debt}
          onChange={(e) => setFilters({ ...filters, debt: e.target.value as CustomerFilters['debt'] })}
        >
          <option value="all">Con o sin deuda</option>
          <option value="with-debt">Con deuda</option>
        </Select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {customers === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {visible?.length === 0 && <p className="text-muted-foreground">No hay clientes que coincidan.</p>}

      {visible && visible.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">DNI</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2 font-medium">Crédito</th>
                <th className="px-3 py-2 text-right font-medium">Debe</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-3 py-2">
                    <Link to={`/clientes/${customer.id}`} className="font-medium text-primary hover:underline">
                      {customer.name}
                    </Link>
                    {customer.notes && <p className="text-xs text-muted-foreground">{customer.notes}</p>}
                  </td>
                  <td className="px-3 py-2">{customer.dni ?? '—'}</td>
                  <td className="px-3 py-2">{customer.phone ?? '—'}</td>
                  <td className="px-3 py-2">{customer.creditAuthorized ? 'Autorizado' : 'No'}</td>
                  <td className="px-3 py-2 text-right">
                    <Debt account={openAccounts?.get(customer.id)} />
                  </td>
                  <td className="px-3 py-2">{customer.active ? 'Activo' : 'De baja'}</td>
                  <td className="px-3 py-2">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Editar ${customer.name}`}
                        onClick={() => setEditing(customer)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${customer.active ? 'Dar de baja' : 'Reactivar'} a ${customer.name}`}
                        onClick={() => void toggleActive(customer)}
                      >
                        {customer.active ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Lo que debe el cliente hoy (saldo más recargos que ya corresponden), con el aviso de vencido. Sin ficha pendiente no debe nada.
function Debt({ account }: { account: CreditAccount | undefined }) {
  if (!account) return <span className="text-muted-foreground">—</span>
  return (
    <>
      {peso.format(Number(account.payable))}
      {account.overdue && (
        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Vencida</span>
      )}
    </>
  )
}

