import type { PrismaClient } from "../config/prisma.js";
import type { ListQuery, ProductInput, ProductUpdate } from "../validators/product.validator.js";

// Cada producto se devuelve con el nombre de su categoría.
const withCategory = { category: { select: { id: true, name: true } } } as const;

// Acceso a datos: es la única capa de productos que habla con la base.
export function createProductRepository(prisma: PrismaClient) {
  return {
    findAll: ({ search, categoryId, active }: ListQuery) =>
      prisma.product.findMany({
        where: {
          ...(search && { name: { contains: search, mode: "insensitive" as const } }),
          ...(categoryId !== undefined && { categoryId }),
          ...(active !== undefined && { active }),
        },
        orderBy: { name: "asc" },
        include: withCategory,
      }),
    // Stock actual de cada producto: la suma de las cantidades de sus movimientos (D1).
    // Devuelve un mapa id -> stock; los productos sin movimientos no aparecen (su stock es 0).
    async stockByProduct(productIds: number[]) {
      if (productIds.length === 0) return new Map<number, number>();
      const totals = await prisma.stockMovement.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
      });
      return new Map(totals.map((row) => [row.productId, row._sum.quantity ?? 0]));
    },
    findById: (id: number) => prisma.product.findUnique({ where: { id }, include: withCategory }),
    create: (data: ProductInput) => prisma.product.create({ data, include: withCategory }),
    update: (id: number, data: ProductUpdate) =>
      prisma.product.update({ where: { id }, data, include: withCategory }),
  };
}

export type ProductRepository = ReturnType<typeof createProductRepository>;
export type ProductRecord = NonNullable<Awaited<ReturnType<ProductRepository["findById"]>>>;
