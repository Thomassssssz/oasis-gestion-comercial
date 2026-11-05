import type { PrismaClient } from "../config/prisma.js";
import type { CustomerInput, CustomerListQuery, CustomerUpdate } from "../validators/customer.validator.js";

// Acceso a datos: es la única capa de clientes que habla con la base.
export function createCustomerRepository(prisma: PrismaClient) {
  return {
    findAll: ({ search, active, creditAuthorized }: CustomerListQuery) =>
      prisma.customer.findMany({
        where: {
          // El buscador mira el nombre, el DNI y el teléfono (D14-g).
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { dni: { contains: search } },
              { phone: { contains: search } },
            ],
          }),
          ...(active !== undefined && { active }),
          ...(creditAuthorized !== undefined && { creditAuthorized }),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    findById: (id: number) => prisma.customer.findUnique({ where: { id } }),
    create: (data: CustomerInput) => prisma.customer.create({ data }),
    update: (id: number, data: CustomerUpdate) => prisma.customer.update({ where: { id }, data }),
  };
}

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;
