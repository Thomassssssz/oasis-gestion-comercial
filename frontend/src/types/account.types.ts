export type AccountStatus = 'OPEN' | 'CANCELLED'

export type AccountSale = {
  id: number
  status: 'CONFIRMED' | 'ANNULLED'
  createdAt: string
  note: string | null
  total: string
}

// Ficha de cuenta corriente tal como la devuelve la API. El saldo y la mora los calcula el servidor.
export type CreditAccount = {
  id: number
  customer: { id: number; name: string }
  status: AccountStatus
  openedAt: string
  dueDate: string // un mes después de la primera venta a crédito; no cambia
  closedAt: string | null
  balance: string
  overdue: boolean // abierta y con el vencimiento ya pasado
  monthsOverdue: number // meses de atraso completos
  sales: AccountSale[]
}
