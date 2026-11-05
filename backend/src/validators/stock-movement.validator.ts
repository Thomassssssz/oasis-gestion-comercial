import { z } from "zod";

const productId = z
  .number({ error: "El producto es obligatorio" })
  .int("El producto no es válido")
  .positive("El producto no es válido");

// Las cantidades son siempre unidades enteras (D6).
const wholeNumber = z.number({ error: "La cantidad debe ser un número" }).int("La cantidad debe ser un número entero");

// La nota es opcional; si llega vacía o solo con espacios, se trata como que no hay nota.
const note = z
  .string({ error: "La nota no es válida" })
  .trim()
  .max(500, "La nota puede tener hasta 500 caracteres")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// Carga del stock que el comercio ya tiene al empezar: siempre una entrada (D12-b, D12-e).
const initialStockSchema = z.object({
  type: z.literal("INITIAL_STOCK"),
  productId,
  quantity: wholeNumber.positive("El stock inicial debe ser mayor que cero"),
  note,
});

// Ajuste manual: cantidad a sumar (positiva) o restar (negativa), con motivo de la lista fija (D7, D12-c).
const adjustmentSchema = z
  .object({
    type: z.literal("ADJUSTMENT"),
    productId,
    quantity: wholeNumber.refine((value) => value !== 0, "La cantidad del ajuste no puede ser cero"),
    reason: z.enum(["PHYSICAL_COUNT", "DAMAGE_OR_LOSS", "SUPPLIER_RETURN", "OTHER"], {
      error: "Elegí un motivo de la lista",
    }),
    note,
  })
  .refine((data) => data.reason !== "OTHER" || data.note !== undefined, {
    message: 'Con el motivo "otro" tenés que escribir una nota',
    path: ["note"],
  });

export const stockMovementInputSchema = z.discriminatedUnion(
  "type",
  [initialStockSchema, adjustmentSchema],
  { error: "El tipo de movimiento no es válido" },
);

// Filtros del historial: /api/stock-movements?productId=3&limit=20
export const movementListQuerySchema = z.object({
  productId: z.coerce.number({ error: "El producto no es válido" }).int().positive().optional(),
  limit: z.coerce.number({ error: "El límite no es válido" }).int().min(1).max(200).default(50),
});

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;
