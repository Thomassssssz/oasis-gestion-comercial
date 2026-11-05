import { apiRequest } from '@/services/api/client'
import type { DateRange, DebtReport, SalesReport } from '@/types/report.types'

// Sin rango, la API devuelve los últimos 30 días hasta hoy.
export const getSalesReport = (range?: DateRange) =>
  apiRequest<SalesReport>(`/reports/sales${range ? `?from=${range.from}&to=${range.to}` : ''}`)

export const getDebtReport = () => apiRequest<DebtReport>('/reports/debt')
