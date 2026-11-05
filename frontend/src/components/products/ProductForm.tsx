import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createProduct, updateProduct } from '@/services/products/product.service'
import type { Category } from '@/types/category.types'
import type { Product } from '@/types/product.types'
import { describeError } from '@/utils/errors'

type Props = {
  product: Product | null // null = producto nuevo
  categories: Category[]
  onSaved: () => void
  onCancel: () => void
}

export default function ProductForm({ product, categories, onSaved, onCancel }: Props) {
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product ? String(product.categoryId) : '')
  const [salePrice, setSalePrice] = useState(product?.salePrice ?? '')
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 0))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    const data = {
      name,
      categoryId: Number(categoryId),
      // En Argentina se escribe la coma decimal ("1500,50"): se pasa a punto para la API.
      salePrice: salePrice.trim().replace(',', '.'),
      minStock: Number(minStock),
    }

    try {
      if (product) await updateProduct(product.id, { ...data, active: product.active })
      else await createProduct(data)
      onSaved()
    } catch (e) {
      setError(describeError(e))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-md border border-border bg-white p-4 sm:grid-cols-2">
      <h3 className="text-lg font-semibold sm:col-span-2">{product ? 'Editar producto' : 'Nuevo producto'}</h3>

      <label className="grid gap-1 text-sm sm:col-span-2">
        Nombre
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        Categoría
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Elegí una categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="grid gap-1 text-sm">
        Precio de venta
        <Input inputMode="decimal" placeholder="0,00" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        Stock mínimo
        <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
