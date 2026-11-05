import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import MovementForm from '@/components/inventory/MovementForm'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { listProducts } from '@/services/products/product.service'
import { listMovements } from '@/services/stock-movements/stock-movement.service'
import type { Product } from '@/types/product.types'
import type { StockMovement } from '@/types/stock-movement.types'
import { describeError } from '@/utils/errors'
import { filterByName } from '@/utils/search'
import { adjustmentReasonLabels, movementTypeLabels } from '@/utils/stock-labels'

const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

// Inventario: historial de movimientos de stock y alta de stock inicial o ajustes.
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[] | null>(null)
  // '' = movimientos de todos los productos.
  const [productFilter, setProductFilter] = useState('')
  const [productSearch, setProductSearch] = useState('') // lo que se escribe en la lupa para encontrar el producto
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  // Los productos (activos y dados de baja) sirven para el filtro y para el formulario.
  // Se vuelven a pedir al registrar un movimiento, porque cambia el stock que muestra el formulario.
  useEffect(() => {
    let ignore = false
    listProducts({ search: '', categoryId: '', status: 'all', lowStockOnly: false })
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

  useEffect(() => {
    let ignore = false
    listMovements(productFilter ? Number(productFilter) : undefined)
      .then((list) => {
        if (!ignore) {
          setMovements(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [productFilter, reload])

  function handleSaved() {
    setCreating(false)
    setReload((n) => n + 1)
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Inventario</h2>
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus />
          Nuevo movimiento
        </Button>
      </div>

      {creating && <MovementForm products={products} onSaved={handleSaved} onCancel={() => setCreating(false)} />}

      <div className="mb-4 grid max-w-2xl gap-2 sm:grid-cols-2">
        <SearchInput label="Buscar producto por nombre" placeholder="Buscar producto por nombre" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
        <Select aria-label="Filtrar por producto" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="">Todos los productos</option>
          {filterByName(products, productSearch, productFilter ? Number(productFilter) : null).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {movements === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {movements?.length === 0 && <p className="text-muted-foreground">Todavía no hay movimientos de stock.</p>}

      {movements && movements.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Motivo</th>
                <th className="px-3 py-2 font-medium">Nota</th>
                <th className="px-3 py-2 font-medium">Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="whitespace-nowrap px-3 py-2">{dateTime.format(new Date(movement.createdAt))}</td>
                  <td className="px-3 py-2">{movement.productName}</td>
                  <td className="px-3 py-2">{movementTypeLabels[movement.type]}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${movement.quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}
                  >
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                  </td>
                  <td className="px-3 py-2">{movement.reason ? adjustmentReasonLabels[movement.reason] : '—'}</td>
                  <td className="px-3 py-2">{movement.note ?? '—'}</td>
                  <td className="px-3 py-2">{movement.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
