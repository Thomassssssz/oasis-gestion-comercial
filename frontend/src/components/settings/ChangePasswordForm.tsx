import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { changePassword } from '@/services/auth/auth.service'
import { describeError } from '@/utils/errors'

// Cambio de la contraseña del usuario que tiene la sesión abierta.
export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDone(false)

    // Se avisa antes de molestar a la API: evita guardar una contraseña mal escrita.
    if (next !== repeat) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }

    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setDone(true)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-white p-4">
      <h3 className="text-lg font-semibold">Cambiar mi contraseña</h3>
      <p className="text-sm text-muted-foreground">
        La contraseña nueva tiene que tener al menos 10 caracteres. Al cambiarla se cierran tus otras sesiones abiertas.
      </p>

      <label className="grid max-w-xs gap-1 text-sm">
        Contraseña actual
        <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="grid max-w-xs gap-1 text-sm">
        Contraseña nueva
        <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="grid max-w-xs gap-1 text-sm">
        Repetir contraseña nueva
        <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          Contraseña cambiada. Se cerraron tus otras sesiones abiertas.
        </p>
      )}

      <div>
        <Button type="submit" disabled={saving}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  )
}
