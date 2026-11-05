import { Prisma, type PrismaClient } from "../config/prisma.js";
import { dueDateFor, type AccountMovements } from "../helpers/credit.js";
import { totalOf } from "../helpers/sale-total.js";

type Tx = Prisma.TransactionClient;

// Consultas de las fichas que se hacen DENTRO de una transacción ya abierta (por ejemplo, al registrar o anular
// una venta a crédito). Reciben el cliente de la transacción para que todo se guarde junto o no se guarde nada.
export function accountQueries(tx: Tx) {
  return {
    // Bloquea la ficha hasta que termine la transacción: dos operaciones sobre la misma ficha se hacen una después de la otra.
    lock: (id: number) => tx.$queryRaw`SELECT "id" FROM "CreditAccount" WHERE "id" = ${id} FOR UPDATE`,

    findOpenFor: async (customerId: number) =>
      (await tx.creditAccount.findFirst({ where: { customerId, status: "OPEN" }, select: { id: true } }))?.id ?? null,

    // Abre la ficha: el primer producto a crédito inicia el plazo de un mes (D17-b).
    open: async (customerId: number, openedAt: Date) =>
      (await tx.creditAccount.create({ data: { customerId, openedAt, dueDate: dueDateFor(openedAt) }, select: { id: true } })).id,

    close: (id: number, closedAt: Date) =>
      tx.creditAccount.update({ where: { id }, data: { status: "CANCELLED", closedAt } }),

    // Todo lo que mueve el saldo de la ficha, listo para los cálculos de helpers/credit.ts.
    movements: async (accountId: number): Promise<AccountMovements> => {
      const sales = await tx.sale.findMany({
        where: { creditAccountId: accountId },
        select: { createdAt: true, annulledAt: true, discountAmount: true, items: { select: { quantity: true, unitPrice: true } } },
      });
      return {
        sales: sales.map((sale) => ({
          total: totalOf(sale.items, sale.discountAmount),
          createdAt: sale.createdAt,
          annulledAt: sale.annulledAt,
        })),
        payments: [],
        surcharges: [],
      };
    },
  };
}

export type AccountQueries = ReturnType<typeof accountQueries>;

const accountInclude = {
  customer: { select: { id: true, name: true } },
  sales: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      annulledAt: true,
      discountAmount: true,
      note: true,
      items: { select: { quantity: true, unitPrice: true } },
    },
  },
} as const satisfies Prisma.CreditAccountInclude;

// Acceso a datos de las fichas de cuenta corriente: es la única capa que las consulta fuera de una venta.
export function createCreditAccountRepository(prisma: PrismaClient) {
  return {
    findAll: ({ status, customerId }: { status?: "OPEN" | "CANCELLED"; customerId?: number }) =>
      prisma.creditAccount.findMany({
        where: { ...(status && { status }), ...(customerId && { customerId }) },
        // Las abiertas, primero las que vencen antes; el historial, primero las cerradas más recientes.
        orderBy: status === "CANCELLED" ? [{ closedAt: "desc" }, { id: "desc" }] : [{ dueDate: "asc" }, { id: "asc" }],
        include: accountInclude,
      }),

    findById: (id: number) => prisma.creditAccount.findUnique({ where: { id }, include: accountInclude }),
  };
}

export type CreditAccountRepository = ReturnType<typeof createCreditAccountRepository>;
export type CreditAccountRecord = NonNullable<Awaited<ReturnType<CreditAccountRepository["findById"]>>>;
