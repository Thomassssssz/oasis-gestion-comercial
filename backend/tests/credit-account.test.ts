import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

// Fichas de cuenta corriente (lectura): saldo calculado, vencimiento y estado (D17).
const prisma = createTestPrisma();
let clock = new Date("2026-03-10T15:00:00.000Z");
const app = createApp({ prisma, businessNow: () => clock });

let agent: Awaited<ReturnType<typeof loginAgent>>;
let productId: number;

beforeEach(async () => {
  clock = new Date("2026-03-10T15:00:00.000Z");
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  const userId = (await prisma.user.findFirstOrThrow()).id;
  const categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
  productId = (await prisma.product.create({ data: { name: "Cuaderno", categoryId, salePrice: "100.00" } })).id;
  await prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: 100 } });
});
afterAll(() => prisma.$disconnect());

async function seedCustomer(name: string) {
  return (await prisma.customer.create({ data: { name, creditAuthorized: true } })).id;
}
const creditSale = (customerId: number, quantity = 1, extra: Record<string, unknown> = {}) =>
  agent.post("/api/sales").send({ customerId, onCredit: true, items: [{ productId, quantity }], ...extra });

describe("acceso", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).get("/api/accounts")).status).toBe(401);
    expect((await request(app).get("/api/accounts/1")).status).toBe(401);
  });

  it("las fichas no se crean, editan ni borran a mano", async () => {
    expect((await agent.post("/api/accounts").send({})).status).toBe(404);
    expect((await agent.put("/api/accounts/1").send({})).status).toBe(404);
    expect((await agent.delete("/api/accounts/1")).status).toBe(404);
  });
});

describe("PUT /api/accounts/:id/remito", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).put("/api/accounts/1/remito").send({})).status).toBe(401);
  });

  it("guarda el número de ficha y el de remito, y la ficha los devuelve", async () => {
    const sale = await creditSale(await seedCustomer("Ana"), 2);
    const id = sale.body.accountId;

    const response = await agent.put(`/api/accounts/${id}/remito`).send({ number: " 0123 ", remitoNumber: "0001-00004567" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, number: "0123", remitoNumber: "0001-00004567" });
    expect((await agent.get(`/api/accounts/${id}`)).body).toMatchObject({ number: "0123", remitoNumber: "0001-00004567" });
  });

  it("por defecto los dos números están vacíos, y enviar vacío los borra", async () => {
    const sale = await creditSale(await seedCustomer("Ana"));
    const id = sale.body.accountId;
    expect((await agent.get(`/api/accounts/${id}`)).body).toMatchObject({ number: null, remitoNumber: null });

    await agent.put(`/api/accounts/${id}/remito`).send({ number: "1", remitoNumber: "2" });
    const cleared = await agent.put(`/api/accounts/${id}/remito`).send({ number: "  ", remitoNumber: null });

    expect(cleared.body).toMatchObject({ number: null, remitoNumber: null });
  });

  it("solo cambia esos dos datos: saldo, vencimiento, estado y movimientos quedan igual", async () => {
    const sale = await creditSale(await seedCustomer("Ana"), 3);
    const id = sale.body.accountId;
    const before = (await agent.get(`/api/accounts/${id}`)).body;

    const response = await agent
      .put(`/api/accounts/${id}/remito`)
      .send({ number: "7", remitoNumber: "8", status: "CANCELLED", dueDate: "2030-01-01T00:00:00.000Z", balance: "0.00" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...before, number: "7", remitoNumber: "8" });
  });

  it("también se puede en una ficha cancelada", async () => {
    const sale = await creditSale(await seedCustomer("Ana"));
    const id = sale.body.accountId;
    await agent.post(`/api/accounts/${id}/payments`).send({ amount: "100.00", paymentMethod: "CASH" });

    const response = await agent.put(`/api/accounts/${id}/remito`).send({ number: "9", remitoNumber: null });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "CANCELLED", number: "9" });
  });

  it("responde 404 si la ficha no existe y 400 si el id o los datos no son válidos", async () => {
    expect((await agent.put("/api/accounts/999/remito").send({ number: "1" })).status).toBe(404);
    expect((await agent.put("/api/accounts/abc/remito").send({ number: "1" })).status).toBe(400);

    const sale = await creditSale(await seedCustomer("Ana"));
    const id = sale.body.accountId;
    expect((await agent.put(`/api/accounts/${id}/remito`).send({ number: "x".repeat(31) })).status).toBe(400);
    expect((await agent.put(`/api/accounts/${id}/remito`).send({ remitoNumber: 123 })).status).toBe(400);
    expect((await prisma.creditAccount.findUniqueOrThrow({ where: { id } })).number).toBeNull();
  });
});

describe("GET /api/accounts/:id", () => {
  it("devuelve el saldo (suma de ventas con descuento), las ventas y el vencimiento", async () => {
    const cliente = await seedCustomer("Ana");
    const first = await creditSale(cliente, 3, { discount: "50.00", note: "Pedido escolar" });
    await creditSale(cliente, 2);

    const response = await agent.get(`/api/accounts/${first.body.accountId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: first.body.accountId,
      customer: { id: cliente, name: "Ana" },
      status: "OPEN",
      openedAt: "2026-03-10T15:00:00.000Z",
      dueDate: "2026-04-10T15:00:00.000Z",
      closedAt: null,
      balance: "450.00", // (300 − 50) + 200
      overdue: false,
      monthsOverdue: 0,
    });
    expect(response.body.sales).toHaveLength(2);
    expect(response.body.sales[0]).toMatchObject({ id: first.body.id, total: "250.00", note: "Pedido escolar", status: "CONFIRMED" });
  });

  it("cada venta trae sus artículos con cantidad, detalle, precio unitario y total de la línea, y el descuento", async () => {
    const cliente = await seedCustomer("Ana");
    const userId = (await prisma.user.findFirstOrThrow()).id;
    const lapicera = await prisma.product.create({ data: { name: "Lapicera", categoryId: (await prisma.category.findFirstOrThrow()).id, salePrice: "25.50" } });
    await prisma.stockMovement.create({ data: { productId: lapicera.id, userId, type: "INITIAL_STOCK", quantity: 50 } });
    const sale = await agent.post("/api/sales").send({
      customerId: cliente,
      onCredit: true,
      discount: "10.00",
      items: [{ productId, quantity: 3 }, { productId: lapicera.id, quantity: 4 }],
    });
    // Un cambio de precio posterior no toca lo ya vendido: la ficha guarda el precio de ese momento.
    await prisma.product.update({ where: { id: productId }, data: { salePrice: "999.00" } });

    const response = await agent.get(`/api/accounts/${sale.body.accountId}`);

    expect(response.body.sales[0]).toMatchObject({ discount: "10.00", total: "392.00" }); // 300 + 102 − 10
    expect(response.body.sales[0].items).toEqual([
      { productName: "Cuaderno", quantity: 3, unitPrice: "100.00", subtotal: "300.00" },
      { productName: "Lapicera", quantity: 4, unitPrice: "25.50", subtotal: "102.00" },
    ]);
  });

  it("las ventas anuladas no suman al saldo pero siguen en la ficha", async () => {
    const cliente = await seedCustomer("Ana");
    const first = await creditSale(cliente, 3);
    await creditSale(cliente, 1);
    await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    const response = await agent.get(`/api/accounts/${first.body.accountId}`);

    expect(response.body.balance).toBe("100.00");
    expect(response.body.sales.map((s: { status: string }) => s.status)).toEqual(["ANNULLED", "CONFIRMED"]);
  });

  it("marca vencida la ficha apenas pasa el vencimiento y cuenta los meses de atraso completos", async () => {
    const cliente = await seedCustomer("Ana");
    const sale = await creditSale(cliente);
    const url = `/api/accounts/${sale.body.accountId}`;

    clock = new Date("2026-04-10T15:00:00.000Z"); // justo el día del vencimiento: todavía no está vencida
    expect((await agent.get(url)).body).toMatchObject({ overdue: false, monthsOverdue: 0 });

    clock = new Date("2026-04-10T15:00:01.000Z"); // vencida, pero aún sin un mes completo de atraso
    expect((await agent.get(url)).body).toMatchObject({ overdue: true, monthsOverdue: 0 });

    clock = new Date("2026-05-10T15:00:00.000Z"); // un mes completo de atraso
    expect((await agent.get(url)).body).toMatchObject({ overdue: true, monthsOverdue: 1 });

    clock = new Date("2026-06-20T00:00:00.000Z");
    expect((await agent.get(url)).body).toMatchObject({ overdue: true, monthsOverdue: 2 });
  });

  it("una ficha cancelada nunca figura vencida", async () => {
    const cliente = await seedCustomer("Ana");
    const sale = await creditSale(cliente);
    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    clock = new Date("2027-01-01T00:00:00.000Z");
    const response = await agent.get(`/api/accounts/${sale.body.accountId}`);

    expect(response.body).toMatchObject({ status: "CANCELLED", overdue: false, monthsOverdue: 0 });
  });

  it("404 si la ficha no existe y 400 si el id no es válido", async () => {
    expect((await agent.get("/api/accounts/999")).status).toBe(404);
    expect((await agent.get("/api/accounts/abc")).status).toBe(400);
  });
});

describe("GET /api/accounts", () => {
  it("separa las pendientes del historial de canceladas y filtra por cliente", async () => {
    const ana = await seedCustomer("Ana");
    const beto = await seedCustomer("Beto");
    const anaSale = await creditSale(ana);
    await creditSale(beto, 2);
    await agent.post(`/api/sales/${anaSale.body.id}/annul`).send({ reason: "Error" });

    const open = await agent.get("/api/accounts?status=OPEN");
    const cancelled = await agent.get("/api/accounts?status=CANCELLED");
    const all = await agent.get("/api/accounts");
    const ofBeto = await agent.get(`/api/accounts?customerId=${beto}`);

    expect(open.body.map((a: { customer: { name: string } }) => a.customer.name)).toEqual(["Beto"]);
    expect(open.body[0].balance).toBe("200.00");
    expect(cancelled.body.map((a: { customer: { name: string } }) => a.customer.name)).toEqual(["Ana"]);
    expect(all.body).toHaveLength(2);
    expect(ofBeto.body).toHaveLength(1);
  });

  it("rechaza filtros inválidos", async () => {
    expect((await agent.get("/api/accounts?status=OTRA")).status).toBe(400);
    expect((await agent.get("/api/accounts?customerId=abc")).status).toBe(400);
  });
});
