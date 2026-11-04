import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createTestPrisma, resetDatabase } from "../../../tests/helpers/db.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

async function createCategory(name: string) {
  const response = await request(app).post("/api/categories").send({ name });
  return response.body as { id: number; name: string };
}

describe("GET /api/categories", () => {
  it("responde una lista vacía si no hay categorías", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("lista las categorías ordenadas por nombre", async () => {
    await createCategory("Útiles");
    await createCategory("Librería");
    await createCategory("Papelería");

    const response = await request(app).get("/api/categories");

    expect(response.body.map((c: { name: string }) => c.name)).toEqual([
      "Librería",
      "Papelería",
      "Útiles",
    ]);
  });
});

describe("POST /api/categories", () => {
  it("crea una categoría y responde 201", async () => {
    const response = await request(app).post("/api/categories").send({ name: "Papelería" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: expect.any(Number), name: "Papelería" });
  });

  it("quita los espacios sobrantes del nombre", async () => {
    const response = await request(app).post("/api/categories").send({ name: "  Papelería  " });

    expect(response.body.name).toBe("Papelería");
  });

  it("rechaza un nombre vacío con 400", async () => {
    const response = await request(app).post("/api/categories").send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
    expect(response.body.details).toEqual([
      { field: "name", message: "El nombre no puede estar vacío" },
    ]);
  });

  it("rechaza un cuerpo sin nombre con 400", async () => {
    const response = await request(app).post("/api/categories").send({});

    expect(response.status).toBe(400);
    expect(response.body.details[0]).toEqual({ field: "name", message: "El nombre es obligatorio" });
  });

  it("rechaza un nombre de más de 100 caracteres con 400", async () => {
    const response = await request(app).post("/api/categories").send({ name: "a".repeat(101) });

    expect(response.status).toBe(400);
  });

  it("rechaza un JSON mal formado con 400", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Content-Type", "application/json")
      .send("{ esto no es json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "El cuerpo de la petición no es un JSON válido" });
  });

  it("rechaza un nombre repetido con 409", async () => {
    await createCategory("Papelería");

    const response = await request(app).post("/api/categories").send({ name: "Papelería" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Ya existe una categoría con ese nombre" });
  });
});

describe("GET /api/categories/:id", () => {
  it("devuelve la categoría pedida", async () => {
    const { id } = await createCategory("Papelería");

    const response = await request(app).get(`/api/categories/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Papelería" });
  });

  it("responde 404 si no existe", async () => {
    const response = await request(app).get("/api/categories/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "La categoría no existe" });
  });

  it("responde 400 si el id no es un número válido", async () => {
    const response = await request(app).get("/api/categories/abc");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
  });
});

describe("PUT /api/categories/:id", () => {
  it("cambia el nombre de la categoría", async () => {
    const { id } = await createCategory("Papeleria");

    const response = await request(app).put(`/api/categories/${id}`).send({ name: "Papelería" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Papelería" });
  });

  it("responde 404 si la categoría no existe", async () => {
    const response = await request(app).put("/api/categories/999").send({ name: "Nueva" });

    expect(response.status).toBe(404);
  });

  it("responde 409 si el nombre ya lo usa otra categoría", async () => {
    await createCategory("Librería");
    const { id } = await createCategory("Papelería");

    const response = await request(app).put(`/api/categories/${id}`).send({ name: "Librería" });

    expect(response.status).toBe(409);
  });

  it("responde 400 con un nombre vacío", async () => {
    const { id } = await createCategory("Papelería");

    const response = await request(app).put(`/api/categories/${id}`).send({ name: "" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("borra una categoría sin productos y responde 204", async () => {
    const { id } = await createCategory("Papelería");

    const response = await request(app).delete(`/api/categories/${id}`);

    expect(response.status).toBe(204);
    expect((await request(app).get(`/api/categories/${id}`)).status).toBe(404);
  });

  it("responde 404 si no existe", async () => {
    const response = await request(app).delete("/api/categories/999");

    expect(response.status).toBe(404);
  });

  it("responde 409 si la categoría tiene productos y no la borra", async () => {
    const { id } = await createCategory("Papelería");
    await prisma.product.create({ data: { name: "Cuaderno", categoryId: id, salePrice: "10.00" } });

    const response = await request(app).delete(`/api/categories/${id}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "No se puede borrar una categoría que tiene productos" });
    expect((await request(app).get(`/api/categories/${id}`)).status).toBe(200);
  });
});
