import { z } from "zod";

// Filtros del listado: /api/accounts?status=OPEN&customerId=3
// OPEN = cuentas pendientes; CANCELLED = historial de cuentas canceladas (D17-d).
export const accountListQuerySchema = z.object({
  status: z.enum(["OPEN", "CANCELLED"], { error: 'El estado debe ser "OPEN" o "CANCELLED"' }).optional(),
  customerId: z.coerce.number({ error: "El cliente no es válido" }).int("El cliente no es válido").positive("El cliente no es válido").optional(),
});

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;
