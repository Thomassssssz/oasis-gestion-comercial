// Reportes tal como los devuelve la API (D19). Los importes llegan como texto con 2 decimales.
export type ReportPaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'DIGITAL_WALLET' | 'ON_CREDIT'

export type SalesReport = {
  from: string // AAAA-MM-DD (día de Argentina)
  to: string
  totals: { count: number; total: string; average: string }
  byDay: { date: string; count: number; total: string }[]
  byPaymentMethod: { method: ReportPaymentMethod; count: number; total: string }[]
  topProducts: { productId: number; productName: string; quantity: number; total: string }[]
}

export type DebtReport = {
  totalBalance: string
  totalPayable: string
  accounts: {
    accountId: number
    customer: { id: number; name: string }
    balance: string
    payable: string
    dueDate: string
    overdue: boolean
    monthsOverdue: number
  }[]
}

export type DateRange = { from: string; to: string }
