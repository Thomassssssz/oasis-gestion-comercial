import { z } from "zod";
import { addDays, isRealDay } from "../helpers/report-dates.js";

export const MAX_REPORT_DAYS = 366;

const day = (label: string) =>
  z
    .string({ error: `${label} no es válida` })
    .trim()
    .refine(isRealDay, `${label} tiene que ser una fecha real con formato AAAA-MM-DD`);

// Qué está mal en un rango (días locales, ambos incluidos), o null si está bien. Lo usan el validador y el servicio
// (este último para el caso en que falta una de las dos fechas y se completa con la de hoy).
export function rangeProblem(from: string, to: string): string | null {
  if (from > to) return "La fecha desde no puede ser posterior a la fecha hasta";
  if (addDays(from, MAX_REPORT_DAYS - 1) < to) return `El rango no puede superar ${MAX_REPORT_DAYS} días`;
  return null;
}

// Rango del reporte de ventas: ?from=2026-10-01&to=2026-10-31 (días locales, ambos incluidos).
// Si faltan, el servicio usa los últimos 30 días.
export const salesReportQuerySchema = z
  .object({ from: day("La fecha desde").optional(), to: day("La fecha hasta").optional() })
  .superRefine((data, ctx) => {
    const problem = data.from && data.to ? rangeProblem(data.from, data.to) : null;
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["to"] });
  });

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
