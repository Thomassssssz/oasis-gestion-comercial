import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchPicker } from '@/components/ui/search-picker'
import { Select } from '@/components/ui/select'
import { registerMovement } from '@/services/stock-movements/stock-movement.service'
import type { Product } from '@/types/product.types'
import type { AdjustmentReason, MovementInput, RegistrableMovementType } from '@/types/stock-movement.types'
import { describeError } from '@/utils/errors'
import { filterByName } from '@/utils/search'
import { adjustmentReasonLabels, movementTypeLabels, registrableTypes } from '@/utils/stock-labels'

type Props = {
  products: Product[]
  onSaved: () => void
  onCancel: () => void
}

// Formulario para registrar un movimiento: la carga de stock inicial o un ajuste manual.
// Las reglas (cantidades válidas, stock que no puede quedar negativo...) las controla la API
// y sus mensajes se muestran tal cual.
export default function MovementForm({ products, onSaved, onCancel }: Props) {
  const [productId, setProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [type, setType] = useState<RegistrableMovementType>('INITIAL_STOCK')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<AdjustmentReason>('PHYSICAL_COUNT')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    const common = { productId: Number(productId), quantity: Number(quantity), note: note.trim() || undefined }
    const input: MovementInput =
      type === 'INITIAL_STOCK' ? { type, ...common } : { type, ...common, reason }

    try {
      await registerMovement(input)
      onSaved()
    } catch (e) {
      setError(describeError(e))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-md border border-border bg-white p-4 sm:grid-cols-2">
      <h3 className="text-lg font-semibold sm:col-span-2">Nuevo movimiento de stock</h3>

      <label className="grid gap-1 text-sm">
        Producto
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Elegí un producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} (stock {product.stock}){product.active ? '' : ' – de baja'}
            </option>
          ))}
        </Select>
      </label>
      <SearchPicker
        className="self-end"
        label="Buscar producto por nombre"
        value={productSearch}
        onChange={setProductSearch}
        results={filterByName(products, productSearch).map((product) => ({
          id: product.id,
          label: product.name,
          hint: `stock ${product.stock}${product.active ? '' : ' · de baja'}`,
        }))}
        onPick={(id) => setProductId(String(id))}
        emptyText="Ningún producto coincide"
      />

      <label className="grid gap-1 text-sm">
        Tipo de movimiento
        <Select value={type} onChange={(e) => setType(e.target.value as RegistrableMovementType)}>
          {registrableTypes.map((value) => (
            <option key={value} value={value}>
              {movementTypeLabels[value]}
            </option>
          ))}
        </Select>
      </label>

      <label className="grid gap-1 text-sm">
        Cantidad
        <Input type="number" step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <span className="text-xs text-muted-foreground">
          {type === 'INITIAL_STOCK'
            ? 'Las unidades que hay hoy en el comercio. Solo se carga una vez por producto.'
            : 'Positivo suma unidades y negativo resta (por ejemplo, -2).'}
        </span>
      </label>

      {type === 'ADJUSTMENT' && (
        <label className="grid gap-1 text-sm">
          Motivo
          <Select value={reason} onChange={(e) => setReason(e.target.value as AdjustmentReason)}>
            {(Object.keys(adjustmentReasonLabels) as AdjustmentReason[]).map((value) => (
              <option key={value} value={value}>
                {adjustmentReasonLabels[value]}
              </option>
            ))}
          </Select>
        </label>
      )}

      <label className={`grid gap-1 text-sm ${type === 'ADJUSTMENT' ? '' : 'sm:col-span-2'}`}>
        Nota{type === 'ADJUSTMENT' && reason === 'OTHER' ? ' (obligatoria con el motivo "Otro")' : ' (opcional)'}
        <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          Registrar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
