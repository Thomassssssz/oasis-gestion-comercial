import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

// Pagos y recargos por mora de las fichas de cuenta corriente (D18).
// Escenario base: una venta a crédito de $1000 el 10/3 15:00 → vence el 10/4 15:00; el primer mes de atraso
// se completa el 10/5 15:00, el segundo el 10/6 15:00.
const prisma = createTestPrisma();
const OPENED = "2026-03-10T15:00:00.000Z";
let clock = new Date(OPENED);
const app = createApp({ prisma, businessNow: () => clock });
const at = (iso: string) => (clock = new Date(iso));

let agent: Awaited<ReturnType<typeof loginAgent>>;
let productId: number;
let customerId: number;
let userId: number;

beforeEach(async () => {
  clock = new Date(OPENED);
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  userId = (await prisma.user.findFirstOrThrow()).id;
  const categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
  productId = (await prisma.product.create({ data: { name: "Cuaderno", categoryId, salePrice: "1000.00" } })).id;
  await prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: 100 } });
  customerId = (await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } })).id;
});
afterAll(() => prisma.$disconnect());

const creditSale = (quantity = 1) => agent.post("/api/sales").send({ customerId, onCredit: true, items: [{ productId, quantity }] });
const pay = (accountId: number, body: Record<string, unknown>) => agent.post(`/api/accounts/${accountId}/payments`).send(body);
const cash = (amount: string | number) => ({ amount, paymentMethod: "CASH" });
const account = async (id: number) => (await agent.get(`/api/accounts/${id}`)).body;

async function openAccount() {
  const sale = await creditSale();
  return sale.body.accountId as number;
}

describe("acceso", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).post("/api/accounts/1/payments").send({})).status).toBe(401);
    expect((await request(app).post("/api/accounts/1/surcharges")).status).toBe(401);
  });

  it("los pagos y recargos no se editan ni se borran", async () => {
    const id = await openAccount();
    const paid = await pay(id, cash("100.00"));
    const paymentId = paid.body.payments[0].id;

    expect((await agent.put(`/api/accounts/${id}/payments/${paymentId}`).send({})).status).toBe(404);
    expect((await agent.delete(`/api/accounts/${id}/payments/${paymentId}`)).status).toBe(404);
    expect((await agent.delete(`/api/accounts/${id}/surcharges/1`)).status).toBe(404);
  });
});

describe("POST /api/accounts/:id/payments", () => {
  it("un pago parcial baja el saldo, queda registrado con quién y cuándo, y NO mueve el vencimiento", async () => {
    const id = await openAccount();
    at("2026-03-20T10:00:00.000Z");

    const response = await pay(id, { amount: "400.00", paymentMethod: "TRANSFER", note: "Seña" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "OPEN",
      balance: "600.00",
      dueDate: "2026-04-10T15:00:00.000Z", // el vencimiento original sigue igual (regla confirmada)
      closedAt: null,
    });
    expect(response.body.payments).toEqual([
      { id: expect.any(Number), amount: "400.00", paymentMethod: "TRANSFER", note: "Seña", createdAt: "2026-03-20T10:00:00.000Z", userName: "Ana Propietaria" },
    ]);
    const stored = await prisma.accountPayment.findFirstOrThrow();
    expect(stored.userId).toBe(userId);
    expect((await prisma.creditAccount.findUniqueOrThrow({ where: { id } })).dueDate.toISOString()).toBe("2026-04-10T15:00:00.000Z");
  });

  it("varios pagos parciales seguidos tampoco mueven el vencimiento", async () => {
    const id = await openAccount();
    for (const [date, amount] of [["2026-03-15T10:00:00.000Z", "100.00"], ["2026-04-01T10:00:00.000Z", "200.50"]] as const) {
      at(date);
      expect((await pay(id, cash(amount))).status).toBe(201);
    }
    const result = await account(id);
    expect(result).toMatchObject({ balance: "699.50", dueDate: "2026-04-10T15:00:00.000Z", status: "OPEN" });
    expect(result.payments).toHaveLength(2);
  });

  it("cuando el pago deja el saldo en cero la ficha pasa al historial de canceladas", async () => {
    const id = await openAccount();
    at("2026-03-25T09:30:00.000Z");

    const response = await pay(id, cash("1000.00"));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: "CANCELLED", balance: "0.00", closedAt: "2026-03-25T09:30:00.000Z" });
    const cancelled = await agent.get("/api/accounts?status=CANCELLED");
    expect(cancelled.body.map((a: { id: number }) => a.id)).toEqual([id]);
    expect((await agent.get("/api/accounts?status=OPEN")).body).toEqual([]);
  });

  it("un pago mayor al saldo se rechaza y no se guarda nada", async () => {
    const id = await openAccount();

    const response = await pay(id, cash("1000.01"));

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("El pago no puede superar el saldo de la cuenta (saldo actual: 1000.00)");
    expect(await prisma.accountPayment.count()).toBe(0);
    expect((await account(id)).balance).toBe("1000.00");
  });

  it("el saldo se paga de a poco y el último pago exacto cancela; uno más ya no entra", async () => {
    const id = await openAccount();
    await pay(id, cash("999.99"));
    expect((await account(id)).balance).toBe("0.01");

    expect((await pay(id, cash("0.02"))).status).toBe(409);
    expect((await pay(id, cash("0.01"))).body.status).toBe("CANCELLED");
  });

  it("no se puede pagar una ficha cancelada (409), una que no existe (404) ni con un id inválido (400)", async () => {
    const id = await openAccount();
    await pay(id, cash("1000.00"));

    const onCancelled = await pay(id, cash("1.00"));
    expect(onCancelled.status).toBe(409);
    expect(onCancelled.body.error).toBe("La cuenta ya está cancelada");
    expect((await pay(999, cash("1.00"))).status).toBe(404);
    expect((await pay(0, cash("1.00"))).status).toBe(400);
    expect(await prisma.accountPayment.count()).toBe(1);
  });

  it("rechaza datos inválidos", async () => {
    const id = await openAccount();
    const invalid: Record<string, unknown>[] = [
      { paymentMethod: "CASH" }, // sin importe
      cash("0"),
      cash("-5"),
      cash("abc"),
      cash("10.123"),
      cash(""),
      { amount: "10.00" }, // sin medio de pago
      { amount: "10.00", paymentMethod: "CHEQUE" },
      { ...cash("10.00"), note: "x".repeat(501) },
    ];
    for (const body of invalid) expect((await pay(id, body)).status, JSON.stringify(body)).toBe(400);
    expect(await prisma.accountPayment.count()).toBe(0);
  });

  it("acepta el importe como número y limpia la nota (vacía = sin nota)", async () => {
    const id = await openAccount();

    const response = await pay(id, { amount: 100.5, paymentMethod: "CARD", note: "   " });

    expect(response.status).toBe(201);
    expect(response.body.payments[0]).toMatchObject({ amount: "100.50", paymentMethod: "CARD", note: null });
  });

  it("dos pagos simultáneos por el saldo completo: entra uno solo", async () => {
    const id = await openAccount();

    const responses = await Promise.all([pay(id, cash("1000.00")), pay(id, cash("1000.00"))]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.accountPayment.count()).toBe(1);
  });

  it("muchos pagos parciales simultáneos se suman bien y el último cancela la ficha", async () => {
    const id = await openAccount();

    const responses = await Promise.all(Array.from({ length: 10 }, () => pay(id, cash("100.00"))));

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(await account(id)).toMatchObject({ balance: "0.00", status: "CANCELLED" });
  });
});

describe("recargos por mora", () => {
  it("antes de completar un mes de atraso no corresponde ningún recargo", async () => {
    const id = await openAccount();
    at("2026-05-10T14:59:59.000Z");

    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ surcharges: [], pendingSurcharges: [], balance: "1000.00" });
    expect(await prisma.surcharge.count()).toBe(0);
  });

  it("GET muestra los recargos que ya corresponden SIN guardarlos", async () => {
    const id = await openAccount();
    at("2026-05-10T15:00:00.000Z");

    const result = await account(id);

    expect(result).toMatchObject({ balance: "1000.00", pendingSurchargesTotal: "50.00", payable: "1050.00", monthsOverdue: 1 });
    expect(result.pendingSurcharges).toEqual([
      { monthNumber: 1, base: "1000.00", percent: "5.00", amount: "50.00", chargedOn: "2026-05-10T15:00:00.000Z" },
    ]);
    expect(result.surcharges).toEqual([]);
    expect(await prisma.surcharge.count()).toBe(0);
  });

  it("aplicar registra el recargo con su base, porcentaje, quién y cuándo, y suma al saldo", async () => {
    const id = await openAccount();
    at("2026-05-12T09:00:00.000Z");

    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ balance: "1050.00", pendingSurcharges: [], pendingSurchargesTotal: "0.00", payable: "1050.00" });
    expect(result.body.surcharges).toEqual([
      {
        monthNumber: 1,
        base: "1000.00",
        percent: "5.00",
        amount: "50.00",
        chargedOn: "2026-05-10T15:00:00.000Z",
        registeredAt: "2026-05-12T09:00:00.000Z",
      },
    ]);
    expect((await prisma.surcharge.findFirstOrThrow()).userId).toBe(userId);
  });

  it("aplicar dos veces no cobra dos veces el mismo mes", async () => {
    const id = await openAccount();
    at("2026-05-20T10:00:00.000Z");

    await agent.post(`/api/accounts/${id}/surcharges`);
    const again = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(again.status).toBe(200);
    expect(again.body.balance).toBe("1050.00");
    expect(await prisma.surcharge.count()).toBe(1);
  });

  it("si pasaron varios meses se registran todos, sin capitalizar (cada mes sobre el capital, no sobre el recargo)", async () => {
    const id = await openAccount();
    at("2026-07-20T10:00:00.000Z");

    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.body.surcharges.map((s: { monthNumber: number; base: string; amount: string }) => [s.monthNumber, s.base, s.amount])).toEqual([
      [1, "1000.00", "50.00"],
      [2, "1000.00", "50.00"],
      [3, "1000.00", "50.00"],
    ]);
    expect(result.body.balance).toBe("1150.00");
    expect(result.body.monthsOverdue).toBe(3);
  });

  it("usa el porcentaje vigente y guarda el usado: cambiarlo después no reescribe los recargos ya registrados", async () => {
    const id = await openAccount();
    await prisma.setting.upsert({ where: { id: 1 }, update: { lateFeePercent: "10" }, create: { id: 1, lateFeePercent: "10" } });
    at("2026-05-10T15:00:00.000Z");
    await agent.post(`/api/accounts/${id}/surcharges`);

    await prisma.setting.update({ where: { id: 1 }, data: { lateFeePercent: "20" } });
    at("2026-06-10T15:00:00.000Z");
    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.body.surcharges.map((s: { percent: string; amount: string }) => [s.percent, s.amount])).toEqual([
      ["10.00", "100.00"], // el mes 1 conserva el 10%
      ["20.00", "200.00"], // el mes 2 usa el 20% vigente
    ]);
    expect(result.body.balance).toBe("1300.00");
  });

  it("con el recargo en 0 no se registra nada", async () => {
    const id = await openAccount();
    await prisma.setting.upsert({ where: { id: 1 }, update: { lateFeePercent: "0" }, create: { id: 1, lateFeePercent: "0" } });
    at("2026-07-20T10:00:00.000Z");

    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.body).toMatchObject({ surcharges: [], balance: "1000.00", payable: "1000.00" });
  });

  it("un pago hecho antes del vencimiento reduce la base del recargo", async () => {
    const id = await openAccount();
    at("2026-04-01T10:00:00.000Z");
    await pay(id, cash("400.00"));

    at("2026-05-10T15:00:00.000Z");
    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.body.surcharges[0]).toMatchObject({ base: "600.00", amount: "30.00" });
    expect(result.body.balance).toBe("630.00");
  });

  it("las ventas a crédito agregadas después del vencimiento entran recién en la base del mes siguiente", async () => {
    const id = await openAccount();
    at("2026-04-20T10:00:00.000Z");
    await creditSale(); // se suma a la ficha pero no mueve el vencimiento

    at("2026-06-10T15:00:00.000Z");
    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    expect(result.body.surcharges.map((s: { base: string; amount: string }) => [s.base, s.amount])).toEqual([
      ["1000.00", "50.00"], // mes 1: capital al vencimiento (10/4); la 2.ª venta es del 20/4 y todavía no cuenta
      ["2000.00", "100.00"], // mes 2: capital al 10/5, ya con las dos ventas
    ]);
  });

  it("no se pueden aplicar a una ficha cancelada (409) ni inexistente (404)", async () => {
    const id = await openAccount();
    await pay(id, cash("1000.00"));

    expect((await agent.post(`/api/accounts/${id}/surcharges`)).status).toBe(409);
    expect((await agent.post("/api/accounts/999/surcharges")).status).toBe(404);
  });

  it("dos aplicaciones simultáneas no duplican ni fallan", async () => {
    const id = await openAccount();
    at("2026-06-20T10:00:00.000Z");

    const responses = await Promise.all([1, 2, 3].map(() => agent.post(`/api/accounts/${id}/surcharges`)));

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await prisma.surcharge.count()).toBe(2);
  });
});

describe("pagos y recargos juntos", () => {
  it("al pagar, primero se registran los recargos que ya corresponden y el pago los cubre", async () => {
    const id = await openAccount();
    at("2026-05-15T10:00:00.000Z");

    const partial = await pay(id, cash("1000.00"));

    expect(partial.status).toBe(201);
    expect(partial.body).toMatchObject({ status: "OPEN", balance: "50.00" }); // quedó el recargo del mes 1
    expect(partial.body.surcharges).toHaveLength(1);
    expect(partial.body.dueDate).toBe("2026-04-10T15:00:00.000Z");

    const rest = await pay(id, cash("50.00"));
    expect(rest.body).toMatchObject({ status: "CANCELLED", balance: "0.00" });
  });

  it("se puede cancelar la ficha pagando saldo + recargos exactos", async () => {
    const id = await openAccount();
    at("2026-05-15T10:00:00.000Z");

    expect((await account(id)).payable).toBe("1050.00");
    const response = await pay(id, cash("1050.00"));

    expect(response.body).toMatchObject({ status: "CANCELLED", balance: "0.00" });
  });

  it("si el pago se rechaza por superar el saldo, tampoco quedan recargos registrados", async () => {
    const id = await openAccount();
    at("2026-05-15T10:00:00.000Z");

    const response = await pay(id, cash("1050.01"));

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("saldo actual: 1050.00");
    expect(await prisma.surcharge.count()).toBe(0);
    expect(await prisma.accountPayment.count()).toBe(0);
  });

  it("un pago posterior al vencimiento cubre primero los recargos ya registrados y después el capital", async () => {
    const id = await openAccount();
    at("2026-05-10T15:00:00.000Z");
    await pay(id, cash("100.00")); // registra recargo mes 1 (50) y paga 100 → saldo 950

    at("2026-06-10T15:00:00.000Z");
    const result = await agent.post(`/api/accounts/${id}/surcharges`);

    // Los 100 pagados cubrieron los 50 de recargo y 50 de capital: capital pendiente 950 → 5% = 47,50
    expect(result.body.surcharges[1]).toMatchObject({ monthNumber: 2, base: "950.00", amount: "47.50" });
    expect(result.body.balance).toBe("997.50");
  });

  it("anular una venta a crédito cuando el cliente ya pagó de más se rechaza y no cambia nada", async () => {
    const first = await creditSale(); // 1000
    const second = await creditSale(); // 1000 → saldo 2000
    const id = first.body.accountId;
    await pay(id, cash("1500.00")); // saldo 500

    const rejected = await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toBe("No se puede anular: el cliente ya pagó más de lo que quedaría adeudado en su cuenta");
    expect((await agent.get(`/api/sales/${first.body.id}`)).body.status).toBe("CONFIRMED");
    expect(await account(id)).toMatchObject({ balance: "500.00", status: "OPEN" });

    // La otra venta tampoco se puede anular: quedaría 1000 − 1500 < 0.
    expect((await agent.post(`/api/sales/${second.body.id}/annul`).send({ reason: "Error" })).status).toBe(409);
  });

  it("anular una venta a crédito con pagos hechos baja el saldo si no queda negativo", async () => {
    const first = await creditSale();
    await creditSale();
    const id = first.body.accountId;
    await pay(id, cash("500.00")); // saldo 1500

    const response = await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    expect(response.status).toBe(200);
    expect(await account(id)).toMatchObject({ balance: "500.00", status: "OPEN" });
  });

  it("anular la venta que deja el saldo exactamente en cero cancela la ficha", async () => {
    const first = await creditSale();
    await creditSale();
    const id = first.body.accountId;
    await pay(id, cash("1000.00")); // saldo 1000

    at("2026-03-30T10:00:00.000Z");
    const response = await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    expect(response.status).toBe(200);
    expect(await account(id)).toMatchObject({ balance: "0.00", status: "CANCELLED", closedAt: "2026-03-30T10:00:00.000Z" });
  });

  it("anular una venta no borra recargos ya registrados (no se recalcula el pasado)", async () => {
    const first = await creditSale();
    await creditSale();
    const id = first.body.accountId;
    at("2026-05-10T15:00:00.000Z");
    await agent.post(`/api/accounts/${id}/surcharges`); // base 2000 → 100

    await agent.post(`/api/sales/${first.body.id}/annul`).send({ reason: "Error" });

    const result = await account(id);
    expect(result.surcharges).toHaveLength(1);
    expect(result.surcharges[0]).toMatchObject({ base: "2000.00", amount: "100.00" });
    expect(result.balance).toBe("1100.00"); // 1000 de la venta que queda + 100 de recargo ya registrado
  });

  it("el listado incluye los totales a pagar de cada ficha", async () => {
    await openAccount();
    at("2026-05-10T15:00:00.000Z");

    const list = await agent.get("/api/accounts?status=OPEN");

    expect(list.body[0]).toMatchObject({ balance: "1000.00", pendingSurchargesTotal: "50.00", payable: "1050.00" });
  });
});

describe("quién registra y aislamiento entre fichas", () => {
  it("el pago y el recargo quedan a nombre del usuario de la sesión, no de otro", async () => {
    const id = await openAccount();
    const beto = await loginAgent(app, prisma, { username: "beto", fullName: "Beto Propietario" });
    const betoId = (await prisma.user.findFirstOrThrow({ where: { username: "beto" } })).id;
    expect(betoId).not.toBe(userId);

    at("2026-05-10T15:00:00.000Z");
    await beto.post(`/api/accounts/${id}/surcharges`);
    const paid = await beto.post(`/api/accounts/${id}/payments`).send(cash("100.00"));

    expect((await prisma.surcharge.findFirstOrThrow()).userId).toBe(betoId);
    expect((await prisma.accountPayment.findFirstOrThrow()).userId).toBe(betoId);
    expect(paid.body.payments[0].userName).toBe("Beto Propietario");
  });

  it("los pagos y recargos de una ficha no afectan a la ficha de otro cliente", async () => {
    const id = await openAccount();
    const otherCustomer = (await prisma.customer.create({ data: { name: "Beto", creditAuthorized: true } })).id;
    const otherSale = await agent.post("/api/sales").send({ customerId: otherCustomer, onCredit: true, items: [{ productId, quantity: 3 }] });
    const otherId = otherSale.body.accountId as number;

    at("2026-05-10T15:00:00.000Z");
    await pay(id, cash("300.00")); // registra recargo de 50 en la ficha de Ana y paga 300

    const other = await account(otherId);
    expect(other).toMatchObject({ balance: "3000.00", payments: [], surcharges: [] });
    expect(other.pendingSurcharges[0]).toMatchObject({ base: "3000.00", amount: "150.00" });
    expect(await account(id)).toMatchObject({ balance: "750.00" }); // 1000 + 50 − 300
  });

  it("el saldo y los recargos de una ficha se calculan solo con SUS pagos y recargos", async () => {
    const id = await openAccount(); // Ana: 1000
    const otherCustomer = (await prisma.customer.create({ data: { name: "Beto", creditAuthorized: true } })).id;
    const otherSale = await agent.post("/api/sales").send({ customerId: otherCustomer, onCredit: true, items: [{ productId, quantity: 3 }] });
    const otherId = otherSale.body.accountId as number;
    at("2026-05-10T15:00:00.000Z");
    await pay(otherId, cash("500.00")); // Beto: registra recargo y paga; no debe verse en la ficha de Ana

    const ana = await pay(id, cash("1050.00")); // saldo de Ana: 1000 + recargo 50, sin influencia de los 500 de Beto

    expect(ana.status).toBe(201);
    expect(ana.body).toMatchObject({ status: "CANCELLED", balance: "0.00" });
    expect(ana.body.surcharges[0]).toMatchObject({ base: "1000.00", amount: "50.00" });
  });
});
