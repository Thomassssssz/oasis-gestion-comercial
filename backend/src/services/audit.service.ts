import { addDays, startOfLocalDay } from "../helpers/report-dates.js";
import type { AuditEntry } from "../helpers/audit-rules.js";
import type { AuditRepository } from "../repositories/audit.repository.js";
import type { AuditListQuery } from "../validators/audit.validator.js";

// Auditoría (D20): registra quién hizo cada operación importante y permite consultarlo.
export function createAuditService(repository: AuditRepository) {
  return {
    async record(userId: number, entry: AuditEntry) {
      await repository.create({ userId, ...entry });
    },

    // Del más nuevo al más viejo. Las fechas son días de Argentina, ambos incluidos (igual que en los reportes).
    async list({ from, to, ...rest }: AuditListQuery) {
      const entries = await repository.findAll({
        ...rest,
        ...(from && { from: startOfLocalDay(from) }),
        ...(to && { toExclusive: startOfLocalDay(addDays(to, 1)) }),
      });
      return entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        userId: entry.userId,
        userName: entry.user.fullName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
      }));
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
