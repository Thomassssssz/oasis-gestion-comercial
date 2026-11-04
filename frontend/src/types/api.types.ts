export type HealthResponse = {
  status: string
}

// Detalle de un campo inválido, tal como lo devuelve la API en los errores 400.
export type FieldError = { field: string; message: string }

// Resultado de preguntarle al backend si está vivo.
export type ApiState = 'loading' | 'connected' | 'error'
