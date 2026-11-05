import type { PrismaClient } from "../config/prisma.js";

// Acceso a datos de usuarios y sesiones: la única capa de auth que habla con la base.
export function createAuthRepository(prisma: PrismaClient) {
  return {
    findUserByUsername: (username: string) => prisma.user.findUnique({ where: { username } }),
    findUserById: (id: number) => prisma.user.findUnique({ where: { id } }),
    updatePasswordHash: (id: number, passwordHash: string) =>
      prisma.user.update({ where: { id }, data: { passwordHash } }),

    createSession: (userId: number, tokenHash: string, expiresAt: Date) =>
      prisma.session.create({ data: { userId, tokenHash, expiresAt } }),
    findSession: (tokenHash: string) =>
      prisma.session.findUnique({ where: { tokenHash }, include: { user: true } }),
    deleteSession: (tokenHash: string) => prisma.session.deleteMany({ where: { tokenHash } }),
    deleteExpiredSessions: (userId: number, now: Date) =>
      prisma.session.deleteMany({ where: { userId, expiresAt: { lt: now } } }),
    // Cierra todas las sesiones de un usuario menos la actual (se usa al cambiar la contraseña).
    deleteOtherSessions: (userId: number, keepTokenHash: string) =>
      prisma.session.deleteMany({ where: { userId, tokenHash: { not: keepTokenHash } } }),
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
