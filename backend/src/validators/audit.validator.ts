import { z } from "zod";
import { isRealDay } from "../helpers/report-dates.js";

const day = (label: string) =>
  z.string().trim().refine(isRealDay, `${label} tiene que ser una fecha real con formato AAAA-MM-DD`);

// Filtros del registro de auditoría: /api/audit?action=SALE_ANNULLED&from=2026-11-01&limit=50
export const auditListQuerySchema = z
  .object({
    userId: z.coerce.number({ error: "El usuario no es válido" }).int("El usuario no es válido").positive("El usuario no es válido").optional(),
    action: z.string().trim().min(1).max(60).optional(),
    entityType: z.string().trim().min(1).max(60).optional(),
    from: day("La fecha desde").optional(),
    to: day("La fecha hasta").optional(),
    limit: z.coerce
      .number({ error: "El límite no es válido" })
      .int("El límite no es válido")
      .min(1, "El límite debe ser de 1 a 500")
      .max(500, "El límite debe ser de 1 a 500")
      .default(100),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "La fecha desde no puede ser posterior a la fecha hasta",
    path: ["from"],
  });

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
