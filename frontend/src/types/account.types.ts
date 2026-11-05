import type { PaymentMethod } from '@/types/sale.types'

export type AccountStatus = 'OPEN' | 'CANCELLED'

// Una línea de la ficha: lo que se llevó el cliente, con el precio de ese momento.
export type AccountSaleItem = {
  productName: string
  quantity: number
  unitPrice: string
  subtotal: string
}

export type AccountSale = {
  id: number
  status: 'CONFIRMED' | 'ANNULLED'
  createdAt: string
  note: string | null
  discount: string // descuento en pesos de toda la venta
  total: string // ya con el descuento
  items: AccountSaleItem[]
}

export type AccountPayment = {
  id: number
  amount: string
  paymentMethod: PaymentMethod
  note: string | null
  createdAt: string
  userName: string
}

// Recargo por mora: el registrado guarda además cuándo se registró; el pendiente solo se muestra (D18).
export type AccountSurcharge = {
  monthNumber: number
  base: string // capital pendiente con el que se calculó
  percent: string // porcentaje usado
  amount: string
  chargedOn: string
  registeredAt?: string
}

export type PaymentInput = { amount: string; paymentMethod: PaymentMethod; note?: string }

// Ficha de cuenta corriente tal como la devuelve la API. El saldo y la mora los calcula el servidor.
export type CreditAccount = {
  id: number
  customer: { id: number; name: string }
  status: AccountStatus
  openedAt: string
  dueDate: string // un mes después de la primera venta a crédito; no cambia
  closedAt: string | null
  number: string | null // el "Nº" que se escribe a mano en el remito
  remitoNumber: string | null // el "Remito Nº"
  balance: string // saldo registrado (ventas + recargos registrados − pagos)
  pendingSurchargesTotal: string
  payable: string // saldo + recargos que ya corresponden: lo que hay que pagar hoy
  overdue: boolean // abierta y con el vencimiento ya pasado
  monthsOverdue: number // meses de atraso completos
  pendingSurcharges: AccountSurcharge[] // ya corresponden pero todavía no se registraron
  surcharges: AccountSurcharge[] // registrados
  payments: AccountPayment[]
  sales: AccountSale[]
}
