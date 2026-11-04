import type { PrismaClient } from "../../lib/prisma.js";

// Acceso a datos: es la única capa de categorías que habla con la base.
export function createCategoriesRepository(prisma: PrismaClient) {
  return {
    findAll: () => prisma.category.findMany({ orderBy: { name: "asc" } }),
    findById: (id: number) => prisma.category.findUnique({ where: { id } }),
    create: (name: string) => prisma.category.create({ data: { name } }),
    update: (id: number, name: string) => prisma.category.update({ where: { id }, data: { name } }),
    remove: (id: number) => prisma.category.delete({ where: { id } }),
    countProducts: (id: number) => prisma.product.count({ where: { categoryId: id } }),
  };
}

export type CategoriesRepository = ReturnType<typeof createCategoriesRepository>;
