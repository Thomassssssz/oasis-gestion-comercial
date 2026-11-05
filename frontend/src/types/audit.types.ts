// Anotación del registro de auditoría tal como la devuelve la API (D20).
export type AuditEntry = {
  id: number
  createdAt: string
  userId: number
  userName: string
  action: string // clave, por ejemplo SALE_ANNULLED
  entityType: string
  entityId: number | null
  summary: string // texto en español de lo que se hizo
}

export type AuditFilters = { action: string; from: string; to: string }
