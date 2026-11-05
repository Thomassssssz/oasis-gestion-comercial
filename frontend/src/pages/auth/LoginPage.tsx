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
    <main className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
      {/* Frente del local: pared azul, cartel marrón con el nombre y persianas naranjas. */}
      <section aria-hidden="true" className="relative flex flex-col overflow-hidden bg-[#2a67b0] max-md:min-h-64 md:min-h-screen">
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
          <div className="rounded-xl border-4 border-[#2f1b14] bg-wood px-8 py-6 shadow-[0_8px_0_rgb(0_0_0/0.18)]">
            <OasisLogo size="lg" tone="light" className="max-md:flex-col max-md:text-center" />
          </div>
          <p className="-rotate-2 rounded-md bg-sun px-4 py-1.5 text-lg font-bold text-wood shadow-[0_4px_0_rgb(0_0_0/0.18)]">Librería · Formosa</p>
        </div>

        {/* Útiles escolares pegados en la pared (solo en pantallas grandes). */}
        <Notebook className="absolute top-[8%] left-[7%] hidden w-20 -rotate-12 md:block" />
        <Notebook color="#f4b82f" className="absolute right-[9%] bottom-[24%] hidden w-16 rotate-6 md:block" />
        <Pencil color="#f4b82f" className="absolute top-[10%] right-[12%] hidden h-28 rotate-[28deg] md:block" />
        <Pencil color="#e2592b" className="absolute bottom-[26%] left-[10%] hidden h-24 -rotate-[24deg] md:block" />
        <Ruler className="absolute top-[34%] right-[-2.5rem] hidden w-44 -rotate-90 md:block" />
        <Paperclip className="absolute top-[44%] left-[6%] hidden h-14 rotate-12 md:block" />

        <div className="shutter h-16 shrink-0 md:h-28" />
      </section>

      {/* Hoja de cuaderno con espiral: ahí se escribe el usuario y la contraseña. */}
      <section className="flex items-center justify-center bg-background px-4 py-10 md:px-10">
        <div className="relative w-full max-w-sm">
          <ol aria-hidden="true" className="absolute top-8 -left-3 flex flex-col gap-6">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="h-3.5 w-7 rounded-full bg-gradient-to-r from-[#8a98ad] to-[#dfe6f0] shadow-inner" />
            ))}
          </ol>

          <div className="paper rounded-lg border border-border bg-white py-6 pr-6 pl-10 shadow-[0_6px_0_rgb(23_52_95/0.12)]">
            <h1 className="mb-1 text-2xl font-bold text-ink">Oasis – Gestión Comercial</h1>
            <p className="mb-6 text-sm text-muted-foreground">Ingresá con tu usuario para continuar.</p>

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

              <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                {submitting ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
