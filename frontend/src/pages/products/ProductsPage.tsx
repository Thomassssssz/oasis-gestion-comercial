import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { listCategories } from '@/services/categories/category.service'
import { listProducts, updateProduct } from '@/services/products/product.service'
import type { Category } from '@/types/category.types'
import type { Product, ProductFilters } from '@/types/product.types'
import { describeError } from '@/utils/errors'
import ProductForm from '@/components/products/ProductForm'

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export default function ProductsPage() {
  const [filters, setFilters] = useState<ProductFilters>({ search: '', categoryId: '', status: 'active', lowStockOnly: false })
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  // null = formulario cerrado, 'new' = producto nuevo, o el producto que se está editando.
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [reload, setReload] = useState(0)

  // Las categorías se piden una vez: sirven para el filtro y para el formulario.
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((e) => setError(describeError(e)))
  }, [])

  // La lista se vuelve a pedir cuando cambian los filtros o hay que recargar.
  useEffect(() => {
    let ignore = false
    listProducts(filters)
      .then((list) => {
        if (!ignore) {
          setProducts(list)
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

  async function toggleActive(product: Product) {
    try {
      await updateProduct(product.id, {
        name: product.name,
        categoryId: product.categoryId,
        salePrice: product.salePrice,
        minStock: product.minStock,
        active: !product.active,
      })
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
        <h2 className="text-xl font-semibold">Productos</h2>
        <Button onClick={() => setEditing('new')} disabled={editing !== null}>
          <Plus />
          Nuevo producto
        </Button>
      </div>

      {editing !== null && (
        <ProductForm
          // La clave hace que el formulario empiece de cero al cambiar de producto.
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          categories={categories}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mb-4 grid items-center gap-2 sm:grid-cols-4">
        <SearchInput
          label="Buscar producto"
          placeholder="Buscar por nombre"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          aria-label="Filtrar por categoría"
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as ProductFilters['status'] })}
        >
          <option value="active">Activos</option>
          <option value="inactive">Dados de baja</option>
          <option value="all">Todos</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.lowStockOnly}
            onChange={(e) => setFilters({ ...filters, lowStockOnly: e.target.checked })}
          />
          Solo con stock bajo
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {products === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {products?.length === 0 && <p className="text-muted-foreground">No hay productos que coincidan.</p>}

      {products && products.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Stock</th>
                <th className="px-3 py-2 text-right font-medium">Stock mín.</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">{product.name}</td>
                  <td className="px-3 py-2">{product.category.name}</td>
                  <td className="px-3 py-2 text-right">{peso.format(Number(product.salePrice))}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {product.lowStock && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Stock bajo
                        </span>
                      )}
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{product.minStock}</td>
                  <td className="px-3 py-2">{product.active ? 'Activo' : 'De baja'}</td>
                  <td className="px-3 py-2">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Editar ${product.name}`}
                        onClick={() => setEditing(product)}
                      >
                        <Pencil />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(product)}>
                        {product.active ? 'Dar de baja' : 'Reactivar'}
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
