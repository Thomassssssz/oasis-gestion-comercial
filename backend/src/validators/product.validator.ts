import { z } from "zod";

// El precio se recibe como texto ("1234.50") o número y se valida como importe en pesos:
// hasta 10 dígitos enteros y 2 decimales. Nunca se opera como float.
const priceSchema = z
  .union([z.string(), z.number()], { error: "El precio es obligatorio" })
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, "El precio debe ser un importe válido con hasta 2 decimales")
      .refine((value) => Number(value) > 0, "El precio debe ser mayor que cero"),
  );

// Datos para crear un producto. Siempre nace activo.
export const productInputSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(150, "El nombre puede tener hasta 150 caracteres"),
  categoryId: z
    .number({ error: "La categoría es obligatoria" })
    .int("La categoría no es válida")
    .positive("La categoría no es válida"),
  salePrice: priceSchema,
  minStock: z
    .number({ error: "El stock mínimo debe ser un número" })
    .int("El stock mínimo debe ser un número entero")
    .min(0, "El stock mínimo no puede ser negativo")
    .default(0),
});

// Para editar se envían todos los datos, más si el producto está activo o dado de baja.
export const productUpdateSchema = productInputSchema.extend({
  active: z.boolean({ error: "Indicá si el producto está activo" }),
});

// Filtros opcionales del listado: /api/products?search=lapi&categoryId=2&active=true
export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number({ error: "La categoría no es válida" }).int().positive().optional(),
  active: z.enum(["true", "false"], { error: 'El filtro active debe ser "true" o "false"' }).transform((v) => v === "true").optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
