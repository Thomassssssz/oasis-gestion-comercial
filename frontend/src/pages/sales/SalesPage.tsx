import { useEffect, useState, type FormEvent } from 'react'
import SaleForm from '@/components/sales/SaleForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { listCustomers } from '@/services/customers/customer.service'
import { listProducts } from '@/services/products/product.service'
import { annulSale, listSales } from '@/services/sales/sale.service'
import type { Customer } from '@/types/customer.types'
import type { Product } from '@/types/product.types'
import type { Sale, SaleFilters } from '@/types/sale.types'
import { describeError } from '@/utils/errors'
import { dateTime, peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

// Ventas: venta rápida o completa arriba e historial abajo, con la anulación de ventas (D3, D13).
export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[] | null>(null)
  const [filters, setFilters] = useState<SaleFilters>({ status: '' })
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  // Venta que se está por anular (muestra el campo del motivo), su motivo y el error de la anulación.
  const [annulling, setAnnulling] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [annulError, setAnnulError] = useState<string | null>(null)

  // Se vuelven a pedir los productos al registrar o anular una venta, porque cambia el stock.
  useEffect(() => {
    let ignore = false
    listProducts({ search: '', categoryId: '', status: 'active', lowStockOnly: false })
      .then((list) => {
        if (!ignore) setProducts(list)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [reload])

  // Los clientes activos para la venta completa (se piden una sola vez).
  useEffect(() => {
    let ignore = false
    listCustomers({ search: '', status: 'active', credit: 'all' })
      .then((list) => {
        if (!ignore) setCustomers(list)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    listSales(filters)
      .then((list) => {
        if (!ignore) {
          setSales(list)
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

  function startAnnulling(id: number) {
    setAnnulling(id)
    setReason('')
    setAnnulError(null)
  }

  async function handleAnnul(event: FormEvent, id: number) {
    event.preventDefault()
    setAnnulError(null)
    try {
      await annulSale(id, reason)
      setAnnulling(null)
      setReload((n) => n + 1)
    } catch (e) {
      setAnnulError(describeError(e))
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Ventas</h2>

      <SaleForm products={products} customers={customers} onSaved={() => setReload((n) => n + 1)} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Historial</h3>
        <Select
          aria-label="Filtrar por estado"
          className="max-w-48"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as SaleFilters['status'] })}
        >
          <option value="">Todas</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="ANNULLED">Anuladas</option>
        </Select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {sales === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {sales?.length === 0 && <p className="text-muted-foreground">Todavía no hay ventas.</p>}

      {sales && sales.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">N.º</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Productos</th>
                <th className="px-3 py-2 font-medium">Pago</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Registró</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.map((sale) => (
                <tr key={sale.id} className={sale.status === 'ANNULLED' ? 'text-muted-foreground' : undefined}>
                  <td className="px-3 py-2">#{sale.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">{dateTime.format(new Date(sale.createdAt))}</td>
                  <td className="px-3 py-2">{sale.customer?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    {sale.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ')}
                    {sale.note && <span className="mt-1 block text-xs text-muted-foreground">Nota: {sale.note}</span>}
                  </td>
                  <td className="px-3 py-2">{sale.paymentMethod ? paymentMethodLabels[sale.paymentMethod] : 'A crédito'}</td>
                  <td className={`px-3 py-2 text-right ${sale.status === 'ANNULLED' ? 'line-through' : ''}`}>
                    {peso.format(Number(sale.total))}
                    {Number(sale.discount) > 0 && (
                      <span className="block text-xs text-muted-foreground no-underline">
                        desc. {peso.format(Number(sale.discount))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {sale.status === 'CONFIRMED' ? (
                      'Confirmada'
                    ) : (
                      <span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Anulada</span>
                        {sale.annulment && (
                          <span className="mt-1 block text-xs">
                            {sale.annulment.reason} ({sale.annulment.byName ?? 'usuario eliminado'},{' '}
                            {dateTime.format(new Date(sale.annulment.at))})
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{sale.userName}</td>
                  <td className="px-3 py-2 text-right">
                    {sale.status === 'CONFIRMED' && annulling !== sale.id && (
                      <Button size="sm" variant="outline" aria-label={`Anular venta ${sale.id}`} onClick={() => startAnnulling(sale.id)}>
                        Anular
                      </Button>
                    )}
                    {annulling === sale.id && (
                      <form onSubmit={(e) => void handleAnnul(e, sale.id)} className="flex flex-wrap items-center justify-end gap-2">
                        <Input
                          aria-label="Motivo de la anulación"
                          placeholder="Motivo de la anulación"
                          className="w-56"
                          maxLength={500}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <Button type="submit" size="sm">
                          Confirmar anulación
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setAnnulling(null)}>
                          Cancelar
                        </Button>
                        {annulError && (
                          <span role="alert" className="w-full text-left text-xs text-red-700">
                            {annulError}
                          </span>
                        )}
                      </form>
                    )}
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
