import { z } from "zod";

// El :id de la URL llega como texto; se convierte y valida como entero positivo.
const INVALID_ID = "El identificador no es válido";

export const idParamSchema = z.object({
  id: z.coerce.number({ error: INVALID_ID }).int(INVALID_ID).positive(INVALID_ID),
});

// Un texto opcional: se recortan los espacios y, si queda vacío, se trata como "sin dato" (null).
export const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label} no es válido` })
    .trim()
    .max(max, `${label} puede tener hasta ${max} caracteres`)
    .transform((value) => (value === "" ? null : value))
    .nullish()
    .transform((value) => value ?? null);

// Teléfono libre con formato básico (D14-f, D15-b): dígitos, espacios, +, -, y paréntesis.
// Primero se limpia (si queda vacío es "sin dato") y recién después se valida el formato.
export const phoneSchema = z
  .string({ error: "El teléfono no es válido" })
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .pipe(
    z
      .string()
      .regex(/^[0-9+()\s-]{6,30}$/, "El teléfono solo puede tener números, espacios, +, - y paréntesis (de 6 a 30 caracteres)")
      .nullable(),
  );
