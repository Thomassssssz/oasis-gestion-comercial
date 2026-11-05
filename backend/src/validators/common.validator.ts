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

// Condición frente al IVA (D23). Vacío o ausente significa "sin dato".
export const taxConditionSchema = z
  .enum(["CONSUMER", "EXEMPT", "REGISTERED", "MONOTAX"], { error: "La condición frente al IVA no es válida" })
  .nullish()
  .transform((value) => value ?? null);

// CUIT: se escribe con o sin guiones ("20-12345678-9") y se guarda solo con sus 11 dígitos. Vacío es "sin dato".
// No se verifica el dígito verificador: el dato lo carga el comercio y se imprime tal cual (D23).
export const cuitSchema = z
  .string({ error: "El CUIT no es válido" })
  .transform((value) => value.replace(/[-.\s]/g, ""))
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .pipe(z.string().regex(/^\d{11}$/, "El CUIT debe tener 11 dígitos").nullable());

// Teléfono libre con formato básico (D14-f): dígitos, espacios, +, -, y paréntesis.
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

// Importes en pesos: se reciben como texto ("1234.50") o número, con hasta 10 dígitos enteros y 2 decimales.
// Nunca se operan como float: se guardan y calculan como Decimal.
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

function amountSchema(label: string) {
  return z
    .union([z.string(), z.number()], { error: `${label} es obligatorio` })
    .transform((value) => String(value).trim())
    .pipe(z.string().regex(AMOUNT_PATTERN, `${label} debe ser un importe válido con hasta 2 decimales`));
}

// Importe mayor que cero (por ejemplo, un pago).
export const positiveAmountSchema = (label: string) =>
  amountSchema(label).refine((value) => Number(value) > 0, `${label} debe ser mayor que cero`);

// Importe de cero en adelante (por ejemplo, un descuento: 0 significa sin descuento).
export const nonNegativeAmountSchema = (label: string) => amountSchema(label);
