import { apiRequest } from '@/services/api/client'
import type { AuditEntry, AuditFilters } from '@/types/audit.types'

// Arma el texto de filtros solo con los que tienen valor. La API devuelve las 100 más nuevas.
function toQueryString({ action, from, to }: AuditFilters) {
  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listAudit = (filters: AuditFilters) => apiRequest<AuditEntry[]>(`/audit${toQueryString(filters)}`)
