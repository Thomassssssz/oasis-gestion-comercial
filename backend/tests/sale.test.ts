import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { createUser, loginAgent } from "./helpers/users.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

let agent: Awaited<ReturnType<typeof loginAgent>>;
let categoryId: number;
let userId: number;

beforeEach(async () => {
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  userId = (await prisma.user.findFirstOrThrow()).id;
  categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
});
afterAll(() => prisma.$disconnect());

// Crea un producto con su stock inicial cargado directamente en la base.
async function seedProduct(name: string, salePrice: string, stock: number, active = true) {
  const product = await prisma.product.create({ data: { name, categoryId, salePrice, active } });
  if (stock > 0) {
    await prisma.stockMovement.create({ data: { productId: product.id, userId, type: "INITIAL_STOCK", quantity: stock } });
  }
  return product.id;
}

async function stockOf(productId: number) {
  return (await prisma.stockMovement.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity ?? 0;
}

const sell = (items: { productId: number; quantity: number }[], paymentMethod = "CASH") =>
  agent.post("/api/sales").send({ paymentMethod, items });

describe("acceso", () => {
  it("sin sesión, todas las rutas de ventas responden 401", async () => {
    expect((await request(app).get("/api/sales")).status).toBe(401);
    expect((await request(app).get("/api/sales/1")).status).toBe(401);
    expect((await request(app).post("/api/sales").send({})).status).toBe(401);
    expect((await request(app).post("/api/sales/1/annul").send({})).status).toBe(401);
  });

  it("no existe forma de editar ni borrar una venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1500.50", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 1 }]);

    expect((await agent.put(`/api/sales/${sale.body.id}`).send({})).status).toBe(404);
    expect((await agent.delete(`/api/sales/${sale.body.id}`)).status).toBe(404);
    expect(await prisma.sale.count()).toBe(1);
  });
});

describe("POST /api/sales", () => {
  it("registra la venta con el total exacto calculado y los ítems con su subtotal", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1500.50", 10);
    const lapiz = await seedProduct("Lápiz", "300.25", 10);

    const response = await sell([
      { productId: cuaderno, quantity: 2 },
      { productId: lapiz, quantity: 3 },
    ]);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      status: "CONFIRMED",
      paymentMethod: "CASH",
      total: "3901.75", // 2 × 1500.50 + 3 × 300.25, sin errores de redondeo
      userName: "Ana Propietaria",
      annulment: null,
    });
    expect(response.body.items).toEqual([
      { productId: cuaderno, productName: "Cuaderno", quantity: 2, unitPrice: "1500.50", subtotal: "3001.00" },
      { productId: lapiz, productName: "Lápiz", quantity: 3, unitPrice: "300.25", subtotal: "900.75" },
    ]);
    expect(response.body.createdAt).toEqual(expect.any(String));
  });

  it("descuenta el stock con un movimiento de tipo venta por ítem, ligado a la venta y al usuario", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1500.50", 10);

    const response = await sell([{ productId: cuaderno, quantity: 4 }]);

    expect(await stockOf(cuaderno)).toBe(6);
    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { type: "SALE" } });
    expect(movement).toMatchObject({ productId: cuaderno, quantity: -4, saleId: response.body.id, userId });
  });

  it("guarda quién la registró según la sesión y no según lo que mande el cliente", async () => {
    const other = await createUser(prisma, { username: "beto", fullName: "Beto" });
    const cuaderno = await seedProduct("Cuaderno", "100.00", 5);

    const response = await agent
      .post("/api/sales")
      .send({ paymentMethod: "CASH", userId: other.id, items: [{ productId: cuaderno, quantity: 1 }] });

    expect(response.body.userId).toBe(userId);
    expect(response.body.userName).toBe("Ana Propietaria");
  });

  it("usa el precio de lista de hoy; un cambio de precio posterior no altera la venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1500.50", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 2 }]);

    await prisma.product.update({ where: { id: cuaderno }, data: { salePrice: "9999.00" } });
    const detail = await agent.get(`/api/sales/${sale.body.id}`);

    expect(detail.body.total).toBe("3001.00");
    expect(detail.body.items[0].unitPrice).toBe("1500.50");
  });

  it("ignora un precio que mande el cliente: siempre se usa el de lista (D13-a)", async () => {
    const cuaderno = await seedProduct("Cuaderno", "1500.50", 10);

    const response = await agent
      .post("/api/sales")
      .send({ paymentMethod: "CASH", items: [{ productId: cuaderno, quantity: 1, unitPrice: "1.00" }] });

    expect(response.body.total).toBe("1500.50");
  });

  it.each(["CASH", "TRANSFER", "CARD", "DIGITAL_WALLET"])("acepta el medio de pago %s", async (method) => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);

    const response = await sell([{ productId: cuaderno, quantity: 1 }], method);

    expect(response.status).toBe(201);
    expect(response.body.paymentMethod).toBe(method);
  });

  it("permite vender justo todo el stock disponible", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 3);

    const response = await sell([{ productId: cuaderno, quantity: 3 }]);

    expect(response.status).toBe(201);
    expect(await stockOf(cuaderno)).toBe(0);
  });

  it("rechaza con 409 si no hay stock suficiente y no guarda nada", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 3);

    const response = await sell([{ productId: cuaderno, quantity: 4 }]);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('No hay stock suficiente de "Cuaderno" (stock actual: 3)');
    expect(await prisma.sale.count()).toBe(0);
    expect(await stockOf(cuaderno)).toBe(3);
  });

  it("rechaza un producto sin ningún movimiento (stock 0)", async () => {
    const vacio = await seedProduct("Vacío", "100.00", 0);

    const response = await sell([{ productId: vacio, quantity: 1 }]);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("stock actual: 0");
  });

  it("es todo o nada: si un ítem no alcanza, ninguno se vende", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const lapiz = await seedProduct("Lápiz", "50.00", 1);

    const response = await sell([
      { productId: cuaderno, quantity: 5 },
      { productId: lapiz, quantity: 2 },
    ]);

    expect(response.status).toBe(409);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.saleItem.count()).toBe(0);
    expect(await stockOf(cuaderno)).toBe(10);
    expect(await stockOf(lapiz)).toBe(1);
  });

  it("no deja vender un producto dado de baja", async () => {
    const viejo = await seedProduct("Viejo", "100.00", 10, false);

    const response = await sell([{ productId: viejo, quantity: 1 }]);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("dado de baja");
    expect(await prisma.sale.count()).toBe(0);
  });

  it("responde 400 si un producto no existe", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);

    const response = await sell([
      { productId: cuaderno, quantity: 1 },
      { productId: 999, quantity: 1 },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("El producto 999 no existe");
    expect(await prisma.sale.count()).toBe(0);
  });

  it("dos ventas al mismo tiempo no pueden vender el mismo stock dos veces", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 5);

    const responses = await Promise.all([
      sell([{ productId: cuaderno, quantity: 3 }]),
      sell([{ productId: cuaderno, quantity: 3 }]),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(cuaderno)).toBe(2);
    expect(await prisma.sale.count()).toBe(1);
  });

  it("dos ventas simultáneas con los mismos productos en distinto orden no se traban entre sí", async () => {
    const a = await seedProduct("A", "10.00", 10);
    const b = await seedProduct("B", "10.00", 10);

    const responses = await Promise.all([
      sell([{ productId: a, quantity: 1 }, { productId: b, quantity: 1 }]),
      sell([{ productId: b, quantity: 1 }, { productId: a, quantity: 1 }]),
    ]);

    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(await stockOf(a)).toBe(8);
    expect(await stockOf(b)).toBe(8);
  });
});

describe("POST /api/sales – datos inválidos", () => {
  it.each([
    ["sin medio de pago", { items: [{ productId: 1, quantity: 1 }] }],
    ["medio de pago desconocido", { paymentMethod: "CHEQUE", items: [{ productId: 1, quantity: 1 }] }],
    ["sin ítems", { paymentMethod: "CASH" }],
    ["lista de ítems vacía", { paymentMethod: "CASH", items: [] }],
    ["ítems que no son una lista", { paymentMethod: "CASH", items: "uno" }],
    ["producto sin id", { paymentMethod: "CASH", items: [{ quantity: 1 }] }],
    ["producto con id de texto", { paymentMethod: "CASH", items: [{ productId: "1", quantity: 1 }] }],
    ["cantidad cero", { paymentMethod: "CASH", items: [{ productId: 1, quantity: 0 }] }],
    ["cantidad negativa", { paymentMethod: "CASH", items: [{ productId: 1, quantity: -2 }] }],
    ["cantidad decimal", { paymentMethod: "CASH", items: [{ productId: 1, quantity: 1.5 }] }],
    ["cantidad de texto", { paymentMethod: "CASH", items: [{ productId: 1, quantity: "2" }] }],
    ["cuerpo vacío", {}],
  ])("responde 400 con %s", async (_name, body) => {
    const response = await agent.post("/api/sales").send(body);

    expect(response.status).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("rechaza repetir un producto en la misma venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);

    const response = await sell([
      { productId: cuaderno, quantity: 1 },
      { productId: cuaderno, quantity: 2 },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error + JSON.stringify(response.body.details)).toContain("no puede repetirse");
  });

  it("rechaza una venta con más de 100 productos distintos", async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ productId: i + 1, quantity: 1 }));

    expect((await sell(items)).status).toBe(400);
  });
});

describe("GET /api/sales", () => {
  it("lista del más nuevo al más viejo, con total, ítems y nombres", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    const first = await sell([{ productId: cuaderno, quantity: 1 }], "CASH");
    const second = await sell([{ productId: cuaderno, quantity: 2 }], "CARD");

    const response = await agent.get("/api/sales");

    expect(response.status).toBe(200);
    expect(response.body.map((s: { id: number }) => s.id)).toEqual([second.body.id, first.body.id]);
    expect(response.body[0]).toMatchObject({ total: "200.00", paymentMethod: "CARD", userName: "Ana Propietaria" });
    expect(response.body[0].items).toHaveLength(1);
  });

  it("filtra por estado y por medio de pago", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    const cash = await sell([{ productId: cuaderno, quantity: 1 }], "CASH");
    await sell([{ productId: cuaderno, quantity: 1 }], "CARD");
    await agent.post(`/api/sales/${cash.body.id}/annul`).send({ reason: "Error de carga" });

    const annulled = await agent.get("/api/sales?status=ANNULLED");
    const confirmed = await agent.get("/api/sales?status=CONFIRMED");
    const byCard = await agent.get("/api/sales?paymentMethod=CARD");

    expect(annulled.body.map((s: { id: number }) => s.id)).toEqual([cash.body.id]);
    expect(confirmed.body).toHaveLength(1);
    expect(confirmed.body[0].paymentMethod).toBe("CARD");
    expect(byCard.body).toHaveLength(1);
  });

  it("respeta el límite y rechaza filtros inválidos", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    await sell([{ productId: cuaderno, quantity: 1 }]);
    await sell([{ productId: cuaderno, quantity: 1 }]);
    await sell([{ productId: cuaderno, quantity: 1 }]);

    expect((await agent.get("/api/sales?limit=2")).body).toHaveLength(2);
    expect((await agent.get("/api/sales?limit=0")).status).toBe(400);
    expect((await agent.get("/api/sales?limit=201")).status).toBe(400);
    expect((await agent.get("/api/sales?status=BORRADA")).status).toBe(400);
    expect((await agent.get("/api/sales?paymentMethod=CHEQUE")).status).toBe(400);
  });

  it("sin ventas devuelve una lista vacía", async () => {
    const response = await agent.get("/api/sales");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /api/sales/:id", () => {
  it("devuelve el detalle de la venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 20);
    const sale = await sell([{ productId: cuaderno, quantity: 3 }]);

    const response = await agent.get(`/api/sales/${sale.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: sale.body.id, total: "300.00", items: [{ quantity: 3, subtotal: "300.00" }] });
  });

  it("responde 404 si no existe y 400 si el id no es válido", async () => {
    expect((await agent.get("/api/sales/999")).status).toBe(404);
    expect((await agent.get("/api/sales/abc")).status).toBe(400);
  });
});

describe("POST /api/sales/:id/annul", () => {
  it("anula la venta, guarda quién, cuándo y por qué, y devuelve el stock", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 4 }]);
    expect(await stockOf(cuaderno)).toBe(6);

    const response = await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Cargué mal el producto" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ANNULLED");
    expect(response.body.annulment).toMatchObject({ byId: userId, byName: "Ana Propietaria", reason: "Cargué mal el producto" });
    expect(response.body.annulment.at).toEqual(expect.any(String));
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("devuelve el stock con un movimiento propio (anulación) ligado a la venta, y no borra el de la venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 4 }]);

    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    const movements = await prisma.stockMovement.findMany({ where: { saleId: sale.body.id }, orderBy: { id: "asc" } });
    expect(movements.map((m) => [m.type, m.quantity, m.userId])).toEqual([
      ["SALE", -4, userId],
      ["SALE_ANNULMENT", 4, userId],
    ]);
  });

  it("la venta anulada sigue en el historial con sus ítems y su total", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 2 }]);
    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    const detail = await agent.get(`/api/sales/${sale.body.id}`);

    expect(detail.body).toMatchObject({ status: "ANNULLED", total: "200.00", items: [{ quantity: 2 }] });
    expect(await prisma.sale.count()).toBe(1);
  });

  it("devuelve cada ítem de una venta con varios productos", async () => {
    const a = await seedProduct("A", "10.00", 10);
    const b = await seedProduct("B", "10.00", 10);
    const sale = await sell([{ productId: a, quantity: 3 }, { productId: b, quantity: 5 }]);

    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    expect(await stockOf(a)).toBe(10);
    expect(await stockOf(b)).toBe(10);
  });

  it("no se puede anular dos veces: 409 y el stock se devuelve una sola vez", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 4 }]);
    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    const again = await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Otra vez" });

    expect(again.status).toBe(409);
    expect(again.body.error).toBe("La venta ya está anulada");
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("dos anulaciones al mismo tiempo: solo una vale y el stock se devuelve una vez", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 4 }]);

    const responses = await Promise.all([
      agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "A" }),
      agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "B" }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("exige un motivo, sin espacios sobrantes y de hasta 500 caracteres", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 1 }]);
    const url = `/api/sales/${sale.body.id}/annul`;

    expect((await agent.post(url).send({})).status).toBe(400);
    expect((await agent.post(url).send({ reason: "   " })).status).toBe(400);
    expect((await agent.post(url).send({ reason: "x".repeat(501) })).status).toBe(400);
    expect((await agent.get(`/api/sales/${sale.body.id}`)).body.status).toBe("CONFIRMED");

    const ok = await agent.post(url).send({ reason: "  Se equivocó  " });
    expect(ok.body.annulment.reason).toBe("Se equivocó");
  });

  it("responde 404 si la venta no existe y 400 si el id no es válido", async () => {
    expect((await agent.post("/api/sales/999/annul").send({ reason: "x" })).status).toBe(404);
    expect((await agent.post("/api/sales/abc/annul").send({ reason: "x" })).status).toBe(400);
  });

  it("anular una venta de un producto dado de baja después igual devuelve el stock", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 10);
    const sale = await sell([{ productId: cuaderno, quantity: 4 }]);
    await prisma.product.update({ where: { id: cuaderno }, data: { active: false } });

    const response = await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    expect(response.status).toBe(200);
    expect(await stockOf(cuaderno)).toBe(10);
  });

  it("el stock vuelve a estar disponible para vender después de anular", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 5);
    const sale = await sell([{ productId: cuaderno, quantity: 5 }]);
    expect((await sell([{ productId: cuaderno, quantity: 1 }])).status).toBe(409);

    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Error" });

    expect((await sell([{ productId: cuaderno, quantity: 5 }])).status).toBe(201);
  });
});

describe("integración con productos y movimientos", () => {
  it("el stock del producto baja con la venta y la alerta de stock mínimo se activa", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 8);
    await prisma.product.update({ where: { id: cuaderno }, data: { minStock: 5 } });
    expect((await agent.get(`/api/products/${cuaderno}`)).body).toMatchObject({ stock: 8, lowStock: false });

    await sell([{ productId: cuaderno, quantity: 3 }]);

    expect((await agent.get(`/api/products/${cuaderno}`)).body).toMatchObject({ stock: 5, lowStock: true });
  });

  it("los movimientos de venta aparecen en el historial de inventario con su venta", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 8);
    const sale = await sell([{ productId: cuaderno, quantity: 3 }]);

    const movements = (await agent.get("/api/stock-movements")).body as { type: string; quantity: number; saleId: number | null }[];

    expect(movements[0]).toMatchObject({ type: "SALE", quantity: -3, saleId: sale.body.id });
    expect(movements[1]).toMatchObject({ type: "INITIAL_STOCK", saleId: null });
  });

  it("un ajuste manual no puede dejar el stock en negativo después de vender", async () => {
    const cuaderno = await seedProduct("Cuaderno", "100.00", 5);
    await sell([{ productId: cuaderno, quantity: 4 }]);

    const response = await agent
      .post("/api/stock-movements")
      .send({ type: "ADJUSTMENT", productId: cuaderno, quantity: -2, reason: "PHYSICAL_COUNT" });

    expect(response.status).toBe(409);
  });
});
