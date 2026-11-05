import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

// Reportes (módulo 7): ventas por día, por medio de pago, productos más vendidos y deuda de clientes.
const prisma = createTestPrisma();
let clock = new Date("2026-11-04T15:00:00.000Z"); // 12:00 en Argentina
const app = createApp({ prisma, businessNow: () => clock });
const at = (iso: string) => (clock = new Date(iso));

let agent: Awaited<ReturnType<typeof loginAgent>>;
let categoryId: number;
let userId: number;

beforeEach(async () => {
  clock = new Date("2026-11-04T15:00:00.000Z");
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  userId = (await prisma.user.findFirstOrThrow()).id;
  categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
});
afterAll(() => prisma.$disconnect());

async function seedProduct(name: string, salePrice: string, stock = 1000) {
  const product = await prisma.product.create({ data: { name, categoryId, salePrice } });
  await prisma.stockMovement.create({ data: { productId: product.id, userId, type: "INITIAL_STOCK", quantity: stock } });
  return product.id;
}
const sell = (body: Record<string, unknown>) => agent.post("/api/sales").send(body);
const report = (query = "") => agent.get(`/api/reports/sales${query}`);

describe("acceso", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).get("/api/reports/sales")).status).toBe(401);
    expect((await request(app).get("/api/reports/debt")).status).toBe(401);
  });

  it("los reportes son solo de lectura", async () => {
    expect((await agent.post("/api/reports/sales").send({})).status).toBe(404);
    expect((await agent.delete("/api/reports/debt")).status).toBe(404);
  });
});

describe("GET /api/reports/sales – rango", () => {
  it("sin fechas devuelve los últimos 30 días hasta hoy (hora de Argentina), con todos los días aunque no haya ventas", async () => {
    const response = await report();

    expect(response.status).toBe(200);
    expect(response.body.from).toBe("2026-10-06");
    expect(response.body.to).toBe("2026-11-04");
    expect(response.body.byDay).toHaveLength(30);
    expect(response.body.byDay[0]).toEqual({ date: "2026-10-06", count: 0, total: "0.00" });
    expect(response.body.byDay[29].date).toBe("2026-11-04");
    expect(response.body.totals).toEqual({ count: 0, total: "0.00", average: "0.00" });
    expect(response.body.byPaymentMethod).toEqual([]);
    expect(response.body.topProducts).toEqual([]);
  });

  it("\"hoy\" es el día local: a las 23:30 en Argentina todavía es el mismo día aunque en UTC ya sea el siguiente", async () => {
    at("2026-11-05T02:30:00.000Z"); // 23:30 del 4/11 en Argentina

    expect((await report()).body.to).toBe("2026-11-04");
  });

  it("solo `to` usa los 30 días anteriores; solo `from` llega hasta hoy", async () => {
    const onlyTo = await report("?to=2026-06-30");
    expect([onlyTo.body.from, onlyTo.body.to]).toEqual(["2026-06-01", "2026-06-30"]);

    const onlyFrom = await report("?from=2026-10-20");
    expect([onlyFrom.body.from, onlyFrom.body.to, onlyFrom.body.byDay.length]).toEqual(["2026-10-20", "2026-11-04", 16]);
  });

  it("los dos extremos del rango son inclusivos y respetan el día local", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    const items = [{ productId: p, quantity: 1 }];
    at("2026-11-01T02:59:59.000Z"); // 31/10 23:59:59 local: afuera
    await sell({ paymentMethod: "CASH", items });
    at("2026-11-01T03:00:00.000Z"); // 1/11 00:00 local: adentro
    await sell({ paymentMethod: "CASH", items });
    at("2026-11-05T02:59:59.000Z"); // 4/11 23:59:59 local: adentro
    await sell({ paymentMethod: "CASH", items });
    at("2026-11-05T03:00:00.000Z"); // 5/11 00:00 local: afuera
    await sell({ paymentMethod: "CASH", items });

    const response = await report("?from=2026-11-01&to=2026-11-04");

    expect(response.body.totals.count).toBe(2);
    expect(response.body.byDay.map((d: { date: string; count: number }) => [d.date, d.count])).toEqual([
      ["2026-11-01", 1],
      ["2026-11-02", 0],
      ["2026-11-03", 0],
      ["2026-11-04", 1],
    ]);
  });

  it("un rango de un solo día es válido", async () => {
    const response = await report("?from=2026-11-04&to=2026-11-04");

    expect(response.status).toBe(200);
    expect(response.body.byDay).toEqual([{ date: "2026-11-04", count: 0, total: "0.00" }]);
  });

  it("rechaza fechas inválidas, rangos al revés y rangos de más de 366 días", async () => {
    for (const query of [
      "?from=2026-02-30",
      "?from=abc",
      "?to=2026-1-1",
      "?from=2026-11-05&to=2026-11-04",
      "?from=2025-01-01&to=2026-01-02", // 367 días
      "?from=2026-12-01", // desde en el futuro respecto de hoy (4/11)
      "?from=2020-01-01", // hasta hoy son demasiados días
    ]) {
      expect((await report(query)).status, query).toBe(400);
    }
    expect((await report("?from=2025-01-01&to=2026-01-01")).status).toBe(200); // exactamente 366 días
  });
});

describe("GET /api/reports/sales – totales", () => {
  it("suma solo las ventas confirmadas, con descuento, y calcula el promedio exacto", async () => {
    const p = await seedProduct("Cuaderno", "1000.01");
    const a = await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 1 }] }); // 1000.01
    await sell({ paymentMethod: "CASH", discount: "0.02", items: [{ productId: p, quantity: 1 }] }); // 999.99
    await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 1 }] }); // 1000.01 (se anula)
    await agent.post(`/api/sales/${a.body.id + 2}/annul`).send({ reason: "Error" });

    const response = await report();

    expect(response.body.totals).toEqual({ count: 2, total: "2000.00", average: "1000.00" });
  });

  it("el promedio se redondea a 2 decimales", async () => {
    const p = await seedProduct("Lápiz", "10.00");
    await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 1 }] });
    await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 1 }] });
    await sell({ paymentMethod: "CASH", discount: "5", items: [{ productId: p, quantity: 1 }] });

    expect((await report()).body.totals).toEqual({ count: 3, total: "25.00", average: "8.33" });
  });

  it("agrupa por día local y suma cantidad y total de cada día", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    const items = [{ productId: p, quantity: 2 }];
    at("2026-11-03T14:00:00.000Z");
    await sell({ paymentMethod: "CASH", items });
    at("2026-11-04T02:59:00.000Z"); // 3/11 23:59 local: sigue siendo el 3/11
    await sell({ paymentMethod: "CARD", items });
    at("2026-11-04T10:00:00.000Z");
    await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 1 }] });

    const byDay = (await report("?from=2026-11-02&to=2026-11-04")).body.byDay;

    expect(byDay).toEqual([
      { date: "2026-11-02", count: 0, total: "0.00" },
      { date: "2026-11-03", count: 2, total: "400.00" },
      { date: "2026-11-04", count: 1, total: "100.00" },
    ]);
  });

  it("separa por medio de pago en orden fijo y agrupa las ventas a crédito aparte", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    const customerId = (await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } })).id;
    const one = [{ productId: p, quantity: 1 }];
    await sell({ paymentMethod: "DIGITAL_WALLET", items: one });
    await sell({ onCredit: true, customerId, items: [{ productId: p, quantity: 3 }] });
    await sell({ paymentMethod: "CASH", items: one });
    await sell({ paymentMethod: "CASH", items: one });
    await sell({ paymentMethod: "TRANSFER", items: one });

    const methods = (await report()).body.byPaymentMethod;

    expect(methods).toEqual([
      { method: "CASH", count: 2, total: "200.00" },
      { method: "TRANSFER", count: 1, total: "100.00" },
      { method: "DIGITAL_WALLET", count: 1, total: "100.00" },
      { method: "ON_CREDIT", count: 1, total: "300.00" },
    ]);
  });

  it("los productos más vendidos van por cantidad, desempatan por importe y luego por nombre", async () => {
    const lapiz = await seedProduct("Lápiz", "10.00");
    const goma = await seedProduct("Goma", "20.00");
    const regla = await seedProduct("Regla", "20.00");
    const cuaderno = await seedProduct("Cuaderno", "500.00");
    await sell({
      paymentMethod: "CASH",
      items: [
        { productId: lapiz, quantity: 10 },
        { productId: goma, quantity: 3 },
        { productId: regla, quantity: 3 },
        { productId: cuaderno, quantity: 3 },
      ],
    });
    await sell({ paymentMethod: "CASH", items: [{ productId: lapiz, quantity: 5 }] });

    const top = (await report()).body.topProducts;

    expect(top).toEqual([
      { productId: lapiz, productName: "Lápiz", quantity: 15, total: "150.00" },
      { productId: cuaderno, productName: "Cuaderno", quantity: 3, total: "1500.00" }, // mismas unidades, más importe
      { productId: goma, productName: "Goma", quantity: 3, total: "60.00" }, // empate total: por nombre
      { productId: regla, productName: "Regla", quantity: 3, total: "60.00" },
    ]);
  });

  it("los productos más vendidos son solo 10 y no cuentan las ventas anuladas ni las de otro período", async () => {
    const ids: number[] = [];
    for (let i = 1; i <= 11; i++) ids.push(await seedProduct(`Producto ${String(i).padStart(2, "0")}`, "10.00"));
    await sell({ paymentMethod: "CASH", items: ids.map((productId, i) => ({ productId, quantity: i + 1 })) }); // 1..11 unidades
    const annulled = await sell({ paymentMethod: "CASH", items: [{ productId: ids[0], quantity: 50 }] });
    await agent.post(`/api/sales/${annulled.body.id}/annul`).send({ reason: "Error" });
    at("2026-09-01T15:00:00.000Z");
    await sell({ paymentMethod: "CASH", items: [{ productId: ids[0], quantity: 70 }] });
    at("2026-11-04T15:00:00.000Z");

    const top = (await report()).body.topProducts;

    expect(top).toHaveLength(10);
    expect(top[0]).toMatchObject({ productName: "Producto 11", quantity: 11 });
    expect(top.map((p: { productName: string }) => p.productName)).not.toContain("Producto 01"); // 1 unidad: quedó fuera
  });

  it("el importe de un producto es cantidad × precio de la venta, no el precio actual", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    await sell({ paymentMethod: "CASH", items: [{ productId: p, quantity: 2 }] });
    await prisma.product.update({ where: { id: p }, data: { salePrice: "999.00" } });

    expect((await report()).body.topProducts[0]).toMatchObject({ quantity: 2, total: "200.00" });
  });
});

describe("GET /api/reports/debt", () => {
  it("sin cuentas pendientes devuelve ceros", async () => {
    expect((await agent.get("/api/reports/debt")).body).toEqual({ totalBalance: "0.00", totalPayable: "0.00", accounts: [] });
  });

  it("lista las cuentas pendientes de mayor a menor monto a pagar, con totales; las canceladas no aparecen", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    const ana = (await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } })).id;
    const beto = (await prisma.customer.create({ data: { name: "Beto", creditAuthorized: true } })).id;
    const carla = (await prisma.customer.create({ data: { name: "Carla", creditAuthorized: true } })).id;
    await sell({ onCredit: true, customerId: ana, items: [{ productId: p, quantity: 2 }] }); // 200
    await sell({ onCredit: true, customerId: beto, items: [{ productId: p, quantity: 5 }] }); // 500
    const cancelled = await sell({ onCredit: true, customerId: carla, items: [{ productId: p, quantity: 9 }] });
    await agent.post(`/api/sales/${cancelled.body.id}/annul`).send({ reason: "Error" });

    const response = await agent.get("/api/reports/debt");

    expect(response.body.accounts.map((a: { customer: { name: string } }) => a.customer.name)).toEqual(["Beto", "Ana"]);
    expect(response.body.accounts[0]).toMatchObject({ balance: "500.00", payable: "500.00", overdue: false, monthsOverdue: 0 });
    expect(response.body.totalBalance).toBe("700.00");
    expect(response.body.totalPayable).toBe("700.00");
  });

  it("incluye los recargos que ya corresponden en lo que hay que pagar y marca las vencidas", async () => {
    const p = await seedProduct("Cuaderno", "1000.00");
    const ana = (await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } })).id;
    await sell({ onCredit: true, customerId: ana, items: [{ productId: p, quantity: 1 }] }); // vence 4/12 15:00
    at("2027-01-04T15:00:00.000Z"); // un mes de atraso completo

    const response = await agent.get("/api/reports/debt");

    expect(response.body.accounts[0]).toMatchObject({ balance: "1000.00", payable: "1050.00", overdue: true, monthsOverdue: 1 });
    expect(response.body.totalBalance).toBe("1000.00");
    expect(response.body.totalPayable).toBe("1050.00");
  });

  it("ordena por lo que hay que pagar hoy (con recargos), no solo por el saldo", async () => {
    const caro = await seedProduct("Mochila", "1020.00");
    const barato = await seedProduct("Cuaderno", "1000.00");
    const ana = (await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } })).id;
    const beto = (await prisma.customer.create({ data: { name: "Beto", creditAuthorized: true } })).id;
    await sell({ onCredit: true, customerId: ana, items: [{ productId: barato, quantity: 1 }] }); // 4/11: vence 4/12
    at("2026-12-20T15:00:00.000Z");
    await sell({ onCredit: true, customerId: beto, items: [{ productId: caro, quantity: 1 }] }); // vence 20/1
    at("2027-01-04T15:00:00.000Z"); // Ana lleva un mes de atraso: debe 1000 + 50; Beto no está vencido

    const accounts = (await agent.get("/api/reports/debt")).body.accounts;

    expect(accounts.map((a: { customer: { name: string }; balance: string; payable: string }) => [a.customer.name, a.balance, a.payable])).toEqual([
      ["Ana", "1000.00", "1050.00"], // saldo menor que el de Beto, pero debe más hoy
      ["Beto", "1020.00", "1020.00"],
    ]);
  });

  it("desempata por nombre cuando deben lo mismo", async () => {
    const p = await seedProduct("Cuaderno", "100.00");
    for (const name of ["Zoe", "Ana"]) {
      const customerId = (await prisma.customer.create({ data: { name, creditAuthorized: true } })).id;
      await sell({ onCredit: true, customerId, items: [{ productId: p, quantity: 1 }] });
    }

    const names = (await agent.get("/api/reports/debt")).body.accounts.map((a: { customer: { name: string } }) => a.customer.name);

    expect(names).toEqual(["Ana", "Zoe"]);
  });
});
