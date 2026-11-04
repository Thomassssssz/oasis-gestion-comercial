import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { getHealth } from '@/services/health/health.service'
import { cn } from '@/lib/utils'
import CategoriesPage from '@/pages/categories/CategoriesPage'
import ProductsPage from '@/pages/products/ProductsPage'
import type { ApiState } from '@/types/api.types'

type Section = 'products' | 'categories'

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
      <Header apiState={apiState} onRetry={retry} />

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
