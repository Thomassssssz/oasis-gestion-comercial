import { z } from "zod";

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

export type SettingInput = z.infer<typeof settingInputSchema>;
