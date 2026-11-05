import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createSale } from '@/services/sales/sale.service'
import type { Customer } from '@/types/customer.types'
import type { Product } from '@/types/product.types'
import type { PaymentMethod } from '@/types/sale.types'
import { describeError } from '@/utils/errors'
import { peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

type CartLine = { productId: number; quantity: string }

type Props = {
  products: Product[] // los productos activos
  customers: Customer[] // los clientes activos
  onSaved: () => void
}

// Importe en centavos (enteros) a partir de un precio con 2 decimales como "1500.50".
// Es solo para mostrar el total mientras se arma la venta: el total real lo calcula el servidor.
const cents = (price: string) => Math.round(Number(price) * 100)

// Importe en centavos a partir de lo que se escribe en el descuento. Acepta coma o punto; si no es un número, 0.
const discountCents = (text: string) => {
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0
}

// Venta rápida (productos, cantidades y medio de pago) o completa (además cliente, descuento, nota y crédito).
// El precio es siempre el de lista (D13-a). Las reglas (stock, cliente autorizado, descuento válido...) las controla
// la API y sus mensajes se muestran tal cual (D17).
export default function SaleForm({ products, customers, onSaved }: Props) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState('')
  const [note, setNote] = useState('')
  const [onCredit, setOnCredit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const byId = new Map(products.map((product) => [product.id, product]))
  const subtotalCents = cart.reduce(
    (sum, line) => sum + cents(byId.get(line.productId)?.salePrice ?? '0') * (Number(line.quantity) || 0),
    0,
  )
  const totalCents = subtotalCents - discountCents(discount)
  const customer = customers.find((c) => String(c.id) === customerId)
  const canUseCredit = customer?.creditAuthorized === true

  function handleCustomerChange(value: string) {
    setCustomerId(value)
    // El crédito solo vale para clientes autorizados: si se cambia de cliente, se destilda.
    if (!customers.find((c) => String(c.id) === value)?.creditAuthorized) setOnCredit(false)
  }

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
        // A crédito no se manda medio de pago: se cobra después.
        ...(onCredit ? { onCredit: true } : { paymentMethod }),
        ...(customerId ? { customerId: Number(customerId) } : {}),
        ...(discount.trim() ? { discount: discount.trim().replace(',', '.') } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        items: cart.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      })
      setCart([])
      setDiscount('')
      setNote('')
      setOnCredit(false)
      setCustomerId('')
      setDone(
        `Venta #${sale.id} registrada por ${peso.format(Number(sale.total))}` +
          (sale.onCredit ? ' (a crédito, suma a la cuenta corriente)' : ''),
      )
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Cliente (opcional)
          <Select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}>
            <option value="">Sin cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.creditAuthorized ? ' (crédito autorizado)' : ''}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Descuento en pesos (opcional)
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Nota (opcional)
          <Input
            placeholder="Pedido especial, acuerdo con el cliente…"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className={`flex items-center gap-2 text-sm ${canUseCredit ? '' : 'text-muted-foreground'}`}>
          <input
            type="checkbox"
            checked={onCredit}
            disabled={!canUseCredit}
            onChange={(e) => setOnCredit(e.target.checked)}
          />
          Venta a crédito (se cobra después, en la cuenta corriente del cliente)
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {onCredit ? (
          <p className="text-sm text-muted-foreground">A crédito: no lleva medio de pago, se carga a la ficha del cliente.</p>
        ) : (
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
        )}
        <div className="text-right">
          {discountCents(discount) > 0 && (
            <p className="text-sm text-muted-foreground">
              Subtotal {peso.format(subtotalCents / 100)} − descuento {peso.format(discountCents(discount) / 100)}
            </p>
          )}
          <p className="text-lg">
            Total: <strong data-testid="cart-total">{peso.format(totalCents / 100)}</strong>
          </p>
        </div>
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
