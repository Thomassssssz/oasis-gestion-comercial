import { z } from "zod";

// El nombre de usuario se normaliza a minúsculas: "Ana" y "ana" son la misma persona.
export const loginSchema = z.object({
  username: z.string({ error: "El usuario es obligatorio" }).trim().toLowerCase().min(1, "El usuario es obligatorio"),
  password: z
    .string({ error: "La contraseña es obligatoria" })
    .min(1, "La contraseña es obligatoria")
    .max(200, "La contraseña es demasiado larga"),
});

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

// Reglas para una contraseña nueva. Largo mínimo 10: un largo razonable pesa más que símbolos raros.
export const newPasswordSchema = z
  .string({ error: "La contraseña nueva es obligatoria" })
  .min(MIN_PASSWORD_LENGTH, `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, `La contraseña nueva puede tener hasta ${MAX_PASSWORD_LENGTH} caracteres`);

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Falta la contraseña actual" }).min(1, "Falta la contraseña actual"),
  newPassword: newPasswordSchema,
});
