import { apiRequest } from '@/services/api/client'
import type { MovementInput, RegisteredMovement, StockMovement } from '@/types/stock-movement.types'

// Historial de movimientos, del más nuevo al más viejo. Con productId, solo los de ese producto.
export const listMovements = (productId?: number) =>
  apiRequest<StockMovement[]>(`/stock-movements${productId ? `?productId=${productId}` : ''}`)

export const registerMovement = (input: MovementInput) =>
  apiRequest<RegisteredMovement>('/stock-movements', { method: 'POST', body: input })
