import type { PrismaClient } from "../../lib/prisma.js";
import type { ListQuery, ProductInput, ProductUpdate } from "./products.schemas.js";

// Cada producto se devuelve con el nombre de su categoría.
const withCategory = { category: { select: { id: true, name: true } } } as const;

// Acceso a datos: es la única capa de productos que habla con la base.
export function createProductsRepository(prisma: PrismaClient) {
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
    findById: (id: number) => prisma.product.findUnique({ where: { id }, include: withCategory }),
    create: (data: ProductInput) => prisma.product.create({ data, include: withCategory }),
    update: (id: number, data: ProductUpdate) =>
      prisma.product.update({ where: { id }, data, include: withCategory }),
  };
}

export type ProductsRepository = ReturnType<typeof createProductsRepository>;
export type ProductRecord = NonNullable<Awaited<ReturnType<ProductsRepository["findById"]>>>;
