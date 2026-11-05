import { z } from "zod";
import { nonNegativeAmountSchema, optionalText } from "./common.validator.js";

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "DIGITAL_WALLET"] as const;

const paymentMethod = z.enum(PAYMENT_METHODS, { error: "Elegí un medio de pago de la lista" });

// Cada ítem: un producto y cuántas unidades se venden (enteras, D6). El precio NO viene del cliente:
// siempre es el precio de lista del producto (D13-a).
const itemSchema = z.object({
  productId: z
    .number({ error: "El producto es obligatorio" })
    .int("El producto no es válido")
    .positive("El producto no es válido"),
  quantity: z
    .number({ error: "La cantidad debe ser un número" })
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor que cero"),
});

// Datos para registrar una venta (D17). La venta rápida lleva solo productos y medio de pago.
// La venta completa suma cliente, descuento en pesos, nota para casos especiales y la opción de venderla a crédito.
export const saleInputSchema = z
  .object({
    paymentMethod: paymentMethod.optional(),
    customerId: z
      .number({ error: "El cliente no es válido" })
      .int("El cliente no es válido")
      .positive("El cliente no es válido")
      .optional(),
    discount: nonNegativeAmountSchema("El descuento").default("0"),
    note: optionalText("La nota", 500),
    onCredit: z.boolean({ error: "Indicá si la venta es a crédito" }).default(false),
    items: z
      .array(itemSchema, { error: "Los productos de la venta son obligatorios" })
      .min(1, "La venta necesita al menos un producto")
      .max(100, "Una venta puede tener hasta 100 productos distintos"),
  })
  .refine((data) => new Set(data.items.map((item) => item.productId)).size === data.items.length, {
    message: "Un producto no puede repetirse en la misma venta",
    path: ["items"],
  })
  .superRefine((data, ctx) => {
    if (data.onCredit) {
      // A crédito se cobra después: hace falta saber a quién, y todavía no hay medio de pago.
      if (data.customerId === undefined) {
        ctx.addIssue({ code: "custom", path: ["customerId"], message: "Una venta a crédito necesita un cliente" });
      }
      if (data.paymentMethod !== undefined) {
        ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Una venta a crédito no lleva medio de pago: se cobra después" });
      }
    } else if (data.paymentMethod === undefined) {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Elegí un medio de pago de la lista" });
    }
  });

// Para anular hace falta decir por qué: queda registrado junto con quién y cuándo (D13-h).
export const annulInputSchema = z.object({
  reason: z
    .string({ error: "El motivo de la anulación es obligatorio" })
    .trim()
    .min(1, "El motivo de la anulación es obligatorio")
    .max(500, "El motivo puede tener hasta 500 caracteres"),
});

// Filtros del historial: /api/sales?status=ANNULLED&paymentMethod=CASH&limit=20
export const saleListQuerySchema = z.object({
  status: z.enum(["CONFIRMED", "ANNULLED"], { error: 'El estado debe ser "CONFIRMED" o "ANNULLED"' }).optional(),
  paymentMethod: paymentMethod.optional(),
  customerId: z.coerce.number({ error: "El cliente no es válido" }).int().positive().optional(),
  onCredit: z
    .enum(["true", "false"], { error: 'El filtro onCredit debe ser "true" o "false"' })
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number({ error: "El límite no es válido" }).int().min(1).max(200).default(50),
});

export type SaleInput = z.infer<typeof saleInputSchema>;
export type AnnulInput = z.infer<typeof annulInputSchema>;
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;
