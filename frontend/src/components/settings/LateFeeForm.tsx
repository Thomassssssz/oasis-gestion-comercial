import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateSettings } from '@/services/settings/setting.service'
import type { Settings } from '@/types/setting.types'
import { dateTime } from '@/utils/format'
import { describeError } from '@/utils/errors'

type Props = {
  settings: Settings
  onSaved: (settings: Settings) => void
}

// El porcentaje se muestra con coma decimal ("5,00"), como se escribe en Argentina.
const toScreen = (value: string) => value.replace('.', ',')

// Parámetro de recargo por mora: porcentaje que se suma por cada mes de atraso (D16).
export default function LateFeeForm({ settings, onSaved }: Props) {
  const [value, setValue] = useState(toScreen(settings.lateFeePercent))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // La API espera el punto decimal.
      const result = await updateSettings({ lateFeePercent: value.trim().replace(',', '.') })
      setValue(toScreen(result.lateFeePercent))
      setSaved(true)
      onSaved(result)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-white p-4">
      <h3 className="text-lg font-semibold">Recargo por mora</h3>
      <p className="text-sm text-muted-foreground">
        Porcentaje que se suma por cada mes de atraso en una cuenta corriente. Cambiarlo no modifica los recargos que ya se
        registraron: cada uno guarda el porcentaje con el que se calculó.
      </p>

      <label className="grid max-w-xs gap-1 text-sm">
        Porcentaje por mes (%)
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>

      <p className="text-xs text-muted-foreground">
        {settings.updatedBy
          ? `Última modificación: ${dateTime.format(new Date(settings.updatedAt))} por ${settings.updatedBy.fullName}.`
          : 'Valor inicial del sistema: nadie lo modificó todavía.'}
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          Porcentaje guardado.
        </p>
      )}

      <div>
        <Button type="submit" disabled={saving}>
          Guardar porcentaje
        </Button>
      </div>
    </form>
  )
}
