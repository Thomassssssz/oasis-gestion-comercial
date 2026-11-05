import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createSale } from '@/services/sales/sale.service'
import type { Product } from '@/types/product.types'
import type { PaymentMethod } from '@/types/sale.types'
import { describeError } from '@/utils/errors'
import { peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

type CartLine = { productId: number; quantity: string }

type Props = {
  products: Product[] // los productos activos
  onSaved: () => void
}

// Importe en centavos (enteros) a partir de un precio con 2 decimales como "1500.50".
// Es solo para mostrar el total mientras se arma la venta: el total real lo calcula el servidor.
const cents = (price: string) => Math.round(Number(price) * 100)

// Venta rápida: se eligen productos, cantidades y medio de pago. El precio es siempre el de lista (D13-a).
// Las reglas (stock suficiente, producto activo...) las controla la API y sus mensajes se muestran tal cual.
export default function SaleForm({ products, onSaved }: Props) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const byId = new Map(products.map((product) => [product.id, product]))
  const totalCents = cart.reduce(
    (sum, line) => sum + cents(byId.get(line.productId)?.salePrice ?? '0') * (Number(line.quantity) || 0),
    0,
  )

  function addProduct(productId: number) {
    setDone(null)
    setCart((current) =>
      current.some((line) => line.productId === productId)
        ? current.map((line) =>
            line.productId === productId ? { ...line, quantity: String((Number(line.quantity) || 0) + 1) } : line,
          )
        : [...current, { productId, quantity: '1' }],
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDone(null)
    setSaving(true)

    try {
      const sale = await createSale({
        paymentMethod,
        items: cart.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      })
      setCart([])
      setDone(`Venta #${sale.id} registrada por ${peso.format(Number(sale.total))}`)
      onSaved()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 rounded-md border border-border bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold">Nueva venta</h3>

      <Select
        aria-label="Agregar producto"
        value=""
        onChange={(e) => e.target.value && addProduct(Number(e.target.value))}
        className="mb-4 max-w-md"
      >
        <option value="">Agregar producto…</option>
        {products.map((product) => (
          <option key={product.id} value={product.id} disabled={product.stock <= 0}>
            {product.name} – {peso.format(Number(product.salePrice))} (stock {product.stock})
          </option>
        ))}
      </Select>

      {cart.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">Todavía no agregaste productos.</p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cart.map((line) => {
                const product = byId.get(line.productId)!
                return (
                  <tr key={line.productId}>
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2 text-right">{peso.format(Number(product.salePrice))}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Cantidad de ${product.name}`}
                        className="ml-auto w-20 text-right"
                        value={line.quantity}
                        onChange={(e) =>
                          setCart((current) =>
                            current.map((l) => (l.productId === line.productId ? { ...l, quantity: e.target.value } : l)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {peso.format((cents(product.salePrice) * (Number(line.quantity) || 0)) / 100)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Quitar ${product.name}`}
                        onClick={() => setCart((current) => current.filter((l) => l.productId !== line.productId))}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="grid max-w-xs gap-1 text-sm">
          Medio de pago
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabels[method]}
              </option>
            ))}
          </Select>
        </label>
        <p className="text-lg">
          Total: <strong data-testid="cart-total">{peso.format(totalCents / 100)}</strong>
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mb-3 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          {done}
        </p>
      )}

      <Button type="submit" disabled={saving || cart.length === 0}>
        Confirmar venta
      </Button>
    </form>
  )
}
