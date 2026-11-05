import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import OasisLogo from '@/components/brand/OasisLogo'
import { Notebook, Paperclip, Pencil, Ruler } from '@/components/brand/Stationery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context'
import { ApiError } from '@/services/api/client'

// Pantalla para entrar al sistema. No hay registro: los usuarios los crea el propietario desde el servidor.
export default function LoginPage() {
  const { status, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // true = la contraseña se ve escrita en lugar de puntos
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#2a67b0]">
      {/* Útiles escolares pegados en la pared (solo en pantallas grandes). */}
      <div aria-hidden="true">
        <Notebook className="absolute top-[7%] left-[8%] hidden w-20 -rotate-12 md:block" />
        <Notebook color="#f4b82f" className="absolute right-[10%] bottom-[24%] hidden w-16 rotate-6 md:block" />
        <Pencil color="#f4b82f" className="absolute top-[9%] right-[13%] hidden h-28 rotate-[28deg] md:block" />
        <Pencil color="#e2592b" className="absolute bottom-[26%] left-[11%] hidden h-24 -rotate-[24deg] md:block" />
        <Ruler className="absolute top-[36%] right-[-2.5rem] hidden w-44 -rotate-90 md:block" />
        <Paperclip className="absolute top-[46%] left-[7%] hidden h-14 rotate-12 md:block" />
      </div>

      {/* Frente del local: el cartel marrón con el nombre y, abajo, el formulario para entrar. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
        <div aria-hidden="true" className="flex flex-col items-center gap-4">
          <div className="rounded-xl border-4 border-[#2f1b14] bg-wood px-8 py-5 shadow-[0_8px_0_rgb(0_0_0/0.18)]">
            <OasisLogo size="lg" tone="light" className="max-md:flex-col max-md:text-center" />
          </div>
          <p className="-rotate-2 rounded-md bg-sun px-4 py-1.5 text-lg font-bold text-wood shadow-[0_4px_0_rgb(0_0_0/0.18)]">Librería · Formosa</p>
        </div>

        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-[0_8px_0_rgb(0_0_0/0.18)]">
          <h1 className="mb-1 text-2xl font-bold text-ink">Oasis – Gestión Comercial</h1>
          <p className="mb-5 text-sm text-muted-foreground">Ingresá con tu usuario para continuar.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="username" className="text-sm font-semibold">
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
              <label htmlFor="password" className="text-sm font-semibold">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" variant="accent" size="lg" disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </div>

      <div aria-hidden="true" className="shutter h-16 shrink-0 md:h-20" />
    </main>
  )
}
