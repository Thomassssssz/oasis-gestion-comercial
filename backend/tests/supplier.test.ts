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

const create = (body: object) => agent.post("/api/suppliers").send(body);
const names = (response: { body: { name: string }[] }) => response.body.map((s) => s.name);

describe("acceso", () => {
  it("sin sesión, todas las rutas de proveedores responden 401", async () => {
    expect((await request(app).get("/api/suppliers")).status).toBe(401);
    expect((await request(app).get("/api/suppliers/1")).status).toBe(401);
    expect((await request(app).post("/api/suppliers").send({ name: "Papelera Sur" })).status).toBe(401);
    expect((await request(app).put("/api/suppliers/1").send({})).status).toBe(401);
  });

  it("no existe forma de borrar un proveedor: se da de baja", async () => {
    const { body } = await create({ name: "Papelera Sur" });

    expect((await agent.delete(`/api/suppliers/${body.id}`)).status).toBe(404);
    expect(await prisma.supplier.count()).toBe(1);
  });
});

describe("POST /api/suppliers", () => {
  it("crea un proveedor con todos sus datos y responde 201", async () => {
    const response = await create({
      name: "Papelera Sur",
      phone: "+54 370 4-123456",
      email: "ventas@papelerasur.com",
      address: "Av. 25 de Mayo 456, Formosa",
      notes: "Entrega los martes",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      name: "Papelera Sur",
      phone: "+54 370 4-123456",
      email: "ventas@papelerasur.com",
      address: "Av. 25 de Mayo 456, Formosa",
      notes: "Entrega los martes",
      active: true,
    });
  });

  it("solo el nombre es obligatorio: los demás datos quedan vacíos", async () => {
    const response = await create({ name: "Distribuidora Norte" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ phone: null, email: null, address: null, notes: null, active: true });
  });

  it("recorta los espacios y trata los textos vacíos como sin dato", async () => {
    const response = await create({ name: "  Papelera  ", phone: "   ", email: "", address: "  ", notes: "  Nota  " });

    expect(response.body).toMatchObject({ name: "Papelera", phone: null, email: null, address: null, notes: "Nota" });
  });

  it("no permite dos proveedores con el mismo nombre (409), aunque tenga espacios de más", async () => {
    await create({ name: "Papelera Sur" });

    const response = await create({ name: "  Papelera Sur " });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Ya existe un proveedor con ese nombre");
    expect(await prisma.supplier.count()).toBe(1);
  });

  it.each(["ventas@papelerasur.com", "a.b+c@dominio.com.ar"])("acepta el email %s", async (email) => {
    expect((await create({ name: "Proveedor", email })).status).toBe(201);
  });

  it.each([
    ["sin arroba", "ventas.papelerasur.com"],
    ["sin dominio", "ventas@"],
    ["con espacios", "ventas @sur.com"],
    ["demasiado largo", `${"a".repeat(250)}@x.com`],
    ["que no es texto", 123],
  ])("rechaza un email %s", async (_name, email) => {
    const response = await create({ name: "Proveedor", email });

    expect(response.status).toBe(400);
    expect(await prisma.supplier.count()).toBe(0);
  });

  it.each(["+54 370 4123456", "(0370) 4123456", "4123456"])("acepta el teléfono %s", async (phone) => {
    expect((await create({ name: "Proveedor", phone })).status).toBe(201);
  });

  it.each([
    ["con letras", "tel 4123456"],
    ["demasiado corto", "123"],
    ["demasiado largo", "1".repeat(31)],
    ["que no es texto", 4123456],
  ])("rechaza un teléfono %s", async (_name, phone) => {
    expect((await create({ name: "Proveedor", phone })).status).toBe(400);
  });

  it.each([
    ["sin nombre", {}],
    ["nombre vacío", { name: "   " }],
    ["nombre que no es texto", { name: 5 }],
    ["nombre demasiado largo", { name: "x".repeat(151) }],
    ["dirección demasiado larga", { name: "P", address: "x".repeat(201) }],
    ["observaciones demasiado largas", { name: "P", notes: "x".repeat(501) }],
  ])("responde 400 con %s", async (_name, body) => {
    const response = await create(body);

    expect(response.status).toBe(400);
    expect(await prisma.supplier.count()).toBe(0);
  });

  it("ignora campos que no corresponden, como active, al crear (siempre nace activo)", async () => {
    expect((await create({ name: "Papelera", active: false })).body.active).toBe(true);
  });
});

describe("GET /api/suppliers", () => {
  beforeEach(async () => {
    await prisma.supplier.createMany({
      data: [
        // Se cargan en un orden que no es alfabético ni su inverso, para comprobar que el listado ordena por nombre.
        { name: "Papelera Sur", email: "ventas@sur.com", phone: "370 4222222" },
        { name: "Zeta Mayorista", email: "info@zeta.com", phone: "370 4111111" },
        { name: "Librería Norte", phone: "11 5555-1234", active: false },
      ],
    });
  });

  it("lista todos ordenados por nombre", async () => {
    const response = await agent.get("/api/suppliers");

    expect(response.status).toBe(200);
    expect(names(response)).toEqual(["Librería Norte", "Papelera Sur", "Zeta Mayorista"]);
  });

  it("busca por parte del nombre sin distinguir mayúsculas", async () => {
    expect(names(await agent.get("/api/suppliers?search=PAPEL"))).toEqual(["Papelera Sur"]);
  });

  it("busca por parte del email (sin distinguir mayúsculas) y del teléfono", async () => {
    expect(names(await agent.get("/api/suppliers?search=INFO@"))).toEqual(["Zeta Mayorista"]);
    expect(names(await agent.get("/api/suppliers?search=4222"))).toEqual(["Papelera Sur"]);
    expect(names(await agent.get("/api/suppliers?search=5555"))).toEqual(["Librería Norte"]);
  });

  it("filtra por activos y dados de baja", async () => {
    expect(names(await agent.get("/api/suppliers?active=true"))).toEqual(["Papelera Sur", "Zeta Mayorista"]);
    expect(names(await agent.get("/api/suppliers?active=false"))).toEqual(["Librería Norte"]);
  });

  it("combina búsqueda y estado", async () => {
    expect(names(await agent.get("/api/suppliers?active=true&search=zeta"))).toEqual(["Zeta Mayorista"]);
    expect(names(await agent.get("/api/suppliers?active=true&search=norte"))).toEqual([]);
  });

  it("rechaza un filtro de estado inválido", async () => {
    expect((await agent.get("/api/suppliers?active=quizas")).status).toBe(400);
  });

  it("sin resultados devuelve una lista vacía", async () => {
    const response = await agent.get("/api/suppliers?search=nadie");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /api/suppliers/:id", () => {
  it("devuelve el proveedor pedido", async () => {
    const { body } = await create({ name: "Papelera Sur", email: "ventas@sur.com" });

    const response = await agent.get(`/api/suppliers/${body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: body.id, name: "Papelera Sur", email: "ventas@sur.com" });
  });

  it("responde 404 si no existe y 400 si el id no es válido", async () => {
    expect((await agent.get("/api/suppliers/999")).status).toBe(404);
    expect((await agent.get("/api/suppliers/abc")).status).toBe(400);
  });
});

describe("PUT /api/suppliers/:id", () => {
  const full = (extra: object = {}) => ({ name: "Papelera Sur", active: true, ...extra });

  it("cambia los datos del proveedor", async () => {
    const { body } = await create({ name: "Papelera" });

    const response = await agent
      .put(`/api/suppliers/${body.id}`)
      .send(full({ name: "Papelera Sur SRL", phone: "370 4123456", email: "ventas@sur.com" }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: body.id, name: "Papelera Sur SRL", phone: "370 4123456", email: "ventas@sur.com" });
  });

  it("reemplaza todos los datos: lo que no se envía queda vacío", async () => {
    const { body } = await create({ name: "Papelera", phone: "370 4123456", email: "a@b.com", address: "Calle 1", notes: "Nota" });

    const response = await agent.put(`/api/suppliers/${body.id}`).send(full());

    expect(response.body).toMatchObject({ phone: null, email: null, address: null, notes: null });
  });

  it("da de baja y reactiva un proveedor sin borrarlo", async () => {
    const { body } = await create({ name: "Papelera" });

    const off = await agent.put(`/api/suppliers/${body.id}`).send(full({ active: false }));
    expect(off.body.active).toBe(false);
    expect(await prisma.supplier.count()).toBe(1);

    const on = await agent.put(`/api/suppliers/${body.id}`).send(full({ active: true }));
    expect(on.body.active).toBe(true);
  });

  it("deja guardar el nombre propio sin chocar consigo mismo, pero no el de otro proveedor (409)", async () => {
    const sur = await create({ name: "Papelera Sur" });
    await create({ name: "Zeta Mayorista" });

    const own = await agent.put(`/api/suppliers/${sur.body.id}`).send(full({ name: "Papelera Sur" }));
    const other = await agent.put(`/api/suppliers/${sur.body.id}`).send(full({ name: "Zeta Mayorista" }));

    expect(own.status).toBe(200);
    expect(other.status).toBe(409);
    expect((await prisma.supplier.findUniqueOrThrow({ where: { id: sur.body.id } })).name).toBe("Papelera Sur");
  });

  it("responde 404 si el proveedor no existe", async () => {
    expect((await agent.put("/api/suppliers/999").send(full())).status).toBe(404);
  });

  it("responde 400 si falta indicar si está activo, si el id no es válido o si el nombre está vacío", async () => {
    const { body } = await create({ name: "Papelera" });

    expect((await agent.put(`/api/suppliers/${body.id}`).send({ name: "Papelera" })).status).toBe(400);
    expect((await agent.put("/api/suppliers/abc").send(full())).status).toBe(400);
    expect((await agent.put(`/api/suppliers/${body.id}`).send(full({ name: " " }))).status).toBe(400);
  });
});
