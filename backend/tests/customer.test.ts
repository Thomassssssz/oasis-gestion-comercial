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

const create = (body: object) => agent.post("/api/customers").send(body);
const names = (response: { body: { name: string }[] }) => response.body.map((c) => c.name);

describe("acceso", () => {
  it("sin sesión, todas las rutas de clientes responden 401", async () => {
    expect((await request(app).get("/api/customers")).status).toBe(401);
    expect((await request(app).get("/api/customers/1")).status).toBe(401);
    expect((await request(app).post("/api/customers").send({ name: "Ana" })).status).toBe(401);
    expect((await request(app).put("/api/customers/1").send({})).status).toBe(401);
  });

  it("no existe forma de borrar un cliente: se da de baja", async () => {
    const { body } = await create({ name: "Ana Pérez" });

    expect((await agent.delete(`/api/customers/${body.id}`)).status).toBe(404);
    expect(await prisma.customer.count()).toBe(1);
  });
});

describe("POST /api/customers", () => {
  it("crea un cliente con todos sus datos y responde 201", async () => {
    const response = await create({
      name: "Ana Pérez",
      phone: "+54 370 4-123456",
      dni: "30.123.456",
      address: "España 123, Formosa",
      notes: "Paga los viernes",
      creditAuthorized: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      name: "Ana Pérez",
      phone: "+54 370 4-123456",
      dni: "30123456",
      address: "España 123, Formosa",
      notes: "Paga los viernes",
      creditAuthorized: true,
      active: true,
    });
  });

  it("solo el nombre es obligatorio: por defecto no tiene crédito autorizado y los demás datos quedan vacíos", async () => {
    const response = await create({ name: "Juan" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Juan",
      phone: null,
      dni: null,
      address: null,
      notes: null,
      creditAuthorized: false,
      active: true,
    });
  });

  it("recorta los espacios y trata los textos vacíos como sin dato", async () => {
    const response = await create({ name: "  Ana  ", phone: "   ", dni: "", address: "  ", notes: "  Nota  " });

    expect(response.body).toMatchObject({ name: "Ana", phone: null, dni: null, address: null, notes: "Nota" });
  });

  it.each([
    ["con puntos", "30.123.456", "30123456"],
    ["con espacios", "30 123 456", "30123456"],
    ["de 7 dígitos", "9123456", "9123456"],
  ])("guarda el DNI %s solo con dígitos", async (_name, input, saved) => {
    const response = await create({ name: "Ana", dni: input });

    expect(response.body.dni).toBe(saved);
  });

  it.each([
    ["con letras", "3012345A"],
    ["de 6 dígitos", "123456"],
    ["de 9 dígitos", "123456789"],
    ["con guiones", "30-123-456"],
    ["que no es texto", 30123456],
  ])("rechaza un DNI %s", async (_name, dni) => {
    const response = await create({ name: "Ana", dni });

    expect(response.status).toBe(400);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("no permite dos clientes con el mismo DNI (409), aunque se escriba distinto", async () => {
    await create({ name: "Ana", dni: "30123456" });

    const response = await create({ name: "Otra Ana", dni: "30.123.456" });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Ya existe un cliente con ese DNI");
    expect(await prisma.customer.count()).toBe(1);
  });

  it("permite homónimos (mismo nombre) y varios clientes sin DNI", async () => {
    expect((await create({ name: "Ana Pérez" })).status).toBe(201);
    expect((await create({ name: "Ana Pérez" })).status).toBe(201);
    expect((await create({ name: "Ana Pérez", dni: "30123456" })).status).toBe(201);
    expect(await prisma.customer.count()).toBe(3);
  });

  it.each(["+54 370 4123456", "(0370) 4123456", "4123456", "370-4123456"])("acepta el teléfono %s", async (phone) => {
    expect((await create({ name: "Ana", phone })).status).toBe(201);
  });

  it.each([
    ["con letras", "tel 4123456"],
    ["demasiado corto", "123"],
    ["demasiado largo", "1".repeat(31)],
    ["que no es texto", 4123456],
  ])("rechaza un teléfono %s", async (_name, phone) => {
    expect((await create({ name: "Ana", phone })).status).toBe(400);
  });

  it.each([
    ["sin nombre", {}],
    ["nombre vacío", { name: "   " }],
    ["nombre que no es texto", { name: 5 }],
    ["nombre demasiado largo", { name: "x".repeat(151) }],
    ["dirección demasiado larga", { name: "Ana", address: "x".repeat(201) }],
    ["observaciones demasiado largas", { name: "Ana", notes: "x".repeat(501) }],
    ["crédito que no es verdadero o falso", { name: "Ana", creditAuthorized: "si" }],
  ])("responde 400 con %s", async (_name, body) => {
    const response = await create(body);

    expect(response.status).toBe(400);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("ignora campos que no corresponden, como active, al crear (siempre nace activo)", async () => {
    const response = await create({ name: "Ana", active: false });

    expect(response.body.active).toBe(true);
  });
});

describe("datos del remito: localidad, condición frente al IVA y CUIT (D23)", () => {
  it("se guardan al crear y salen en la respuesta", async () => {
    const response = await create({ name: "Ana", locality: "  Formosa ", taxCondition: "MONOTAX", cuit: "20-12345678-9" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ locality: "Formosa", taxCondition: "MONOTAX", cuit: "20123456789" });
  });

  it("son opcionales: sin datos quedan vacíos, y los textos vacíos cuentan como sin dato", async () => {
    expect((await create({ name: "Juan" })).body).toMatchObject({ locality: null, taxCondition: null, cuit: null });
    expect((await create({ name: "Juan", locality: "  ", taxCondition: null, cuit: "" })).body).toMatchObject({ locality: null, taxCondition: null, cuit: null });
  });

  it.each(["CONSUMER", "EXEMPT", "REGISTERED", "MONOTAX"])("acepta la condición %s", async (taxCondition) => {
    expect((await create({ name: "Ana", taxCondition })).body.taxCondition).toBe(taxCondition);
  });

  it.each([
    ["condición inventada", { taxCondition: "OTRA" }],
    ["CUIT de 10 dígitos", { cuit: "2012345678" }],
    ["CUIT con letras", { cuit: "20-1234567A-9" }],
    ["CUIT que no es texto", { cuit: 20123456789 }],
    ["localidad demasiado larga", { locality: "x".repeat(101) }],
  ])("rechaza %s", async (_name, extra) => {
    const response = await create({ name: "Ana", ...extra });

    expect(response.status).toBe(400);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("al editar se reemplazan junto con el resto de los datos (lo que no se envía queda vacío)", async () => {
    const { body } = await create({ name: "Ana", locality: "Formosa", taxCondition: "EXEMPT", cuit: "20123456789" });
    const base = { name: "Ana", creditAuthorized: false, active: true };

    const changed = await agent.put(`/api/customers/${body.id}`).send({ ...base, locality: "Clorinda", taxCondition: "REGISTERED", cuit: "30-71234567-8" });
    expect(changed.body).toMatchObject({ locality: "Clorinda", taxCondition: "REGISTERED", cuit: "30712345678" });

    const cleared = await agent.put(`/api/customers/${body.id}`).send(base);
    expect(cleared.body).toMatchObject({ locality: null, taxCondition: null, cuit: null });
  });
});

describe("GET /api/customers", () => {
  beforeEach(async () => {
    await prisma.customer.createMany({
      data: [
        { name: "Zulema Gómez", dni: "20111222", phone: "370 4111111", creditAuthorized: true },
        { name: "Ana Pérez", dni: "30123456", phone: "370 4222222" },
        { name: "Beto Díaz", phone: "11 5555-1234", creditAuthorized: true, active: false },
      ],
    });
  });

  it("lista todos ordenados por nombre", async () => {
    const response = await agent.get("/api/customers");

    expect(response.status).toBe(200);
    expect(names(response)).toEqual(["Ana Pérez", "Beto Díaz", "Zulema Gómez"]);
  });

  it("busca por parte del nombre sin distinguir mayúsculas", async () => {
    expect(names(await agent.get("/api/customers?search=PÉR"))).toEqual(["Ana Pérez"]);
  });

  it("busca por parte del DNI y por parte del teléfono", async () => {
    expect(names(await agent.get("/api/customers?search=2011"))).toEqual(["Zulema Gómez"]);
    expect(names(await agent.get("/api/customers?search=4222"))).toEqual(["Ana Pérez"]);
    expect(names(await agent.get("/api/customers?search=5555"))).toEqual(["Beto Díaz"]);
  });

  it("filtra por activos y dados de baja", async () => {
    expect(names(await agent.get("/api/customers?active=true"))).toEqual(["Ana Pérez", "Zulema Gómez"]);
    expect(names(await agent.get("/api/customers?active=false"))).toEqual(["Beto Díaz"]);
  });

  it("filtra por crédito autorizado y no autorizado", async () => {
    expect(names(await agent.get("/api/customers?creditAuthorized=true"))).toEqual(["Beto Díaz", "Zulema Gómez"]);
    expect(names(await agent.get("/api/customers?creditAuthorized=false"))).toEqual(["Ana Pérez"]);
  });

  it("combina los filtros", async () => {
    const response = await agent.get("/api/customers?active=true&creditAuthorized=true&search=zul");

    expect(names(response)).toEqual(["Zulema Gómez"]);
  });

  it("rechaza filtros inválidos", async () => {
    expect((await agent.get("/api/customers?active=quizas")).status).toBe(400);
    expect((await agent.get("/api/customers?creditAuthorized=2")).status).toBe(400);
  });

  it("sin resultados devuelve una lista vacía", async () => {
    const response = await agent.get("/api/customers?search=nadie");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /api/customers/:id", () => {
  it("devuelve el cliente pedido", async () => {
    const { body } = await create({ name: "Ana Pérez", dni: "30123456" });

    const response = await agent.get(`/api/customers/${body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: body.id, name: "Ana Pérez", dni: "30123456" });
  });

  it("responde 404 si no existe y 400 si el id no es válido", async () => {
    expect((await agent.get("/api/customers/999")).status).toBe(404);
    expect((await agent.get("/api/customers/abc")).status).toBe(400);
  });
});

describe("PUT /api/customers/:id", () => {
  const full = (extra: object = {}) => ({ name: "Ana Pérez", creditAuthorized: false, active: true, ...extra });

  it("cambia los datos del cliente", async () => {
    const { body } = await create({ name: "Ana", dni: "30123456" });

    const response = await agent
      .put(`/api/customers/${body.id}`)
      .send(full({ name: "Ana María Pérez", phone: "370 4123456", dni: "30123456", creditAuthorized: true }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: body.id,
      name: "Ana María Pérez",
      phone: "370 4123456",
      dni: "30123456",
      creditAuthorized: true,
    });
  });

  it("reemplaza todos los datos: lo que no se envía queda vacío", async () => {
    const { body } = await create({ name: "Ana", phone: "370 4123456", address: "España 123", notes: "Nota" });

    const response = await agent.put(`/api/customers/${body.id}`).send(full());

    expect(response.body).toMatchObject({ phone: null, dni: null, address: null, notes: null });
  });

  it("da de baja y reactiva un cliente sin borrarlo", async () => {
    const { body } = await create({ name: "Ana" });

    const off = await agent.put(`/api/customers/${body.id}`).send(full({ active: false }));
    expect(off.body.active).toBe(false);
    expect(await prisma.customer.count()).toBe(1);

    const on = await agent.put(`/api/customers/${body.id}`).send(full({ active: true }));
    expect(on.body.active).toBe(true);
  });

  it("autoriza y quita el crédito", async () => {
    const { body } = await create({ name: "Ana" });

    expect((await agent.put(`/api/customers/${body.id}`).send(full({ creditAuthorized: true }))).body.creditAuthorized).toBe(true);
    expect((await agent.put(`/api/customers/${body.id}`).send(full({ creditAuthorized: false }))).body.creditAuthorized).toBe(false);
  });

  it("deja guardar el DNI propio sin chocar consigo mismo, pero no el de otro cliente (409)", async () => {
    const ana = await create({ name: "Ana", dni: "30123456" });
    await create({ name: "Beto", dni: "20111222" });

    const own = await agent.put(`/api/customers/${ana.body.id}`).send(full({ dni: "30123456" }));
    const other = await agent.put(`/api/customers/${ana.body.id}`).send(full({ dni: "20111222" }));

    expect(own.status).toBe(200);
    expect(other.status).toBe(409);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: ana.body.id } })).dni).toBe("30123456");
  });

  it("responde 404 si el cliente no existe", async () => {
    expect((await agent.put("/api/customers/999").send(full())).status).toBe(404);
  });

  it("responde 400 si falta indicar si está activo, si el id no es válido o si el nombre está vacío", async () => {
    const { body } = await create({ name: "Ana" });

    expect((await agent.put(`/api/customers/${body.id}`).send({ name: "Ana" })).status).toBe(400);
    expect((await agent.put("/api/customers/abc").send(full())).status).toBe(400);
    expect((await agent.put(`/api/customers/${body.id}`).send(full({ name: " " }))).status).toBe(400);
  });
});
