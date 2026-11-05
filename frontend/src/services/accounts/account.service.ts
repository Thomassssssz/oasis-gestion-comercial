import { apiRequest } from '@/services/api/client'
import type { AccountStatus, CreditAccount, PaymentInput } from '@/types/account.types'

// OPEN = cuentas pendientes; CANCELLED = historial de canceladas.
export const listAccounts = (status: AccountStatus) => apiRequest<CreditAccount[]>(`/accounts?status=${status}`)

// Registra un pago. La API primero registra los recargos que ya corresponden y rechaza el pago si supera el saldo.
export const payAccount = (id: number, input: PaymentInput) =>
  apiRequest<CreditAccount>(`/accounts/${id}/payments`, { method: 'POST', body: input })

// Registra los recargos por mora que ya corresponden (D18-f).
export const applySurcharges = (id: number) => apiRequest<CreditAccount>(`/accounts/${id}/surcharges`, { method: 'POST' })
