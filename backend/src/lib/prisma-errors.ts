import { Prisma } from "../generated/prisma/client.js";

// Códigos de error de Prisma que nos interesa traducir a respuestas de la API.
// P2002: se violó una restricción única. P2003: falla una clave foránea. P2025: no existe el registro.
export function hasPrismaCode(error: unknown, code: "P2002" | "P2003" | "P2025") {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
