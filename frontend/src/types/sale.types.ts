export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'DIGITAL_WALLET'

export type SaleStatus = 'CONFIRMED' | 'ANNULLED'

export type SaleItem = {
  productId: number
  productName: string
  quantity: number
  unitPrice: string // precio de lista del día de la venta, como texto con 2 decimales
  subtotal: string
}

// Venta tal como la devuelve la API. El total lo calcula el servidor.
export type Sale = {
  id: number
  status: SaleStatus
  paymentMethod: PaymentMethod | null // null en las ventas a crédito: se cobra después
  onCredit: boolean
  customer: { id: number; name: string } | null
  accountId: number | null // ficha de cuenta corriente, si es a crédito
  subtotal: string
  discount: string // descuento en pesos de toda la venta
  total: string // subtotal menos descuento
  note: string | null
  userId: number
  userName: string
  createdAt: string
  // null mientras la venta está confirmada; si está anulada, quién, cuándo y por qué.
  annulment: { at: string; byId: number; byName: string | null; reason: string } | null
  items: SaleItem[]
}

// Lo que se envía para registrar una venta: el precio nunca va, lo pone el servidor.
// La venta rápida lleva solo medio de pago e ítems; la completa suma cliente, descuento y nota.
// A crédito no se manda medio de pago (la API lo rechaza).
export type SaleInput = {
  paymentMethod?: PaymentMethod
  customerId?: number
  discount?: string
  note?: string
  onCredit?: boolean
  items: { productId: number; quantity: number }[]
}

export type SaleFilters = { status: '' | SaleStatus }
