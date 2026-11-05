import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { useAuth } from '@/context'
import { cn } from '@/lib/utils'
import { getHealth } from '@/services/health/health.service'
import type { ApiState } from '@/types/api.types'

const sections = [
  { to: '/productos', label: 'Productos' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/inventario', label: 'Inventario' },
]

// Estructura de las pantallas con sesión abierta: cabecera, menú de secciones y, abajo, la pantalla elegida (Outlet).
export default function MainLayout() {
  const { user, logout } = useAuth()
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

  // Esta pantalla solo se muestra con sesión (ProtectedRoute), pero TypeScript necesita la comprobación.
  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Header apiState={apiState} onRetry={retry} user={user} onLogout={() => void logout()} />

      <nav aria-label="Secciones" className="mb-6 flex gap-2">
        {sections.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium',
                isActive ? 'border-primary bg-primary text-primary-foreground' : 'bg-white hover:bg-muted',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
