import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

// Venta completa (D17): cliente, descuento, nota y venta a crédito sobre la ficha de cuenta corriente.
const prisma = createTestPrisma();
let clock = new Date("2026-03-10T15:00:00.000Z");
const app = createApp({ prisma, businessNow: () => clock });

let agent: Awaited<ReturnType<typeof loginAgent>>;
let categoryId: number;
let userId: number;

beforeEach(async () => {
  clock = new Date("2026-03-10T15:00:00.000Z");
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  userId = (await prisma.user.findFirstOrThrow()).id;
  categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
});
afterAll(() => prisma.$disconnect());

async function seedProduct(name: string, salePrice: string, stock: number, active = true) {
  const product = await prisma.product.create({ data: { name, categoryId, salePrice, active } });
  if (stock > 0) await prisma.stockMovement.create({ data: { productId: product.id, userId, type: "INITIAL_STOCK", quantity: stock } });
  return product.id;
}

async function seedCustomer(name: string, { creditAuthorized = false, active = true } = {}) {
  return (await prisma.customer.create({ data: { name, creditAuthorized, active } })).id;
}

async function stockOf(productId: number) {
  return (await prisma.stockMovement.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity ?? 0;
}

type Body = Record<string, unknown>;
const post = (body: Body) => agent.post("/api/sales").send(body);

describe("venta completa: cliente, descuento y nota", () => {
  it("guarda cliente, descuento y nota; el total es subtotal menos descuento", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1000.00", 10);
    const cliente = await seedCustomer("María Gómez");

    const response = await post({
      paymentMethod: "TRANSFER",
      customerId: cliente,
      discount: "250.50",
      note: "Descuento por cliente frecuente",
      items: [{ productId: cuaderno, quantity: 3 }],
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      paymentMethod: "TRANSFER",
      onCredit: false,
      customer: { id: cliente, name: "María Gómez" },
      accountId: null,
      subtotal: "3000.00",
      discount: "250.50",
      total: "2749.50",
      note: "Descuento por cliente frecuente",
    });
  });

  it("sin descuento ni nota ni cliente (venta rápida) devuelve descuento 0.00 y valores nulos", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const response = await post({ paymentMethod: "CASH", items: [{ productId: cuaderno, quantity: 1 }] });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ customer: null, discount: "0.00", total: "100.00", note: null, onCredit: false });
  });

  it("no deja un descuento igual o mayor al subtotal", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const equal = await post({ paymentMethod: "CASH", discount: "100.00", items: [{ productId: cuaderno, quantity: 1 }] });
    const greater = await post({ paymentMethod: "CASH", discount: "100.01", items: [{ productId: cuaderno, quantity: 1 }] });
    const justBelow = await post({ paymentMethod: "CASH", discount: "99.99", items: [{ productId: cuaderno, quantity: 1 }] });

    expect(equal.status).toBe(400);
    expect(equal.body.error).toBe("El descuento no puede ser igual o mayor al total de la venta");
    expect(greater.status).toBe(400);
    expect(justBelow.status).toBe(201);
    expect(justBelow.body.total).toBe("0.01");
    expect(await stockOf(cuaderno)).toBe(9); // solo la tercera descontó stock
  });

  it("rechaza descuentos mal formados", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    for (const discount of ["-5", "abc", "1.234", "", " "]) {
      const response = await post({ paymentMethod: "CASH", discount, items: [{ productId: cuaderno, quantity: 1 }] });
      expect(response.status, `descuento ${JSON.stringify(discount)}`).toBe(400);
    }
    expect(await prisma.sale.count()).toBe(0);
  });

  it("acepta el descuento como número", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const response = await post({ paymentMethod: "CASH", discount: 10.5, items: [{ productId: cuaderno, quantity: 1 }] });
    expect(response.status).toBe(201);
    expect(response.body.total).toBe("89.50");
  });

  it("limpia la nota (espacios) y la guarda como nula si queda vacía; rechaza notas larguísimas", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const items = [{ productId: cuaderno, quantity: 1 }];

    const trimmed = await post({ paymentMethod: "CASH", note: "  Pedido especial  ", items });
    const blank = await post({ paymentMethod: "CASH", note: "   ", items });
    const tooLong = await post({ paymentMethod: "CASH", note: "x".repeat(501), items });

    expect(trimmed.body.note).toBe("Pedido especial");
    expect(blank.status).toBe(201);
    expect(blank.body.note).toBeNull();
    expect(tooLong.status).toBe(400);
  });

  it("el cliente tiene que existir y estar activo", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const baja = await seedCustomer("Dado de baja", { active: false });
    const items = [{ productId: cuaderno, quantity: 1 }];

    const missing = await post({ paymentMethod: "CASH", customerId: 999, items });
    const inactive = await post({ paymentMethod: "CASH", customerId: baja, items });

    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("El cliente no existe");
    expect(inactive.status).toBe(409);
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("el medio de pago es obligatorio si no es a crédito", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const response = await post({ items: [{ productId: cuaderno, quantity: 1 }] });
    expect(response.status).toBe(400);
  });

  it("filtra el historial por cliente y por ventas a crédito", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    const ana = await seedCustomer("Ana", { creditAuthorized: true });
    const beto = await seedCustomer("Beto", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];

    await post({ paymentMethod: "CASH", customerId: ana, items });
    await post({ customerId: ana, onCredit: true, items });
    await post({ customerId: beto, onCredit: true, items });

    const ofAna = await agent.get(`/api/sales?customerId=${ana}`);
    const credit = await agent.get("/api/sales?onCredit=true");
    const cash = await agent.get("/api/sales?onCredit=false");

    expect(ofAna.body).toHaveLength(2);
    expect(credit.body).toHaveLength(2);
    expect(credit.body.every((sale: { onCredit: boolean }) => sale.onCredit)).toBe(true);
    expect(cash.body).toHaveLength(1);
  });
});

describe("venta a crédito", () => {
  it("sin cliente no se puede vender a crédito", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const response = await post({ onCredit: true, items: [{ productId: cuaderno, quantity: 1 }] });
    expect(response.status).toBe(400);
  });

  it("a crédito no lleva medio de pago (se cobra después)", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const response = await post({ onCredit: true, customerId: cliente, paymentMethod: "CASH", items: [{ productId: cuaderno, quantity: 1 }] });
    expect(response.status).toBe(400);
  });

  it("solo los clientes autorizados compran a crédito", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Sin crédito");
    const response = await post({ onCredit: true, customerId: cliente, items: [{ productId: cuaderno, quantity: 1 }] });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('El cliente "Sin crédito" no está autorizado a comprar a crédito');
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.creditAccount.count()).toBe(0);
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("la primera venta a crédito abre la ficha: el plazo de un mes empieza ese día", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });

    const response = await post({ onCredit: true, customerId: cliente, items: [{ productId: cuaderno, quantity: 2 }] });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ onCredit: true, paymentMethod: null, total: "200.00", accountId: expect.any(Number) });
    expect(await stockOf(cuaderno)).toBe(8);

    const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: response.body.accountId } });
    expect(account).toMatchObject({ customerId: cliente, status: "OPEN", closedAt: null });
    expect(account.openedAt.toISOString()).toBe("2026-03-10T15:00:00.000Z");
    expect(account.dueDate.toISOString()).toBe("2026-04-10T15:00:00.000Z");
    expect(response.body.createdAt).toBe("2026-03-10T15:00:00.000Z");
  });

  it("las ventas siguientes reutilizan la ficha y NO mueven su vencimiento", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];

    const first = await post({ onCredit: true, customerId: cliente, items });
    clock = new Date("2026-03-25T10:00:00.000Z");
    const second = await post({ onCredit: true, customerId: cliente, items });

    expect(second.body.accountId).toBe(first.body.accountId);
    expect(await prisma.creditAccount.count()).toBe(1);
    const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: first.body.accountId } });
    expect(account.dueDate.toISOString()).toBe("2026-04-10T15:00:00.000Z");
  });

  it("cada cliente tiene su propia ficha y su propio ciclo", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const ana = await seedCustomer("Ana", { creditAuthorized: true });
    const beto = await seedCustomer("Beto", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];

    const a = await post({ onCredit: true, customerId: ana, items });
    clock = new Date("2026-03-20T10:00:00.000Z");
    const b = await post({ onCredit: true, customerId: beto, items });

    expect(a.body.accountId).not.toBe(b.body.accountId);
    const accountB = await prisma.creditAccount.findUniqueOrThrow({ where: { id: b.body.accountId } });
    expect(accountB.dueDate.toISOString()).toBe("2026-04-20T10:00:00.000Z");
  });

  it("la venta a crédito respeta el stock: si no alcanza no se registra ni se abre la ficha", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 1);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });

    const response = await post({ onCredit: true, customerId: cliente, items: [{ productId: cuaderno, quantity: 2 }] });

    expect(response.status).toBe(409);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.creditAccount.count()).toBe(0);
  });

  it("si falla el descuento no queda una ficha abierta de más", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });

    const response = await post({ onCredit: true, customerId: cliente, discount: "100.00", items: [{ productId: cuaderno, quantity: 1 }] });

    expect(response.status).toBe(400);
    expect(await prisma.creditAccount.count()).toBe(0);
  });

  it("dos ventas a crédito simultáneas del mismo cliente comparten una sola ficha", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];

    const responses = await Promise.all(Array.from({ length: 6 }, () => post({ onCredit: true, customerId: cliente, items })));

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    expect(await prisma.creditAccount.count()).toBe(1);
    expect(await prisma.sale.count({ where: { onCredit: true } })).toBe(6);
  });

  it("anular una venta a crédito baja el saldo y devuelve el stock; si era la única, la ficha se cancela", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];
    const first = await post({ onCredit: true, customerId: cliente, items });
    const second = await post({ onCredit: true, customerId: cliente, items });
    const accountId = first.body.accountId;

    await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });
    let account = await agent.get(`/api/accounts/${accountId}`);
    expect(account.body).toMatchObject({ status: "OPEN", balance: "100.00" });

    clock = new Date("2026-03-12T09:00:00.000Z");
    await agent.post(`/api/sales/${second.body.id}/annul`).send({ reason: "Otro error" });
    account = await agent.get(`/api/accounts/${accountId}`);
    expect(account.body).toMatchObject({ status: "CANCELLED", balance: "0.00", closedAt: "2026-03-12T09:00:00.000Z" });
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("después de cancelarse la ficha, una nueva compra a crédito abre un ciclo nuevo con su propio vencimiento", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];
    const first = await post({ onCredit: true, customerId: cliente, items });
    await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    clock = new Date("2026-05-02T10:00:00.000Z");
    const again = await post({ onCredit: true, customerId: cliente, items });

    expect(again.body.accountId).not.toBe(first.body.accountId);
    const accounts = await prisma.creditAccount.findMany({ orderBy: { id: "asc" } });
    expect(accounts.map((a) => a.status)).toEqual(["CANCELLED", "OPEN"]);
    expect(accounts[1]!.dueDate.toISOString()).toBe("2026-06-02T10:00:00.000Z");
  });

  it("anular una venta de contado no toca ninguna ficha", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const cliente = await seedCustomer("Ana", { creditAuthorized: true });
    const items = [{ productId: cuaderno, quantity: 1 }];
    await post({ onCredit: true, customerId: cliente, items });
    const cash = await post({ paymentMethod: "CASH", customerId: cliente, items });

    const response = await agent.post(`/api/sales/${cash.body.id}/annul`).send({ reason: "Error" });

    expect(response.status).toBe(200);
    expect((await prisma.creditAccount.findFirstOrThrow()).status).toBe("OPEN");
  });
});
