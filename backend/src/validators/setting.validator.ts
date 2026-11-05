import { z } from "zod";
import { cuitSchema, optionalText, taxConditionSchema } from "./common.validator.js";

// El porcentaje se recibe como texto ("5" o "7.5") o número: de 0 a 100 con hasta 2 decimales. Nunca se opera como float.
const percentSchema = z
  .union([z.string(), z.number()], { error: "El porcentaje de recargo es obligatorio" })
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, "El porcentaje debe ser un número con hasta 2 decimales")
      .refine((value) => Number(value) <= 100, "El porcentaje no puede ser mayor que 100"),
  );

// Se envían todos los parámetros juntos (hoy es uno solo).
export const settingInputSchema = z.object({
  lateFeePercent: percentSchema,
});

// Fecha "AAAA-MM-DD" que existe de verdad (no acepta 2020-02-31). Vacía es "sin dato".
const activityStartSchema = z
  .string({ error: "La fecha de inicio de actividades no es válida" })
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio de actividades debe tener el formato AAAA-MM-DD")
      .refine((value) => {
        // Si el formato ya falló, esta comprobación no corre en serio: `Date` inválido no se puede convertir a texto.
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
      }, "La fecha de inicio de actividades no existe")
      .nullable(),
  );

// Datos del comercio que se imprimen en el encabezado del remito (D23). Todos opcionales; se envían todos juntos.
export const businessSettingSchema = z.object({
  name: optionalText("El nombre del comercio", 100),
  owner: optionalText("El titular", 100),
  address: optionalText("El domicilio", 300),
  taxCondition: taxConditionSchema,
  cuit: cuitSchema,
  grossIncome: optionalText("Ingresos Brutos", 30),
  activityStart: activityStartSchema,
});

export type SettingInput = z.infer<typeof settingInputSchema>;
export type BusinessSettingInput = z.infer<typeof businessSettingSchema>;
