import type { Prisma, PrismaClient } from "../config/prisma.js";

type NewEntry = { userId: number; action: string; entityType: string; entityId: number | null; summary: string };
type Filters = { userId?: number; action?: string; entityType?: string; from?: Date; toExclusive?: Date; limit: number };

// Acceso a datos del registro de auditoría. Solo se agrega y se consulta: no hay forma de editar ni borrar.
export function createAuditRepository(prisma: PrismaClient) {
  return {
    create: (data: NewEntry) => prisma.auditLog.create({ data, select: { id: true } }),

    findAll: ({ userId, action, entityType, from, toExclusive, limit }: Filters) => {
      const where: Prisma.AuditLogWhereInput = {
        ...(userId !== undefined && { userId }),
        ...(action && { action }),
        ...(entityType && { entityType }),
        ...((from || toExclusive) && { createdAt: { ...(from && { gte: from }), ...(toExclusive && { lt: toExclusive }) } }),
      };
      return prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: { user: { select: { fullName: true } } },
      });
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
