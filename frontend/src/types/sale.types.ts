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
  paymentMethod: PaymentMethod
  total: string
  userId: number
  userName: string
  createdAt: string
  // null mientras la venta está confirmada; si está anulada, quién, cuándo y por qué.
  annulment: { at: string; byId: number; byName: string | null; reason: string } | null
  items: SaleItem[]
}

// Lo que se envía para registrar una venta rápida: el precio nunca va, lo pone el servidor.
export type SaleInput = {
  paymentMethod: PaymentMethod
  items: { productId: number; quantity: number }[]
}

export type SaleFilters = { status: '' | SaleStatus }
