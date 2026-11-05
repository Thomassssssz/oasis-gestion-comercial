import { Prisma, type PrismaClient } from "../config/prisma.js";
import type { SaleListQuery } from "../validators/sale.validator.js";
import { accountQueries, type AccountQueries } from "./credit-account.repository.js";

type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "DIGITAL_WALLET";

// Cada venta se devuelve con sus ítems (con el nombre del producto) y los nombres de quien la registró y la anuló.
const withDetails = {
  items: {
    orderBy: { id: "asc" },
    select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true } } },
  },
  user: { select: { fullName: true } },
  annulledBy: { select: { fullName: true } },
  customer: { select: { id: true, name: true } },
} as const;

export type NewSaleData = {
  userId: number;
  // Una venta al contado tiene medio de pago; una venta a crédito no (se cobra después) y siempre tiene cliente y ficha (D17).
  paymentMethod: PaymentMethod | null;
  customerId: number | null;
  discountAmount: Prisma.Decimal;
  note: string | null;
  onCredit: boolean;
  creditAccountId: number | null;
  createdAt: Date;
  items: { productId: number; quantity: number; unitPrice: Prisma.Decimal }[];
};

// Operaciones que el servicio puede hacer mientras los productos de la venta están bloqueados.
export type LockedProductsOps = {
  products: () => Promise<{ id: number; name: string; salePrice: Prisma.Decimal; active: boolean }[]>;
  // Stock actual de cada producto (id -> unidades). Los que no tienen movimientos no aparecen: stock 0.
  stocks: () => Promise<Map<number, number>>;
  // El cliente de la venta (para comprobar que existe, está activo y puede comprar a crédito).
  customer: (id: number) => Promise<{ id: number; name: string; active: boolean; creditAuthorized: boolean } | null>;
  // Consultas de las fichas de cuenta corriente dentro de esta misma transacción.
  account: AccountQueries;
  // Crea la venta, sus ítems y un movimiento de stock negativo por ítem. Devuelve el id de la venta.
  createSale: (data: NewSaleData) => Promise<number>;
  saleStatus: (saleId: number) => Promise<"CONFIRMED" | "ANNULLED" | null>;
  // Marca la venta como anulada y devuelve cada ítem al stock con un movimiento positivo.
  annulSale: (saleId: number, userId: number, reason: string, at: Date) => Promise<void>;
};

// Acceso a datos: es la única capa de ventas que habla con la base.
export function createSaleRepository(prisma: PrismaClient) {
  return {
    findAll: ({ status, paymentMethod, customerId, onCredit, limit }: SaleListQuery) =>
      prisma.sale.findMany({
        where: {
          ...(status && { status }),
          ...(paymentMethod && { paymentMethod }),
          ...(customerId && { customerId }),
          ...(onCredit !== undefined && { onCredit }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: withDetails,
      }),

    findById: (id: number) => prisma.sale.findUnique({ where: { id }, include: withDetails }),

    // Corre `work` en una transacción con las filas de esos productos bloqueadas (FOR UPDATE, en orden de id
    // para evitar bloqueos cruzados). Así dos ventas o anulaciones al mismo tiempo sobre los mismos productos
    // se hacen una después de la otra y nunca se vende dos veces el mismo stock (D13).
    //
    // Orden fijo de bloqueos para no trabarse entre operaciones: primero el cliente (solo al vender a crédito),
    // después la ficha y por último los productos.
    withLockedProducts<T>(
      productIds: number[],
      work: (ops: LockedProductsOps) => Promise<T>,
      lock: { customerId?: number; accountId?: number } = {},
    ): Promise<T> {
      const ids = [...new Set(productIds)].sort((a, b) => a - b);

      return prisma.$transaction(async (tx) => {
        if (lock.customerId !== undefined) await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${lock.customerId} FOR UPDATE`;
        const account = accountQueries(tx);
        if (lock.accountId !== undefined) await account.lock(lock.accountId);
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;

        return work({
          account,

          customer: (id) => tx.customer.findUnique({ where: { id }, select: { id: true, name: true, active: true, creditAuthorized: true } }),

          products: () => tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, salePrice: true, active: true } }),

          stocks: async () => {
            const totals = await tx.stockMovement.groupBy({
              by: ["productId"],
              where: { productId: { in: ids } },
              _sum: { quantity: true },
            });
            return new Map(totals.map((row) => [row.productId, row._sum.quantity ?? 0]));
          },

          createSale: async ({ items, ...data }) => {
            const sale = await tx.sale.create({
              data: {
                ...data,
                items: { create: items },
              },
              select: { id: true },
            });
            await tx.stockMovement.createMany({
              data: items.map((item) => ({
                productId: item.productId,
                userId: data.userId,
                type: "SALE" as const,
                quantity: -item.quantity,
                saleId: sale.id,
              })),
            });
            return sale.id;
          },

          saleStatus: async (saleId) => (await tx.sale.findUnique({ where: { id: saleId }, select: { status: true } }))?.status ?? null,

          annulSale: async (saleId, userId, reason, at) => {
            const items = await tx.saleItem.findMany({ where: { saleId }, select: { productId: true, quantity: true } });
            await tx.sale.update({
              where: { id: saleId },
              data: { status: "ANNULLED", annulledAt: at, annulledById: userId, annulmentReason: reason },
            });
            await tx.stockMovement.createMany({
              data: items.map((item) => ({
                productId: item.productId,
                userId,
                type: "SALE_ANNULMENT" as const,
                quantity: item.quantity,
                saleId,
              })),
            });
          },
        });
      });
    },
  };
}

export type SaleRepository = ReturnType<typeof createSaleRepository>;
export type SaleRecord = NonNullable<Awaited<ReturnType<SaleRepository["findById"]>>>;
