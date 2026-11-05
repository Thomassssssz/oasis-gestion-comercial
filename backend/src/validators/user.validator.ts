import { z } from "zod";
import { newPasswordSchema } from "./auth.validator.js";

// Datos para crear un usuario (se usa desde el script de línea de comandos).
export const createUserSchema = z
  .object({
    username: z
      .string({ error: "El usuario es obligatorio" })
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9._-]{3,30}$/,
        "El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo",
      ),
    fullName: z
      .string({ error: "El nombre completo es obligatorio" })
      .trim()
      .min(1, "El nombre completo es obligatorio")
      .max(100, "El nombre completo puede tener hasta 100 caracteres"),
    password: newPasswordSchema,
  })
  .refine((data) => data.password.toLowerCase() !== data.username, {
    message: "La contraseña no puede ser igual al usuario",
    path: ["password"],
  });
