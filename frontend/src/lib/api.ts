export type HealthResponse = {
  status: string
}

// Le pregunta al backend si está vivo (GET /api/health).
// Lanza un error si la API no responde o responde con un estado de error.
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')

  if (!response.ok) {
    throw new Error(`La API respondió con el estado ${response.status}`)
  }

  return (await response.json()) as HealthResponse
}

// Detalle de un campo inválido, tal como lo devuelve la API en los errores 400.
export type FieldError = { field: string; message: string }

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

// Mensaje listo para mostrar al usuario: si hay detalles por campo, los junta.
export function describeError(error: unknown): string {
  if (error instanceof ApiError && error.details.length > 0) {
    return error.details.map((detail) => detail.message).join('. ')
  }
  if (error instanceof ApiError) return error.message
  return 'No se pudo conectar con el servidor'
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
