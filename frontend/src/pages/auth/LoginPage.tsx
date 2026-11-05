import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context'
import { ApiError } from '@/services/api/client'

// Pantalla para entrar al sistema. No hay registro: los usuarios los crea el propietario desde el servidor.
export default function LoginPage() {
  const { status, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Si ya hay una sesión abierta, no tiene sentido mostrar el login.
  if (status === 'authenticated') return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      // 401 y 429 traen un mensaje pensado para mostrar (credenciales incorrectas, demasiados intentos).
      setError(
        err instanceof ApiError && (err.status === 401 || err.status === 429)
          ? err.message
          : 'No se pudo iniciar sesión. Revisá la conexión con la API e intentá de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Oasis – Gestión Comercial</h1>
      <p className="mb-6 text-sm text-muted-foreground">Ingresá con tu usuario para continuar.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium">
            Usuario
          </label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </main>
  )
}
