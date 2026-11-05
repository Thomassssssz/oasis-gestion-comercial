import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context'
import { getHealth } from '@/services/health/health.service'
import type { ApiState } from '@/types/api.types'

const COLLAPSED_KEY = 'oasis.sidebar.collapsed'

// Recuerda en este navegador si la barra quedó angosta. Es solo una comodidad: si el navegador no deja
// guardar (modo privado, datos bloqueados), la app funciona igual y la barra arranca ancha.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function saveCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value))
  } catch {
    // Nada que hacer: no se pudo recordar la preferencia.
  }
}

// Estructura de las pantallas con sesión: barra lateral con las secciones, cabecera y, abajo, la pantalla elegida (Outlet).
export default function MainLayout() {
  const { user, logout } = useAuth()
  const [apiState, setApiState] = useState<ApiState>('loading')
  // Cada vez que sube este número, el efecto de abajo vuelve a consultar la API.
  const [attempt, setAttempt] = useState(0)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  // En pantallas chicas, la tecla Escape cierra la barra abierta.
  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  function retry() {
    setApiState('loading')
    setAttempt((n) => n + 1)
  }

  function toggleCollapsed() {
    saveCollapsed(!collapsed)
    setCollapsed(!collapsed)
  }

  // Esta pantalla solo se muestra con sesión (ProtectedRoute), pero TypeScript necesita la comprobación.
  if (!user) return null

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onClose={() => setMobileOpen(false)}
      />
      {/* Fondo oscuro detrás de la barra abierta en pantallas chicas: tocarlo la cierra. */}
      {mobileOpen && <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="paper min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Button
            variant="outline"
            size="sm"
            className="mb-4 md:hidden print:hidden"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            aria-controls="sidebar"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
            Menú
          </Button>

          <Header apiState={apiState} onRetry={retry} user={user} onLogout={() => void logout()} />

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
