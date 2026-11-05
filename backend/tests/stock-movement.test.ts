import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { createUser, loginAgent } from "./helpers/users.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

let agent: Awaited<ReturnType<typeof loginAgent>>;
let productId: number;

beforeEach(async () => {
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  const category = await prisma.category.create({ data: { name: "Papelería" } });
  productId = (await prisma.product.create({ data: { name: "Cuaderno", categoryId: category.id, salePrice: "10.00" } })).id;
});
afterAll(() => prisma.$disconnect());

const initial = (quantity: number, extra: object = {}) => ({ type: "INITIAL_STOCK", productId, quantity, ...extra });
const adjust = (quantity: number, reason = "PHYSICAL_COUNT", extra: object = {}) => ({
  type: "ADJUSTMENT",
  productId,
  quantity,
  reason,
  ...extra,
});

// Stock real según la base, para comprobar que la API guardó (o no) lo que dijo.
async function stockInDb(id = productId) {
  return (await prisma.stockMovement.aggregate({ where: { productId: id }, _sum: { quantity: true } }))._sum.quantity ?? 0;
}

describe("acceso", () => {
  it("sin sesión, listar y registrar movimientos responde 401", async () => {
    expect((await request(app).get("/api/stock-movements")).status).toBe(401);
    expect((await request(app).post("/api/stock-movements").send(initial(5))).status).toBe(401);
  });

  it("no existe forma de editar ni borrar un movimiento", async () => {
    const created = await agent.post("/api/stock-movements").send(initial(5));

    expect((await agent.put(`/api/stock-movements/${created.body.id}`).send(initial(9))).status).toBe(404);
    expect((await agent.delete(`/api/stock-movements/${created.body.id}`)).status).toBe(404);
    expect(await stockInDb()).toBe(5);
  });
});

describe("POST /api/stock-movements – stock inicial", () => {
  it("registra el stock inicial y devuelve el movimiento con el stock que quedó", async () => {
    const response = await agent.post("/api/stock-movements").send(initial(20, { note: "Conteo de apertura" }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      productId,
      productName: "Cuaderno",
      type: "INITIAL_STOCK",
      quantity: 20,
      reason: null,
      note: "Conteo de apertura",
      userName: "Ana Propietaria",
      stock: 20,
    });
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(await stockInDb()).toBe(20);
  });

  it("guarda quién lo registró según la sesión y no según lo que mande el cliente", async () => {
    const other = await createUser(prisma, { username: "beto", fullName: "Beto" });

    const response = await agent.post("/api/stock-movements").send(initial(5, { userId: other.id }));

    const logged = await prisma.user.findUniqueOrThrow({ where: { username: "ana" } });
    expect(response.body.userId).toBe(logged.id);
    expect(response.body.userName).toBe("Ana Propietaria");
  });

  it.each([
    ["cero", 0],
    ["negativa", -5],
    ["decimal", 2.5],
    ["texto", "5"],
  ])("rechaza una cantidad %s", async (_name, quantity) => {
    const response = await agent.post("/api/stock-movements").send(initial(quantity as number));

    expect(response.status).toBe(400);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("rechaza un segundo stock inicial del mismo producto", async () => {
    await agent.post("/api/stock-movements").send(initial(5));

    const response = await agent.post("/api/stock-movements").send(initial(8));

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("usá un ajuste");
    expect(await stockInDb()).toBe(5);
  });

  it("rechaza el stock inicial si el producto ya tiene un ajuste", async () => {
    await agent.post("/api/stock-movements").send(adjust(3));

    const response = await agent.post("/api/stock-movements").send(initial(8));

    expect(response.status).toBe(409);
    expect(await stockInDb()).toBe(3);
  });

  it("cada producto tiene su propio stock inicial", async () => {
    const other = await prisma.product.create({
      data: { name: "Lápiz", categoryId: (await prisma.category.findFirstOrThrow()).id, salePrice: "5.00" },
    });
    await agent.post("/api/stock-movements").send(initial(5));

    const response = await agent.post("/api/stock-movements").send({ ...initial(7), productId: other.id });

    expect(response.status).toBe(201);
    expect(await stockInDb()).toBe(5);
    expect(await stockInDb(other.id)).toBe(7);
  });
});

describe("POST /api/stock-movements – ajustes", () => {
  it("un ajuste positivo suma al stock", async () => {
    await agent.post("/api/stock-movements").send(initial(10));

    const response = await agent.post("/api/stock-movements").send(adjust(4, "PHYSICAL_COUNT"));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ type: "ADJUSTMENT", quantity: 4, reason: "PHYSICAL_COUNT", stock: 14 });
  });

  it("un ajuste negativo resta del stock", async () => {
    await agent.post("/api/stock-movements").send(initial(10));

    const response = await agent.post("/api/stock-movements").send(adjust(-3, "DAMAGE_OR_LOSS"));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ quantity: -3, reason: "DAMAGE_OR_LOSS", stock: 7 });
    expect(await stockInDb()).toBe(7);
  });

  it("acepta cada motivo de la lista fija", async () => {
    await agent.post("/api/stock-movements").send(initial(50));

    for (const reason of ["PHYSICAL_COUNT", "DAMAGE_OR_LOSS", "SUPPLIER_RETURN"]) {
      expect((await agent.post("/api/stock-movements").send(adjust(-1, reason))).status).toBe(201);
    }
    expect((await agent.post("/api/stock-movements").send(adjust(-1, "OTHER", { note: "Se mojó" }))).status).toBe(201);
    expect(await stockInDb()).toBe(46);
  });

  it("permite dejar el stock exactamente en cero", async () => {
    await agent.post("/api/stock-movements").send(initial(5));

    const response = await agent.post("/api/stock-movements").send(adjust(-5));

    expect(response.status).toBe(201);
    expect(response.body.stock).toBe(0);
  });

  it("no permite dejar el stock en negativo y no guarda nada", async () => {
    await agent.post("/api/stock-movements").send(initial(5));

    const response = await agent.post("/api/stock-movements").send(adjust(-6));

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("stock actual: 5");
    expect(await stockInDb()).toBe(5);
    expect(await prisma.stockMovement.count()).toBe(1);
  });

  it("un producto sin movimientos tiene stock 0: restar da 409 y sumar funciona", async () => {
    expect((await agent.post("/api/stock-movements").send(adjust(-1))).status).toBe(409);

    const response = await agent.post("/api/stock-movements").send(adjust(3));

    expect(response.status).toBe(201);
    expect(response.body.stock).toBe(3);
  });

  it("rechaza un ajuste sin motivo o con un motivo que no está en la lista", async () => {
    const { reason: _omit, ...withoutReason } = adjust(1);

    expect((await agent.post("/api/stock-movements").send(withoutReason)).status).toBe(400);
    expect((await agent.post("/api/stock-movements").send(adjust(1, "ME_DIO_LA_GANA"))).status).toBe(400);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it.each([
    ["cero", 0],
    ["decimal", 1.5],
  ])("rechaza un ajuste de cantidad %s", async (_name, quantity) => {
    const response = await agent.post("/api/stock-movements").send(adjust(quantity));

    expect(response.status).toBe(400);
  });

  it('con el motivo "otro" exige una nota, y una nota en blanco no vale', async () => {
    const withoutNote = await agent.post("/api/stock-movements").send(adjust(1, "OTHER"));
    const blankNote = await agent.post("/api/stock-movements").send(adjust(1, "OTHER", { note: "   " }));

    expect(withoutNote.status).toBe(400);
    expect(withoutNote.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: "note" })]));
    expect(blankNote.status).toBe(400);
  });

  it("una nota en blanco con otro motivo se guarda como sin nota", async () => {
    const response = await agent.post("/api/stock-movements").send(adjust(2, "PHYSICAL_COUNT", { note: "   " }));

    expect(response.status).toBe(201);
    expect(response.body.note).toBeNull();
  });

  it("recorta los espacios de la nota y rechaza una nota demasiado larga", async () => {
    const ok = await agent.post("/api/stock-movements").send(adjust(2, "OTHER", { note: "  Regalo  " }));
    const tooLong = await agent.post("/api/stock-movements").send(adjust(2, "OTHER", { note: "x".repeat(501) }));

    expect(ok.body.note).toBe("Regalo");
    expect(tooLong.status).toBe(400);
  });

  it("acepta ajustes de un producto dado de baja", async () => {
    await agent.post("/api/stock-movements").send(initial(5));
    await prisma.product.update({ where: { id: productId }, data: { active: false } });

    const response = await agent.post("/api/stock-movements").send(adjust(-5));

    expect(response.status).toBe(201);
    expect(response.body.stock).toBe(0);
  });

  it("dos ajustes al mismo tiempo no pueden dejar el stock en negativo", async () => {
    await agent.post("/api/stock-movements").send(initial(5));

    const responses = await Promise.all([
      agent.post("/api/stock-movements").send(adjust(-3)),
      agent.post("/api/stock-movements").send(adjust(-3)),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockInDb()).toBe(2);
  });
});

describe("POST /api/stock-movements – datos inválidos", () => {
  it("responde 404 si el producto no existe", async () => {
    const response = await agent.post("/api/stock-movements").send({ ...initial(5), productId: 999 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("El producto no existe");
  });

  it.each([
    ["sin producto", { type: "INITIAL_STOCK", quantity: 5 }],
    ["producto no numérico", { type: "INITIAL_STOCK", productId: "uno", quantity: 5 }],
    ["tipo desconocido", { type: "VENTA", productId: 1, quantity: 5 }],
    ["sin tipo", { productId: 1, quantity: 5 }],
    ["cuerpo vacío", {}],
  ])("responde 400 con %s", async (_name, body) => {
    const response = await agent.post("/api/stock-movements").send(body);

    expect(response.status).toBe(400);
  });
});

describe("GET /api/stock-movements", () => {
  it("lista los movimientos del más nuevo al más viejo, con nombres de producto y usuario", async () => {
    await agent.post("/api/stock-movements").send(initial(10));
    await agent.post("/api/stock-movements").send(adjust(-2, "DAMAGE_OR_LOSS"));

    const response = await agent.get("/api/stock-movements");

    expect(response.status).toBe(200);
    expect(response.body.map((m: { quantity: number }) => m.quantity)).toEqual([-2, 10]);
    expect(response.body[0]).toMatchObject({ productName: "Cuaderno", userName: "Ana Propietaria", reason: "DAMAGE_OR_LOSS" });
  });

  it("filtra por producto", async () => {
    const other = await prisma.product.create({
      data: { name: "Lápiz", categoryId: (await prisma.category.findFirstOrThrow()).id, salePrice: "5.00" },
    });
    await agent.post("/api/stock-movements").send(initial(10));
    await agent.post("/api/stock-movements").send({ ...initial(7), productId: other.id });

    const response = await agent.get(`/api/stock-movements?productId=${other.id}`);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].productName).toBe("Lápiz");
  });

  it("respeta el límite y rechaza límites inválidos", async () => {
    await agent.post("/api/stock-movements").send(initial(10));
    await agent.post("/api/stock-movements").send(adjust(1));
    await agent.post("/api/stock-movements").send(adjust(1));

    expect((await agent.get("/api/stock-movements?limit=2")).body).toHaveLength(2);
    expect((await agent.get("/api/stock-movements?limit=0")).status).toBe(400);
    expect((await agent.get("/api/stock-movements?limit=201")).status).toBe(400);
    expect((await agent.get("/api/stock-movements?productId=abc")).status).toBe(400);
  });

  it("sin movimientos devuelve una lista vacía", async () => {
    const response = await agent.get("/api/stock-movements");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
