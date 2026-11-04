import { useEffect, useState } from 'react'
import { getHealth } from './lib/api.ts'

type ApiState = 'loading' | 'connected' | 'error'

const messages: Record<ApiState, string> = {
  loading: 'Consultando la API…',
  connected: 'API conectada',
  error: 'Sin conexión con la API',
}

// Colores de la etiqueta de estado según el resultado de la consulta.
const statusStyles: Record<ApiState, string> = {
  loading: 'bg-gray-200 text-gray-700',
  connected: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
}

export default function App() {
  const [apiState, setApiState] = useState<ApiState>('loading')

  useEffect(() => {
    // Si el componente se desmonta antes de que llegue la respuesta,
    // se ignora el resultado para no actualizar un componente que ya no existe.
    let ignore = false

    getHealth()
      .then((health) => {
        if (!ignore) setApiState(health.status === 'ok' ? 'connected' : 'error')
      })
      .catch(() => {
        if (!ignore) setApiState('error')
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold">Oasis – Gestión Comercial</h1>
      <p
        className={`inline-block rounded-full px-4 py-1.5 font-semibold ${statusStyles[apiState]}`}
        role="status"
      >
        {messages[apiState]}
      </p>
    </main>
  )
}
