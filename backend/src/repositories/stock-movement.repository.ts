import type { PrismaClient } from "../config/prisma.js";
import type { MovementListQuery, StockMovementInput } from "../validators/stock-movement.validator.js";

// Cada movimiento se devuelve con el nombre del producto y de quien lo registró.
const withNames = {
  product: { select: { id: true, name: true } },
  user: { select: { id: true, fullName: true } },
} as const;

// Operaciones que el servicio puede hacer mientras el producto está bloqueado.
export type LockedProductOps = {
  // Stock actual (suma de las cantidades) y cantidad de movimientos que ya tiene.
  currentStock: () => Promise<{ stock: number; movements: number }>;
  create: (userId: number, data: StockMovementInput) => Promise<{ id: number }>;
};

// Acceso a datos: es la única capa de movimientos de stock que habla con la base.
export function createStockMovementRepository(prisma: PrismaClient) {
  return {
    findAll: ({ productId, limit }: MovementListQuery) =>
      prisma.stockMovement.findMany({
        where: productId === undefined ? {} : { productId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: withNames,
      }),

    findById: (id: number) => prisma.stockMovement.findUnique({ where: { id }, include: withNames }),

    // Corre `work` en una transacción con la fila del producto bloqueada (FOR UPDATE).
    // Si otra operación está registrando un movimiento del mismo producto, esta espera a que termine:
    // así dos ajustes simultáneos no pueden dejar el stock en negativo (D12).
    // Devuelve null si el producto no existe.
    async withLockedProduct<T>(productId: number, work: (ops: LockedProductOps) => Promise<T>): Promise<T | null> {
      return prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
        if (locked.length === 0) return null;

        return work({
          currentStock: async () => {
            const total = await tx.stockMovement.aggregate({
              where: { productId },
              _sum: { quantity: true },
              _count: true,
            });
            return { stock: total._sum.quantity ?? 0, movements: total._count };
          },
          create: (userId, data) =>
            tx.stockMovement.create({
              data: {
                productId,
                userId,
                type: data.type,
                quantity: data.quantity,
                reason: data.type === "ADJUSTMENT" ? data.reason : null,
                note: data.note ?? null,
              },
              select: { id: true },
            }),
        });
      });
    },
  };
}

export type StockMovementRepository = ReturnType<typeof createStockMovementRepository>;
export type StockMovementRecord = NonNullable<Awaited<ReturnType<StockMovementRepository["findById"]>>>;
