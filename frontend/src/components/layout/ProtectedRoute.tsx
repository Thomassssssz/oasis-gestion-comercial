import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context'

// Deja pasar solo a quien tiene la sesión abierta; al resto lo manda a la pantalla de login.
export default function ProtectedRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <p role="status" className="p-6 text-center text-sm text-muted-foreground">
        Cargando…
      </p>
    )
  }

  if (status === 'anonymous') return <Navigate to="/login" replace />

  return <Outlet />
}
