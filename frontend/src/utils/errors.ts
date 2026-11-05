import { ApiError } from '@/services/api/client'

// Mensaje listo para mostrar al usuario: si hay detalles por campo, los junta.
export function describeError(error: unknown): string {
  if (error instanceof ApiError && error.details.length > 0) {
    return error.details.map((detail) => detail.message).join('. ')
  }
  if (error instanceof ApiError) return error.message
  return 'No se pudo conectar con el servidor'
}
