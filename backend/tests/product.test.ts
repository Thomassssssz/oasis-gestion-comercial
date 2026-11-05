import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

// Todas las rutas son privadas: cada prueba arranca con un usuario que ya inició sesión.
let agent: Awaited<ReturnType<typeof loginAgent>>;

beforeEach(async () => {
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
});
afterAll(() => prisma.$disconnect());

async function createCategory(name = "Papelería") {
  return (await prisma.category.create({ data: { name } })).id;
}

type NewProduct = { name?: string; categoryId: number; salePrice?: string | number; minStock?: number };

async function createProduct({ name = "Cuaderno", salePrice = "1500.50", ...rest }: NewProduct) {
  const response = await agent.post("/api/products").send({ name, salePrice, ...rest });
  return response.body as { id: number; name: string };
}

describe("POST /api/products", () => {
  it("crea un producto activo con el precio exacto y responde 201", async () => {
    const categoryId = await createCategory();

    const response = await agent
      .post("/api/products")
      .send({ name: "Cuaderno", categoryId, salePrice: "1500.5", minStock: 5 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      name: "Cuaderno",
      categoryId,
      category: { id: categoryId, name: "Papelería" },
      salePrice: "1500.50",
      minStock: 5,
      active: true,
    });
  });

  it("usa stock mínimo 0 si no se indica", async () => {
    const categoryId = await createCategory();

    const response = await agent.post("/api/products").send({ name: "Lapicera", categoryId, salePrice: 300 });

    expect(response.body.minStock).toBe(0);
    expect(response.body.salePrice).toBe("300.00");
  });

  it("quita los espacios sobrantes del nombre", async () => {
    const categoryId = await createCategory();

    const response = await agent.post("/api/products").send({ name: "  Goma  ", categoryId, salePrice: "50" });

    expect(response.body.name).toBe("Goma");
  });

  it.each([
    ["precio con 3 decimales", { salePrice: "10.123" }],
    ["precio negativo", { salePrice: "-5" }],
    ["precio cero", { salePrice: "0" }],
    ["precio con letras", { salePrice: "abc" }],
    ["precio ausente", { salePrice: undefined }],
    ["stock mínimo negativo", { minStock: -1 }],
    ["stock mínimo decimal", { minStock: 1.5 }],
    ["nombre vacío", { name: "  " }],
    ["nombre ausente", { name: undefined }],
  ])("rechaza con 400: %s", async (_caso, cambios) => {
    const categoryId = await createCategory();
    const body = { name: "Cuaderno", categoryId, salePrice: "100", ...cambios };

    const response = await agent.post("/api/products").send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
  });

  it("rechaza con 400 una categoría que no existe", async () => {
    const response = await agent.post("/api/products").send({ name: "Cuaderno", categoryId: 999, salePrice: "100" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "La categoría indicada no existe" });
  });

  it("rechaza con 400 si falta la categoría", async () => {
    const response = await agent.post("/api/products").send({ name: "Cuaderno", salePrice: "100" });

    expect(response.status).toBe(400);
  });
});

describe("GET /api/products", () => {
  it("lista los productos ordenados por nombre, con su categoría", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Regla", categoryId });
    await createProduct({ name: "Cuaderno", categoryId });

    const response = await agent.get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Cuaderno", "Regla"]);
    expect(response.body[0].category).toEqual({ id: categoryId, name: "Papelería" });
  });

  it("filtra por categoría", async () => {
    const papeleria = await createCategory("Papelería");
    const libreria = await createCategory("Librería");
    await createProduct({ name: "Cuaderno", categoryId: papeleria });
    await createProduct({ name: "Novela", categoryId: libreria });

    const response = await agent.get(`/api/products?categoryId=${libreria}`);

    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Novela"]);
  });

  it("busca por parte del nombre sin distinguir mayúsculas", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Lapicera azul", categoryId });
    await createProduct({ name: "Cuaderno", categoryId });

    const response = await agent.get("/api/products?search=LAPI");

    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Lapicera azul"]);
  });

  it("filtra por activos y dados de baja", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Activo", categoryId });
    const baja = await createProduct({ name: "De baja", categoryId });
    await agent
      .put(`/api/products/${baja.id}`)
      .send({ name: "De baja", categoryId, salePrice: "10", minStock: 0, active: false });

    const activos = await agent.get("/api/products?active=true");
    const bajas = await agent.get("/api/products?active=false");

    expect(activos.body.map((p: { name: string }) => p.name)).toEqual(["Activo"]);
    expect(bajas.body.map((p: { name: string }) => p.name)).toEqual(["De baja"]);
  });

  it("rechaza con 400 un filtro inválido", async () => {
    const response = await agent.get("/api/products?active=quizas");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/products/:id", () => {
  it("devuelve el producto pedido", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await agent.get(`/api/products/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Cuaderno", salePrice: "1500.50" });
  });

  it("responde 404 si no existe", async () => {
    const response = await agent.get("/api/products/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "El producto no existe" });
  });

  it("responde 400 si el id no es válido", async () => {
    expect((await agent.get("/api/products/abc")).status).toBe(400);
  });
});

describe("PUT /api/products/:id", () => {
  it("cambia los datos del producto", async () => {
    const categoryId = await createCategory();
    const otra = await createCategory("Librería");
    const { id } = await createProduct({ categoryId });

    const response = await agent
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno A4", categoryId: otra, salePrice: "2000", minStock: 10, active: true });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: "Cuaderno A4",
      categoryId: otra,
      salePrice: "2000.00",
      minStock: 10,
      active: true,
    });
  });

  it("da de baja un producto sin borrarlo", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await agent
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId, salePrice: "1500.50", minStock: 0, active: false });

    expect(response.body.active).toBe(false);
    expect((await agent.get(`/api/products/${id}`)).status).toBe(200);
  });

  it("responde 404 si el producto no existe", async () => {
    const categoryId = await createCategory();

    const response = await agent
      .put("/api/products/999")
      .send({ name: "X", categoryId, salePrice: "10", minStock: 0, active: true });

    expect(response.status).toBe(404);
  });

  it("responde 400 si la categoría nueva no existe", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await agent
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId: 999, salePrice: "10", minStock: 0, active: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "La categoría indicada no existe" });
  });

  it("responde 400 si falta indicar si está activo", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await agent
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId, salePrice: "10", minStock: 0 });

    expect(response.status).toBe(400);
  });
});

describe("borrado de productos", () => {
  it("no existe: los productos se dan de baja, no se borran", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await agent.delete(`/api/products/${id}`);

    expect(response.status).toBe(404);
    expect((await agent.get(`/api/products/${id}`)).status).toBe(200);
  });
});

describe("sin iniciar sesión", () => {
  it.each([
    ["GET", "/api/products"],
    ["GET", "/api/products/1"],
    ["POST", "/api/products"],
    ["PUT", "/api/products/1"],
  ] as const)("%s %s responde 401", async (method, path) => {
    const response = await request(app)[method.toLowerCase() as "get" | "post" | "put"](path);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Tenés que iniciar sesión" });
  });
});

describe("stock de los productos", () => {
  // Registra un movimiento por la API, como lo haría la pantalla.
  async function addStock(productId: number, quantity: number) {
    const response = await agent.post("/api/stock-movements").send({ type: "INITIAL_STOCK", productId, quantity });
    expect(response.status).toBe(201);
  }
  const adjustStock = (productId: number, quantity: number) =>
    agent.post("/api/stock-movements").send({ type: "ADJUSTMENT", productId, quantity, reason: "PHYSICAL_COUNT" });

  it("un producto nuevo tiene stock 0", async () => {
    const categoryId = await createCategory();

    const response = await agent.post("/api/products").send({ name: "Cuaderno", categoryId, salePrice: 10, minStock: 3 });

    expect(response.body).toMatchObject({ stock: 0, lowStock: true });
  });

  it("el stock es la suma de los movimientos y se ve en el listado, el detalle y al editar", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId, minStock: 2 });
    await addStock(id, 10);
    await adjustStock(id, -4);

    const list = await agent.get("/api/products");
    const detail = await agent.get(`/api/products/${id}`);
    const updated = await agent.put(`/api/products/${id}`).send({ name: "Cuaderno", categoryId, salePrice: "1500.50", minStock: 2, active: true });

    expect(list.body[0]).toMatchObject({ stock: 6, lowStock: false });
    expect(detail.body).toMatchObject({ stock: 6, lowStock: false });
    expect(updated.body).toMatchObject({ stock: 6, lowStock: false });
  });

  it("cada producto muestra solo su propio stock", async () => {
    const categoryId = await createCategory();
    const a = await createProduct({ name: "Cuaderno", categoryId });
    const b = await createProduct({ name: "Lápiz", categoryId });
    await addStock(a.id, 7);

    const list = await agent.get("/api/products");

    expect(list.body.map((p: { name: string; stock: number }) => [p.name, p.stock])).toEqual([
      ["Cuaderno", 7],
      ["Lápiz", 0],
    ]);
    expect(b.id).not.toBe(a.id);
  });

  it("está en alerta cuando el stock es menor o igual al mínimo, y no cuando es mayor (D5)", async () => {
    const categoryId = await createCategory();
    const below = await createProduct({ name: "Abajo", categoryId, minStock: 5 });
    const equal = await createProduct({ name: "Igual", categoryId, minStock: 5 });
    const above = await createProduct({ name: "Arriba", categoryId, minStock: 5 });
    await addStock(below.id, 4);
    await addStock(equal.id, 5);
    await addStock(above.id, 6);

    const byName = Object.fromEntries(
      (await agent.get("/api/products")).body.map((p: { name: string; lowStock: boolean }) => [p.name, p.lowStock]),
    );

    expect(byName).toEqual({ Abajo: true, Igual: true, Arriba: false });
  });

  it("con mínimo 0, un producto sin stock está en alerta y con stock no (D5)", async () => {
    const categoryId = await createCategory();
    const empty = await createProduct({ name: "Vacío", categoryId, minStock: 0 });
    const full = await createProduct({ name: "Lleno", categoryId, minStock: 0 });
    await addStock(full.id, 1);

    const byName = Object.fromEntries(
      (await agent.get("/api/products")).body.map((p: { name: string; lowStock: boolean }) => [p.name, p.lowStock]),
    );

    expect(byName).toEqual({ Vacío: true, Lleno: false });
    expect(empty.id).not.toBe(full.id);
  });

  it("lowStock=true lista solo los productos en alerta y lowStock=false, el resto", async () => {
    const categoryId = await createCategory();
    const low = await createProduct({ name: "Poco", categoryId, minStock: 5 });
    const ok = await createProduct({ name: "Mucho", categoryId, minStock: 5 });
    await addStock(low.id, 2);
    await addStock(ok.id, 50);

    const onlyLow = await agent.get("/api/products?lowStock=true");
    const onlyOk = await agent.get("/api/products?lowStock=false");

    expect(onlyLow.body.map((p: { name: string }) => p.name)).toEqual(["Poco"]);
    expect(onlyOk.body.map((p: { name: string }) => p.name)).toEqual(["Mucho"]);
  });

  it("lowStock se combina con los otros filtros", async () => {
    const categoryId = await createCategory();
    const a = await createProduct({ name: "Cuaderno rojo", categoryId, minStock: 5 });
    await createProduct({ name: "Lapicera", categoryId, minStock: 5 });
    await addStock(a.id, 1);

    const response = await agent.get("/api/products?lowStock=true&search=cuad");

    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Cuaderno rojo"]);
  });

  it("rechaza un valor de lowStock inválido", async () => {
    const response = await agent.get("/api/products?lowStock=quizas");

    expect(response.status).toBe(400);
  });
});
