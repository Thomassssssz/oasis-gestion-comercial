import { useEffect, useState } from 'react'
import { getHealth } from './lib/api.ts'

type ApiState = 'loading' | 'connected' | 'error'

const messages: Record<ApiState, string> = {
  loading: 'Consultando la API…',
  connected: 'API conectada',
  error: 'Sin conexión con la API',
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
    <main className="app">
      <h1>Oasis – Gestión Comercial</h1>
      <p className={`api-status api-status--${apiState}`} role="status">
        {messages[apiState]}
      </p>
    </main>
  )
}
