import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getHealth } from '@/lib/api.ts'

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
  // Cada vez que sube este número, el efecto de abajo vuelve a consultar la API.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Si el componente se desmonta (o se reintenta) antes de que llegue la respuesta,
    // se ignora el resultado viejo para no pisar el estado más nuevo.
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
  }, [attempt])

  function retry() {
    setApiState('loading')
    setAttempt((n) => n + 1)
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold">Oasis – Gestión Comercial</h1>
      <p
        className={`inline-block rounded-full px-4 py-1.5 font-semibold ${statusStyles[apiState]}`}
        role="status"
      >
        {messages[apiState]}
      </p>
      {apiState === 'error' && (
        <div className="mt-4">
          <Button variant="outline" onClick={retry}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      )}
    </main>
  )
}
