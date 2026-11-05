import { Prisma, type PrismaClient } from "../config/prisma.js";
import { dueDateFor, type AccountMovements } from "../helpers/credit.js";
import { totalOf } from "../helpers/sale-total.js";
import { SETTINGS_ID } from "./setting.repository.js";

type Tx = Prisma.TransactionClient;
type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "DIGITAL_WALLET";

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
      const [payments, surcharges] = await Promise.all([
        tx.accountPayment.findMany({ where: { accountId }, select: { amount: true, createdAt: true } }),
        tx.surcharge.findMany({ where: { accountId }, select: { monthNumber: true, amount: true } }),
      ]);
      return {
        sales: sales.map((sale) => ({
          total: totalOf(sale.items, sale.discountAmount),
          createdAt: sale.createdAt,
          annulledAt: sale.annulledAt,
        })),
        payments,
        surcharges,
      };
    },

    find: (id: number) => tx.creditAccount.findUnique({ where: { id }, select: { id: true, status: true, dueDate: true } }),

    // Porcentaje de recargo vigente (parámetro configurable, D16). Si todavía no hay fila de parámetros, se crea con el valor por defecto.
    lateFeePercent: async () =>
      (await tx.setting.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID }, select: { lateFeePercent: true } }))
        .lateFeePercent,

    addPayment: (data: { accountId: number; userId: number; amount: Prisma.Decimal; paymentMethod: PaymentMethod; note: string | null; createdAt: Date }) =>
      tx.accountPayment.create({ data, select: { id: true } }),

    addSurcharge: (data: {
      accountId: number;
      userId: number;
      monthNumber: number;
      base: Prisma.Decimal;
      percent: Prisma.Decimal;
      amount: Prisma.Decimal;
      chargedOn: Date;
      createdAt: Date;
    }) => tx.surcharge.create({ data, select: { id: true } }),
  };
}

export type AccountQueries = ReturnType<typeof accountQueries>;

const accountInclude = {
  customer: { select: { id: true, name: true } },
  payments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, amount: true, paymentMethod: true, note: true, createdAt: true, user: { select: { fullName: true } } },
  },
  surcharges: {
    orderBy: { monthNumber: "asc" },
    select: { monthNumber: true, base: true, percent: true, amount: true, chargedOn: true, createdAt: true },
  },
  sales: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      annulledAt: true,
      discountAmount: true,
      note: true,
      items: { orderBy: { id: "asc" }, select: { quantity: true, unitPrice: true, product: { select: { name: true } } } },
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

    // Solo cambia los números del remito: la ficha, sus movimientos y su saldo no se tocan (D23).
    updateRemito: (id: number, data: { number: string | null; remitoNumber: string | null }) =>
      prisma.creditAccount.update({ where: { id }, data, include: accountInclude }),

    lateFeePercent: () => prisma.$transaction((tx) => accountQueries(tx).lateFeePercent()),

    // Corre `work` en una transacción con la ficha bloqueada: dos pagos o recargos sobre la misma ficha
    // se hacen uno después del otro, y si algo falla no se guarda nada (todo o nada).
    withLockedAccount: <T>(accountId: number, work: (ops: AccountQueries) => Promise<T>) =>
      prisma.$transaction(async (tx) => {
        const ops = accountQueries(tx);
        await ops.lock(accountId);
        return work(ops);
      }),
  };
}

export type CreditAccountRepository = ReturnType<typeof createCreditAccountRepository>;
export type CreditAccountRecord = NonNullable<Awaited<ReturnType<CreditAccountRepository["findById"]>>>;
