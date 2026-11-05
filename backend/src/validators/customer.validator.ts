import { z } from "zod";
import { cuitSchema, optionalText, phoneSchema, taxConditionSchema } from "./common.validator.js";

// El DNI se escribe con o sin puntos ("30.123.456") y se guarda solo con dígitos. Tiene 7 u 8 dígitos (D14-d).
// Primero se limpia (sin puntos ni espacios; si queda vacío es "sin dato") y recién después se valida el formato.
const dniSchema = z
  .string({ error: "El DNI no es válido" })
  .transform((value) => value.replace(/[.\s]/g, ""))
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .pipe(z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos").nullable());

// Datos para crear un cliente. Solo el nombre es obligatorio (D14-a). Por defecto no tiene crédito autorizado (D14-b).
export const customerInputSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(150, "El nombre puede tener hasta 150 caracteres"),
  phone: phoneSchema,
  dni: dniSchema,
  address: optionalText("La dirección", 200),
  locality: optionalText("La localidad", 100),
  taxCondition: taxConditionSchema,
  cuit: cuitSchema,
  notes: optionalText("Las observaciones", 500),
  creditAuthorized: z.boolean({ error: "Indicá si está autorizado a comprar a crédito" }).default(false),
});

// Para editar se envían todos los datos, más si el cliente está activo o dado de baja.
export const customerUpdateSchema = customerInputSchema.extend({
  active: z.boolean({ error: "Indicá si el cliente está activo" }),
});

// Filtros opcionales del listado: /api/customers?search=perez&active=true&creditAuthorized=true
const booleanFilter = (name: string) =>
  z.enum(["true", "false"], { error: `El filtro ${name} debe ser "true" o "false"` }).transform((v) => v === "true").optional();

export const customerListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  active: booleanFilter("active"),
  creditAuthorized: booleanFilter("creditAuthorized"),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
