import { apiRequest } from '@/services/api/client'
import type { Sale, SaleFilters, SaleInput } from '@/types/sale.types'

export const listSales = ({ status }: SaleFilters) => apiRequest<Sale[]>(`/sales${status ? `?status=${status}` : ''}`)

// Compras de contado ya confirmadas de un cliente (las de crédito se ven en su ficha de cuenta corriente).
export const listCustomerCashSales = (customerId: number) =>
  apiRequest<Sale[]>(`/sales?customerId=${customerId}&onCredit=false&status=CONFIRMED&limit=200`)

export const createSale = (input: SaleInput) => apiRequest<Sale>('/sales', { method: 'POST', body: input })

export const annulSale = (id: number, reason: string) =>
  apiRequest<Sale>(`/sales/${id}/annul`, { method: 'POST', body: { reason } })
