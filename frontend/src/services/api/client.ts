import type { FieldError } from '@/types/api.types'

// Error de la API: guarda el código HTTP y el mensaje que explica qué pasó.
export class ApiError extends Error {
  status: number
  details: FieldError[]

  constructor(status: number, message: string, details: FieldError[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }

// Hace un pedido a la API (las rutas empiezan con /api) y devuelve la respuesta como JSON.
// Si la API responde con error, lanza un ApiError con el mensaje que mandó el backend.
export async function apiRequest<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? `La API respondió con el estado ${response.status}`,
      data?.details ?? [],
    )
  }

  return data as T
}
