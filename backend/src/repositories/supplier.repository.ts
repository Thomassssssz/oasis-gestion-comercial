import type { PrismaClient } from "../config/prisma.js";
import type { SupplierInput, SupplierListQuery, SupplierUpdate } from "../validators/supplier.validator.js";

// Acceso a datos: es la única capa de proveedores que habla con la base.
export function createSupplierRepository(prisma: PrismaClient) {
  return {
    findAll: ({ search, active }: SupplierListQuery) =>
      prisma.supplier.findMany({
        where: {
          // El buscador mira el nombre, el email y el teléfono (D15-d).
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }),
          ...(active !== undefined && { active }),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    findById: (id: number) => prisma.supplier.findUnique({ where: { id } }),
    create: (data: SupplierInput) => prisma.supplier.create({ data }),
    update: (id: number, data: SupplierUpdate) => prisma.supplier.update({ where: { id }, data }),
  };
}

export type SupplierRepository = ReturnType<typeof createSupplierRepository>;
