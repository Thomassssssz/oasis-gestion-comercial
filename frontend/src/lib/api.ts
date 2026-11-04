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
