import { useEffect, useState } from 'react'
import ChangePasswordForm from '@/components/settings/ChangePasswordForm'
import LateFeeForm from '@/components/settings/LateFeeForm'
import { getSettings } from '@/services/settings/setting.service'
import type { Settings } from '@/types/setting.types'
import { describeError } from '@/utils/errors'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getSettings()
      .then((result) => {
        if (!ignore) setSettings(result)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section className="grid gap-4">
      <h2 className="text-xl font-semibold">Configuración</h2>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {settings === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {settings && <LateFeeForm settings={settings} onSaved={setSettings} />}

      <ChangePasswordForm />
    </section>
  )
}
