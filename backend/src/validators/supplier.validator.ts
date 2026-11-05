import { z } from "zod";
import { optionalText, phoneSchema } from "./common.validator.js";

// Email opcional: se recorta; si queda vacío es "sin dato" y recién después se valida el formato (D15-c).
const emailSchema = z
  .string({ error: "El email no es válido" })
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .pipe(z.email("El email no es válido").max(254, "El email puede tener hasta 254 caracteres").nullable());

// Datos para crear un proveedor. Solo el nombre es obligatorio (D15-a).
export const supplierInputSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(150, "El nombre puede tener hasta 150 caracteres"),
  phone: phoneSchema,
  email: emailSchema,
  address: optionalText("La dirección", 200),
  notes: optionalText("Las observaciones", 500),
});

// Para editar se envían todos los datos, más si el proveedor está activo o dado de baja.
export const supplierUpdateSchema = supplierInputSchema.extend({
  active: z.boolean({ error: "Indicá si el proveedor está activo" }),
});

// Filtros opcionales del listado: /api/suppliers?search=papel&active=true
export const supplierListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  active: z
    .enum(["true", "false"], { error: 'El filtro active debe ser "true" o "false"' })
    .transform((value) => value === "true")
    .optional(),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>;
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;
