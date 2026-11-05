import { apiRequest } from '@/services/api/client'
import type { AccountStatus, CreditAccount } from '@/types/account.types'

// OPEN = cuentas pendientes; CANCELLED = historial de canceladas.
export const listAccounts = (status: AccountStatus) => apiRequest<CreditAccount[]>(`/accounts?status=${status}`)
