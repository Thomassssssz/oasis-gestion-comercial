import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getHealth } from '@/services/health/health.service'
import { cn } from '@/lib/utils'
import CategoriesPage from '@/features/categories/CategoriesPage'
import ProductsPage from '@/features/products/ProductsPage'

type ApiState = 'loading' | 'connected' | 'error'
type Section = 'products' | 'categories'

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

const sections: { id: Section; label: string }[] = [
  { id: 'products', label: 'Productos' },
  { id: 'categories', label: 'Categorías' },
]

export default function App() {
  const [apiState, setApiState] = useState<ApiState>('loading')
  // Cada vez que sube este número, el efecto de abajo vuelve a consultar la API.
  const [attempt, setAttempt] = useState(0)
  const [section, setSection] = useState<Section>('products')

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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="text-2xl font-bold">Oasis – Gestión Comercial</h1>
        <div className="flex items-center gap-2">
          <p
            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyles[apiState]}`}
            role="status"
          >
            {messages[apiState]}
          </p>
          {apiState === 'error' && (
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw />
              Reintentar
            </Button>
          )}
        </div>
      </header>

      <nav aria-label="Secciones" className="mb-6 flex gap-2">
        {sections.map(({ id, label }) => (
          <Button
            key={id}
            variant={section === id ? 'default' : 'outline'}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => setSection(id)}
            className={cn(section !== id && 'bg-white')}
          >
            {label}
          </Button>
        ))}
      </nav>

      <main>{section === 'products' ? <ProductsPage /> : <CategoriesPage />}</main>
    </div>
  )
}
