import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createTestPrisma, resetDatabase } from "../../../tests/helpers/db.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

async function createCategory(name = "Papelería") {
  return (await prisma.category.create({ data: { name } })).id;
}

type NewProduct = { name?: string; categoryId: number; salePrice?: string | number; minStock?: number };

async function createProduct({ name = "Cuaderno", salePrice = "1500.50", ...rest }: NewProduct) {
  const response = await request(app).post("/api/products").send({ name, salePrice, ...rest });
  return response.body as { id: number; name: string };
}

describe("POST /api/products", () => {
  it("crea un producto activo con el precio exacto y responde 201", async () => {
    const categoryId = await createCategory();

    const response = await request(app)
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

    const response = await request(app).post("/api/products").send({ name: "Lapicera", categoryId, salePrice: 300 });

    expect(response.body.minStock).toBe(0);
    expect(response.body.salePrice).toBe("300.00");
  });

  it("quita los espacios sobrantes del nombre", async () => {
    const categoryId = await createCategory();

    const response = await request(app).post("/api/products").send({ name: "  Goma  ", categoryId, salePrice: "50" });

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

    const response = await request(app).post("/api/products").send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
  });

  it("rechaza con 400 una categoría que no existe", async () => {
    const response = await request(app).post("/api/products").send({ name: "Cuaderno", categoryId: 999, salePrice: "100" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "La categoría indicada no existe" });
  });

  it("rechaza con 400 si falta la categoría", async () => {
    const response = await request(app).post("/api/products").send({ name: "Cuaderno", salePrice: "100" });

    expect(response.status).toBe(400);
  });
});

describe("GET /api/products", () => {
  it("lista los productos ordenados por nombre, con su categoría", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Regla", categoryId });
    await createProduct({ name: "Cuaderno", categoryId });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Cuaderno", "Regla"]);
    expect(response.body[0].category).toEqual({ id: categoryId, name: "Papelería" });
  });

  it("filtra por categoría", async () => {
    const papeleria = await createCategory("Papelería");
    const libreria = await createCategory("Librería");
    await createProduct({ name: "Cuaderno", categoryId: papeleria });
    await createProduct({ name: "Novela", categoryId: libreria });

    const response = await request(app).get(`/api/products?categoryId=${libreria}`);

    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Novela"]);
  });

  it("busca por parte del nombre sin distinguir mayúsculas", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Lapicera azul", categoryId });
    await createProduct({ name: "Cuaderno", categoryId });

    const response = await request(app).get("/api/products?search=LAPI");

    expect(response.body.map((p: { name: string }) => p.name)).toEqual(["Lapicera azul"]);
  });

  it("filtra por activos y dados de baja", async () => {
    const categoryId = await createCategory();
    await createProduct({ name: "Activo", categoryId });
    const baja = await createProduct({ name: "De baja", categoryId });
    await request(app)
      .put(`/api/products/${baja.id}`)
      .send({ name: "De baja", categoryId, salePrice: "10", minStock: 0, active: false });

    const activos = await request(app).get("/api/products?active=true");
    const bajas = await request(app).get("/api/products?active=false");

    expect(activos.body.map((p: { name: string }) => p.name)).toEqual(["Activo"]);
    expect(bajas.body.map((p: { name: string }) => p.name)).toEqual(["De baja"]);
  });

  it("rechaza con 400 un filtro inválido", async () => {
    const response = await request(app).get("/api/products?active=quizas");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/products/:id", () => {
  it("devuelve el producto pedido", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await request(app).get(`/api/products/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Cuaderno", salePrice: "1500.50" });
  });

  it("responde 404 si no existe", async () => {
    const response = await request(app).get("/api/products/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "El producto no existe" });
  });

  it("responde 400 si el id no es válido", async () => {
    expect((await request(app).get("/api/products/abc")).status).toBe(400);
  });
});

describe("PUT /api/products/:id", () => {
  it("cambia los datos del producto", async () => {
    const categoryId = await createCategory();
    const otra = await createCategory("Librería");
    const { id } = await createProduct({ categoryId });

    const response = await request(app)
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

    const response = await request(app)
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId, salePrice: "1500.50", minStock: 0, active: false });

    expect(response.body.active).toBe(false);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(200);
  });

  it("responde 404 si el producto no existe", async () => {
    const categoryId = await createCategory();

    const response = await request(app)
      .put("/api/products/999")
      .send({ name: "X", categoryId, salePrice: "10", minStock: 0, active: true });

    expect(response.status).toBe(404);
  });

  it("responde 400 si la categoría nueva no existe", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await request(app)
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId: 999, salePrice: "10", minStock: 0, active: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "La categoría indicada no existe" });
  });

  it("responde 400 si falta indicar si está activo", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await request(app)
      .put(`/api/products/${id}`)
      .send({ name: "Cuaderno", categoryId, salePrice: "10", minStock: 0 });

    expect(response.status).toBe(400);
  });
});

describe("borrado de productos", () => {
  it("no existe: los productos se dan de baja, no se borran", async () => {
    const categoryId = await createCategory();
    const { id } = await createProduct({ categoryId });

    const response = await request(app).delete(`/api/products/${id}`);

    expect(response.status).toBe(404);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(200);
  });
});
