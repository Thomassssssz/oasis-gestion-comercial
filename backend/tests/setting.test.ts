import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent } from "./helpers/users.js";

const prisma = createTestPrisma();
const app = createApp({ prisma });

let agent: Awaited<ReturnType<typeof loginAgent>>;

beforeEach(async () => {
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
});
afterAll(() => prisma.$disconnect());

describe("acceso", () => {
  it("sin sesión, consultar y cambiar los parámetros responde 401", async () => {
    expect((await request(app).get("/api/settings")).status).toBe(401);
    expect((await request(app).put("/api/settings").send({ lateFeePercent: 7 })).status).toBe(401);
  });

  it("no se pueden crear ni borrar parámetros", async () => {
    expect((await agent.post("/api/settings").send({ lateFeePercent: 7 })).status).toBe(404);
    expect((await agent.delete("/api/settings")).status).toBe(404);
  });
});

describe("GET /api/settings", () => {
  it("por defecto el recargo por mora es 5% por mes (CLAUDE.md) y nadie lo cambió todavía", async () => {
    const response = await agent.get("/api/settings");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lateFeePercent: "5.00", updatedBy: null });
  });

  it("pedirlo varias veces no crea más de una fila", async () => {
    await agent.get("/api/settings");
    await agent.get("/api/settings");

    expect(await prisma.setting.count()).toBe(1);
  });
});

describe("PUT /api/settings", () => {
  it("cambia el recargo y lo devuelve como texto con 2 decimales", async () => {
    const response = await agent.put("/api/settings").send({ lateFeePercent: "7.5" });

    expect(response.status).toBe(200);
    expect(response.body.lateFeePercent).toBe("7.50");
    expect((await agent.get("/api/settings")).body.lateFeePercent).toBe("7.50");
  });

  it.each([
    ["número", 12.25, "12.25"],
    ["texto", "3", "3.00"],
    ["cero (sin recargo)", 0, "0.00"],
    ["cien", "100", "100.00"],
    ["con espacios", " 8 ", "8.00"],
  ])("acepta un porcentaje %s", async (_name, value, saved) => {
    const response = await agent.put("/api/settings").send({ lateFeePercent: value });

    expect(response.status).toBe(200);
    expect(response.body.lateFeePercent).toBe(saved);
  });

  it.each([
    ["mayor que 100", "100.01"],
    ["negativo", "-1"],
    ["con letras", "cinco"],
    ["con 3 decimales", "5.123"],
    ["vacío", ""],
    ["con coma", "5,5"],
    ["que no es texto ni número", true],
    ["nulo", null],
  ])("rechaza un porcentaje %s y deja el valor anterior", async (_name, value) => {
    await agent.put("/api/settings").send({ lateFeePercent: "6" });

    const response = await agent.put("/api/settings").send({ lateFeePercent: value });

    expect(response.status).toBe(400);
    expect((await agent.get("/api/settings")).body.lateFeePercent).toBe("6.00");
  });

  it("rechaza un cuerpo sin el porcentaje", async () => {
    expect((await agent.put("/api/settings").send({})).status).toBe(400);
  });

  it("guarda quién lo cambió según la sesión, no según lo que mande el cliente", async () => {
    const other = await prisma.user.create({ data: { username: "otro", fullName: "Otro Usuario", passwordHash: "x" } });

    const response = await agent.put("/api/settings").send({ lateFeePercent: 9, updatedById: other.id, updatedBy: { id: other.id } });

    expect(response.body.updatedBy).toEqual({ id: expect.any(Number), fullName: "Ana Propietaria" });
    expect(response.body.updatedBy.id).not.toBe(other.id);
  });

  it("si lo cambia otra persona, queda registrada la última", async () => {
    await agent.put("/api/settings").send({ lateFeePercent: 9 });
    const second = await loginAgent(app, prisma, { username: "beto", fullName: "Beto Propietario" });

    const response = await second.put("/api/settings").send({ lateFeePercent: 10 });

    expect(response.body.updatedBy.fullName).toBe("Beto Propietario");
    expect(await prisma.setting.count()).toBe(1);
  });

  it("cambiarlo muchas veces sigue dejando una sola fila", async () => {
    await agent.put("/api/settings").send({ lateFeePercent: 1 });
    await agent.put("/api/settings").send({ lateFeePercent: 2 });
    await agent.put("/api/settings").send({ lateFeePercent: 3 });

    expect(await prisma.setting.count()).toBe(1);
  });
});
