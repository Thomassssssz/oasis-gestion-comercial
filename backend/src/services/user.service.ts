import type { z } from "zod";
import { conflict } from "../helpers/errors.js";
import type { PrismaClient } from "../config/prisma.js";
import { hasPrismaCode } from "../helpers/prisma-errors.js";
import { hashPassword } from "../helpers/password.js";
import { createUserSchema } from "../validators/user.validator.js";

export type CreateUserInput = z.input<typeof createUserSchema>;

// Crea un usuario nuevo. No hay registro público: esto solo lo usa el script de línea de comandos.
// Valida los datos, guarda solo el hash de la contraseña y avisa si el usuario ya existe.
export async function createUserAccount(prisma: PrismaClient, input: CreateUserInput) {
  const { username, fullName, password } = createUserSchema.parse(input);

  try {
    const user = await prisma.user.create({
      data: { username, fullName, passwordHash: await hashPassword(password) },
    });
    return { id: user.id, username: user.username, fullName: user.fullName };
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) throw conflict("Ya existe un usuario con ese nombre de usuario");
    throw error;
  }
}
