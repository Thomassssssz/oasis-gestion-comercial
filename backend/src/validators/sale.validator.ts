import { z } from "zod";

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

// Datos para registrar una venta rápida.
export const saleInputSchema = z
  .object({
    paymentMethod,
    items: z
      .array(itemSchema, { error: "Los productos de la venta son obligatorios" })
      .min(1, "La venta necesita al menos un producto")
      .max(100, "Una venta puede tener hasta 100 productos distintos"),
  })
  .refine((data) => new Set(data.items.map((item) => item.productId)).size === data.items.length, {
    message: "Un producto no puede repetirse en la misma venta",
    path: ["items"],
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
  limit: z.coerce.number({ error: "El límite no es válido" }).int().min(1).max(200).default(50),
});

export type SaleInput = z.infer<typeof saleInputSchema>;
export type AnnulInput = z.infer<typeof annulInputSchema>;
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;
