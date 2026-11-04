import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createPrismaClient } from "../../config/prisma.js";

// /api/health no consulta la base, así que este cliente nunca llega a conectarse.
const app = createApp({ prisma: createPrismaClient("postgresql://nadie@localhost:1/ninguna") });

describe("GET /api/health", () => {
  it("responde 200 con status ok", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("no revela la tecnología del servidor en las cabeceras", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("rutas inexistentes", () => {
  it("responden 404 en formato JSON", async () => {
    const response = await request(app).get("/api/no-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Ruta no encontrada" });
  });
});
