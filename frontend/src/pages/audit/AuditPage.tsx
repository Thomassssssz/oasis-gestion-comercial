import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { listAudit } from '@/services/audit/audit.service'
import type { AuditEntry, AuditFilters } from '@/types/audit.types'
import { auditActionLabel, auditActionLabels } from '@/utils/audit-labels'
import { describeError } from '@/utils/errors'
import { dateTime } from '@/utils/format'

const noFilters: AuditFilters = { action: '', from: '', to: '' }

// Auditoría (D20): quién hizo qué y cuándo. Solo se consulta; el registro no se edita ni se borra.
export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(noFilters)
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    // Si una fecha está a medio escribir (vacía) no se manda; la API rechaza un rango al revés y se muestra su mensaje.
    listAudit(filters)
      .then((list) => {
        if (!ignore) {
          setEntries(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [filters])

  const hasFilters = filters.action !== '' || filters.from !== '' || filters.to !== ''

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Auditoría</h2>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Acción
          <Select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="min-w-56">
            <option value="">Todas</option>
            {Object.entries(auditActionLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Desde
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          Hasta
          <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        {hasFilters && (
          <Button variant="outline" onClick={() => setFilters(noFilters)}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {entries === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {entries?.length === 0 && <p className="text-muted-foreground">No hay anotaciones con estos filtros.</p>}

      {entries && entries.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2">{dateTime.format(new Date(entry.createdAt))}</td>
                    <td className="px-3 py-2">{entry.userName}</td>
                    <td className="px-3 py-2">{auditActionLabel(entry.action)}</td>
                    <td className="px-3 py-2">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length >= 100 && (
            <p className="mt-2 text-sm text-muted-foreground">Se muestran las 100 anotaciones más nuevas. Usá los filtros para acotar.</p>
          )}
        </>
      )}
    </section>
  )
}
