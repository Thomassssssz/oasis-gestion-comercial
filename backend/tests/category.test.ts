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

async function createCategory(name: string) {
  const response = await agent.post("/api/categories").send({ name });
  return response.body as { id: number; name: string };
}

describe("GET /api/categories", () => {
  it("responde una lista vacía si no hay categorías", async () => {
    const response = await agent.get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("lista las categorías ordenadas por nombre", async () => {
    await createCategory("Útiles");
    await createCategory("Librería");
    await createCategory("Papelería");

    const response = await agent.get("/api/categories");

    expect(response.body.map((c: { name: string }) => c.name)).toEqual([
      "Librería",
      "Papelería",
      "Útiles",
    ]);
  });
});

describe("POST /api/categories", () => {
  it("crea una categoría y responde 201", async () => {
    const response = await agent.post("/api/categories").send({ name: "Papelería" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: expect.any(Number), name: "Papelería" });
  });

  it("quita los espacios sobrantes del nombre", async () => {
    const response = await agent.post("/api/categories").send({ name: "  Papelería  " });

    expect(response.body.name).toBe("Papelería");
  });

  it("rechaza un nombre vacío con 400", async () => {
    const response = await agent.post("/api/categories").send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
    expect(response.body.details).toEqual([
      { field: "name", message: "El nombre no puede estar vacío" },
    ]);
  });

  it("rechaza un cuerpo sin nombre con 400", async () => {
    const response = await agent.post("/api/categories").send({});

    expect(response.status).toBe(400);
    expect(response.body.details[0]).toEqual({ field: "name", message: "El nombre es obligatorio" });
  });

  it("rechaza un nombre de más de 100 caracteres con 400", async () => {
    const response = await agent.post("/api/categories").send({ name: "a".repeat(101) });

    expect(response.status).toBe(400);
  });

  it("rechaza un JSON mal formado con 400", async () => {
    const response = await agent
      .post("/api/categories")
      .set("Content-Type", "application/json")
      .send("{ esto no es json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "El cuerpo de la petición no es un JSON válido" });
  });

  it("rechaza un nombre repetido con 409", async () => {
    await createCategory("Papelería");

    const response = await agent.post("/api/categories").send({ name: "Papelería" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Ya existe una categoría con ese nombre" });
  });
});

describe("GET /api/categories/:id", () => {
  it("devuelve la categoría pedida", async () => {
    const { id } = await createCategory("Papelería");

    const response = await agent.get(`/api/categories/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Papelería" });
  });

  it("responde 404 si no existe", async () => {
    const response = await agent.get("/api/categories/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "La categoría no existe" });
  });

  it("responde 400 si el id no es un número válido", async () => {
    const response = await agent.get("/api/categories/abc");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
  });
});

describe("PUT /api/categories/:id", () => {
  it("cambia el nombre de la categoría", async () => {
    const { id } = await createCategory("Papeleria");

    const response = await agent.put(`/api/categories/${id}`).send({ name: "Papelería" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, name: "Papelería" });
  });

  it("responde 404 si la categoría no existe", async () => {
    const response = await agent.put("/api/categories/999").send({ name: "Nueva" });

    expect(response.status).toBe(404);
  });

  it("responde 409 si el nombre ya lo usa otra categoría", async () => {
    await createCategory("Librería");
    const { id } = await createCategory("Papelería");

    const response = await agent.put(`/api/categories/${id}`).send({ name: "Librería" });

    expect(response.status).toBe(409);
  });

  it("responde 400 con un nombre vacío", async () => {
    const { id } = await createCategory("Papelería");

    const response = await agent.put(`/api/categories/${id}`).send({ name: "" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("borra una categoría sin productos y responde 204", async () => {
    const { id } = await createCategory("Papelería");

    const response = await agent.delete(`/api/categories/${id}`);

    expect(response.status).toBe(204);
    expect((await agent.get(`/api/categories/${id}`)).status).toBe(404);
  });

  it("responde 404 si no existe", async () => {
    const response = await agent.delete("/api/categories/999");

    expect(response.status).toBe(404);
  });

  it("responde 409 si la categoría tiene productos y no la borra", async () => {
    const { id } = await createCategory("Papelería");
    await prisma.product.create({ data: { name: "Cuaderno", categoryId: id, salePrice: "10.00" } });

    const response = await agent.delete(`/api/categories/${id}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "No se puede borrar una categoría que tiene productos" });
    expect((await agent.get(`/api/categories/${id}`)).status).toBe(200);
  });
});

describe("sin iniciar sesión", () => {
  it.each([
    ["GET", "/api/categories"],
    ["GET", "/api/categories/1"],
    ["POST", "/api/categories"],
    ["PUT", "/api/categories/1"],
    ["DELETE", "/api/categories/1"],
  ] as const)("%s %s responde 401", async (method, path) => {
    const response = await request(app)[method.toLowerCase() as "get" | "post" | "put" | "delete"](path);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Tenés que iniciar sesión" });
  });
});
