import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/services/seed.service.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { createUser } from "./helpers/users.js";

const prisma = createTestPrisma();
const NOW = new Date("2026-11-04T15:00:00.000Z");
const small = { products: 60, customers: 20, days: 75, now: NOW };

let userId: number;

beforeEach(async () => {
  await resetDatabase(prisma);
  userId = (await createUser(prisma)).id;
});
afterAll(() => prisma.$disconnect());

describe("seedDatabase", () => {
  it("crea la cantidad pedida de categorías, productos y clientes", async () => {
    const summary = await seedDatabase(prisma, { userId, ...small });

    expect(summary).toMatchObject({ categories: 12, products: 60, customers: 20 });
    expect(await prisma.category.count()).toBe(12);
    expect(await prisma.product.count()).toBe(60);
    expect(await prisma.customer.count()).toBe(20);
    expect(summary.creditCustomers).toBe(await prisma.customer.count({ where: { creditAuthorized: true } }));
  });

  it("genera actividad variada: ventas, pagos, anulaciones, fichas abiertas y canceladas", async () => {
    const summary = await seedDatabase(prisma, { userId, ...small });

    expect(summary.sales).toBeGreaterThan(300);
    expect(summary.payments).toBeGreaterThan(0);
    expect(summary.openAccounts).toBeGreaterThan(0);
    expect(summary.cancelledAccounts).toBeGreaterThan(0);
    expect(summary.annulled).toBeGreaterThan(0);
    expect(await prisma.sale.count()).toBe(summary.sales);
    expect(await prisma.sale.count({ where: { status: "ANNULLED" } })).toBe(summary.annulled);
    expect(await prisma.sale.count({ where: { onCredit: true } })).toBeGreaterThan(0);
    expect(await prisma.sale.count({ where: { customerId: { not: null }, onCredit: false } })).toBeGreaterThan(0);
    expect(await prisma.sale.count({ where: { discountAmount: { gt: 0 } } })).toBe(0); // el comercio ya no hace descuentos (D25)
  });

  it("hay fichas vencidas con recargos registrados y pagos parciales que no movieron el vencimiento", async () => {
    await seedDatabase(prisma, { userId, ...small });

    const overdue = await prisma.creditAccount.count({ where: { status: "OPEN", dueDate: { lt: NOW } } });
    expect(overdue).toBeGreaterThan(0);
    expect(await prisma.surcharge.count()).toBeGreaterThan(0);
    // Hay fichas pendientes que ya recibieron pagos parciales y siguen con su vencimiento original.
    expect(await prisma.creditAccount.count({ where: { status: "OPEN", payments: { some: {} } } })).toBeGreaterThan(0);

    const accounts = await prisma.creditAccount.findMany();
    for (const account of accounts) {
      // El vencimiento es siempre un mes después de la apertura, pase lo que pase con los pagos (D17-b, D18).
      const expected = new Date(account.openedAt);
      expected.setUTCMonth(expected.getUTCMonth() + 1);
      expect(Math.abs(account.dueDate.getTime() - expected.getTime())).toBeLessThanOrEqual(24 * 3600 * 1000);
    }
  });

  it("el stock de ningún producto queda negativo", async () => {
    await seedDatabase(prisma, { userId, ...small });

    const rows = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { quantity: true } });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row._sum.quantity!).toBeGreaterThanOrEqual(0);
  });

  it("las fechas son coherentes: nada es posterior a 'ahora' y los movimientos de venta llevan la hora de su venta", async () => {
    await seedDatabase(prisma, { userId, ...small });

    expect(await prisma.sale.count({ where: { createdAt: { gt: NOW } } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { createdAt: { gt: NOW } } })).toBe(0);
    expect(await prisma.accountPayment.count({ where: { createdAt: { gt: NOW } } })).toBe(0);

    const saleMovements = await prisma.stockMovement.findMany({ where: { type: "SALE" }, include: { sale: true } });
    expect(saleMovements.length).toBeGreaterThan(0);
    for (const movement of saleMovements) expect(movement.createdAt).toEqual(movement.sale!.createdAt);

    const annulments = await prisma.stockMovement.findMany({ where: { type: "SALE_ANNULMENT" }, include: { sale: true } });
    expect(annulments.length).toBeGreaterThan(0);
    for (const movement of annulments) expect(movement.createdAt).toEqual(movement.sale!.annulledAt);

    // El stock inicial es anterior a la primera venta.
    const firstSale = await prisma.sale.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    const initial = await prisma.stockMovement.findMany({ where: { type: "INITIAL_STOCK" } });
    for (const movement of initial) expect(movement.createdAt.getTime()).toBeLessThan(firstSale.createdAt.getTime());
  });

  it("ninguna ficha queda con saldo negativo y las canceladas tienen saldo cero", async () => {
    await seedDatabase(prisma, { userId, ...small });

    const accounts = await prisma.creditAccount.findMany({
      include: {
        payments: true,
        surcharges: true,
        sales: { include: { items: true } },
      },
    });
    for (const account of accounts) {
      let balance = 0;
      for (const sale of account.sales) {
        if (sale.status === "ANNULLED") continue;
        balance += sale.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0) - Number(sale.discountAmount);
      }
      balance += account.surcharges.reduce((sum, s) => sum + Number(s.amount), 0);
      balance -= account.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      expect(balance).toBeGreaterThanOrEqual(-0.005);
      if (account.status === "CANCELLED") expect(Math.abs(balance)).toBeLessThan(0.005);
    }
  });

  it("deja algunos productos y clientes dados de baja para probar los filtros", async () => {
    await seedDatabase(prisma, { userId, ...small });

    expect(await prisma.product.count({ where: { active: false } })).toBe(12);
    expect(await prisma.customer.count({ where: { active: false } })).toBe(2);
    expect(await prisma.customer.count({ where: { active: false, creditAuthorized: true } })).toBe(0);
  });

  it("hay productos con stock bajo y productos sin stock", async () => {
    await seedDatabase(prisma, { userId, ...small, products: 400 });

    const rows = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { quantity: true } });
    const withMovements = new Set(rows.map((r) => r.productId));
    expect(withMovements.size).toBeLessThan(400);
  });

  it("es repetible: con la misma semilla y la misma fecha da el mismo resumen", async () => {
    const first = await seedDatabase(prisma, { userId, ...small });
    await resetDatabase(prisma);
    userId = (await createUser(prisma)).id;

    const second = await seedDatabase(prisma, { userId, ...small });

    expect(second).toEqual(first);
  });

  it("todas las ventas, pagos y movimientos figuran a nombre del usuario indicado", async () => {
    const other = await createUser(prisma, { username: "beto", fullName: "Beto" });
    await seedDatabase(prisma, { userId: other.id, ...small });

    expect(await prisma.sale.count({ where: { userId: { not: other.id } } })).toBe(0);
    expect(await prisma.accountPayment.count({ where: { userId: { not: other.id } } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { userId: { not: other.id } } })).toBe(0);
  });

  it("no escribe nada en la auditoría (no pasa por la API)", async () => {
    await seedDatabase(prisma, { userId, ...small });

    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("rechaza un usuario que no existe, sin tocar la base", async () => {
    await expect(seedDatabase(prisma, { userId: 9999, ...small })).rejects.toThrow(/no existe/);

    expect(await prisma.product.count()).toBe(0);
  });

  it.each([
    ["una categoría", () => prisma.category.create({ data: { name: "Mía" } })],
    ["un cliente", () => prisma.customer.create({ data: { name: "Ana" } })],
  ])("se niega a correr si la base ya tiene %s, y no agrega nada", async (_name, create) => {
    await create();
    const before = [await prisma.category.count(), await prisma.customer.count(), await prisma.product.count()];

    await expect(seedDatabase(prisma, { userId, ...small })).rejects.toThrow(/base vacía/);

    expect([await prisma.category.count(), await prisma.customer.count(), await prisma.product.count()]).toEqual(before);
  });

  it("se niega a correr si la base ya tiene un producto", async () => {
    const category = await prisma.category.create({ data: { name: "Mía" } });
    await prisma.product.create({ data: { name: "Algo", categoryId: category.id, salePrice: "100.00" } });
    await prisma.category.deleteMany({ where: { name: { not: "Mía" } } });

    await expect(seedDatabase(prisma, { userId, ...small })).rejects.toThrow(/base vacía/);
  });
}, 120_000);
