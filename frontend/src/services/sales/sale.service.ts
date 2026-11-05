import { apiRequest } from '@/services/api/client'
import type { Sale, SaleFilters, SaleInput } from '@/types/sale.types'

export const listSales = ({ status }: SaleFilters) => apiRequest<Sale[]>(`/sales${status ? `?status=${status}` : ''}`)

export const createSale = (input: SaleInput) => apiRequest<Sale>('/sales', { method: 'POST', body: input })

export const annulSale = (id: number, reason: string) =>
  apiRequest<Sale>(`/sales/${id}/annul`, { method: 'POST', body: { reason } })
