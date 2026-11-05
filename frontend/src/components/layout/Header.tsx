import { LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiState } from '@/types/api.types'
import type { AuthUser } from '@/types/auth.types'

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

type Props = {
  apiState: ApiState
  onRetry: () => void
  user: AuthUser
  onLogout: () => void
}

// Cabecera de todas las pantallas con sesión: título, estado de la conexión con la API y quién está usando el sistema.
export default function Header({ apiState, onRetry, user, onLogout }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="text-2xl font-bold">Oasis – Gestión Comercial</h1>
      <div className="flex flex-wrap items-center gap-2">
        <p className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyles[apiState]}`} role="status">
          {messages[apiState]}
        </p>
        {apiState === 'error' && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw />
            Reintentar
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{user.fullName}</span>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut />
          Salir
        </Button>
      </div>
    </header>
  )
}
