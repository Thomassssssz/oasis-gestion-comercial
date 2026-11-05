import { z } from "zod";
import { optionalText, positiveAmountSchema } from "./common.validator.js";
import { paymentMethodSchema } from "./sale.validator.js";

// Filtros del listado: /api/accounts?status=OPEN&customerId=3
// OPEN = cuentas pendientes; CANCELLED = historial de cuentas canceladas (D17-d).
export const accountListQuerySchema = z.object({
  status: z.enum(["OPEN", "CANCELLED"], { error: 'El estado debe ser "OPEN" o "CANCELLED"' }).optional(),
  customerId: z.coerce.number({ error: "El cliente no es válido" }).int("El cliente no es válido").positive("El cliente no es válido").optional(),
});

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

// Pago a una ficha: importe mayor que cero, medio de pago y nota opcional. Si el importe supera el saldo lo rechaza el servicio.
export const accountPaymentSchema = z.object({
  amount: positiveAmountSchema("El importe"),
  paymentMethod: paymentMethodSchema,
  note: optionalText("La nota", 500),
});

// Los dos números que se escriben a mano en el remito de papel: el de la ficha (Nº) y el del remito (Remito Nº) (D23).
// Se envían los dos juntos; vacío significa "sin dato".
export const accountRemitoSchema = z.object({
  number: optionalText("El número", 30),
  remitoNumber: optionalText("El número de remito", 30),
});

export type AccountRemitoInput = z.infer<typeof accountRemitoSchema>;
export type AccountPaymentInput = z.infer<typeof accountPaymentSchema>;
