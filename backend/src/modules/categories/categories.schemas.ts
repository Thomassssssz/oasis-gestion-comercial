import { z } from "zod";

// Datos que llegan al crear o editar una categoría.
export const categoryInputSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(100, "El nombre puede tener hasta 100 caracteres"),
});

// El :id de la URL llega como texto; se convierte y valida como entero positivo.
export const idParamSchema = z.object({
  id: z.coerce.number({ error: "El identificador no es válido" }).int("El identificador no es válido").positive("El identificador no es válido"),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
