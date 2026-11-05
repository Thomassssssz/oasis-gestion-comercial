import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { createUser, loginAgent, TEST_PASSWORD } from "./helpers/users.js";
import { hashToken } from "../src/services/auth.service.js";
import { createLoginLimiter } from "../src/helpers/login-limiter.js";

const prisma = createTestPrisma();

// Reloj controlado a mano para probar vencimientos sin esperar.
let currentTime = new Date("2026-11-04T12:00:00Z");
const advanceHours = (hours: number) => (currentTime = new Date(currentTime.getTime() + hours * 3_600_000));
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  currentTime = new Date("2026-11-04T12:00:00Z");
  // La app se crea de nuevo en cada prueba para que el contador de intentos empiece en cero.
  app = createApp({
    prisma,
    now: () => currentTime,
    loginLimiter: createLoginLimiter({ now: () => currentTime.getTime() }),
  });
});
afterAll(() => prisma.$disconnect());

const login = (username: string, password: string) => request(app).post("/api/auth/login").send({ username, password });

describe("POST /api/auth/login", () => {
  it("con datos correctos responde 200 con el usuario, sin el hash, y abre una sesión", async () => {
    await createUser(prisma);

    const response = await login("ana", TEST_PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(Number), username: "ana", fullName: "Ana Propietaria" });
    expect(await prisma.session.count()).toBe(1);
  });

  it("entrega la cookie de sesión como HttpOnly y SameSite=Lax", async () => {
    await createUser(prisma);

    const response = await login("ana", TEST_PASSWORD);
    const cookie = String(response.headers["set-cookie"]);

    expect(cookie).toContain("oasis_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("guarda en la base el hash del código de la cookie, no el código", async () => {
    await createUser(prisma);

    const response = await login("ana", TEST_PASSWORD);
    const token = /oasis_session=([^;]+)/.exec(String(response.headers["set-cookie"]))![1];
    const session = await prisma.session.findFirstOrThrow();

    expect(session.tokenHash).toBe(hashToken(token));
    expect(session.tokenHash).not.toBe(token);
  });

  it("la contraseña se guarda solo como hash en la base", async () => {
    const user = await createUser(prisma);

    expect(user.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(user.passwordHash).not.toContain(TEST_PASSWORD);
  });

  it("no distingue mayúsculas en el nombre de usuario", async () => {
    await createUser(prisma);

    expect((await login("  ANA ", TEST_PASSWORD)).status).toBe(200);
  });

  it("rechaza una contraseña incorrecta con 401 y sin abrir sesión", async () => {
    await createUser(prisma);

    const response = await login("ana", "otra-contraseña");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Usuario o contraseña incorrectos" });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it("da el mismo mensaje si el usuario no existe (no revela qué usuarios hay)", async () => {
    const response = await login("fantasma", "lo-que-sea");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Usuario o contraseña incorrectos" });
  });

  it("rechaza a un usuario dado de baja aunque la contraseña sea correcta", async () => {
    await createUser(prisma, { active: false });

    expect((await login("ana", TEST_PASSWORD)).status).toBe(401);
  });

  it("rechaza con 400 si faltan datos", async () => {
    const response = await request(app).post("/api/auth/login").send({ username: "ana" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Datos inválidos");
  });

  it("borra las sesiones vencidas del usuario al iniciar una nueva", async () => {
    await createUser(prisma);
    await login("ana", TEST_PASSWORD);
    advanceHours(13); // pasó más de lo que dura una sesión

    await login("ana", TEST_PASSWORD);

    expect(await prisma.session.count()).toBe(1);
  });
});

describe("bloqueo por intentos fallidos", () => {
  it("después de 5 fallos bloquea el login con 429, incluso con la contraseña correcta", async () => {
    await createUser(prisma);
    for (let i = 0; i < 5; i++) expect((await login("ana", "mal")).status).toBe(401);

    const response = await login("ana", TEST_PASSWORD);

    expect(response.status).toBe(429);
    expect(await prisma.session.count()).toBe(0);
  });

  it("deja volver a intentar cuando pasaron los 15 minutos", async () => {
    await createUser(prisma);
    for (let i = 0; i < 5; i++) await login("ana", "mal");

    currentTime = new Date(currentTime.getTime() + 16 * 60_000);

    expect((await login("ana", TEST_PASSWORD)).status).toBe(200);
  });

  it("un login correcto reinicia el conteo de fallos", async () => {
    await createUser(prisma);
    for (let i = 0; i < 4; i++) await login("ana", "mal");
    expect((await login("ana", TEST_PASSWORD)).status).toBe(200);

    for (let i = 0; i < 4; i++) expect((await login("ana", "mal")).status).toBe(401);
  });

  it("el bloqueo de un usuario no afecta a otro", async () => {
    await createUser(prisma);
    await createUser(prisma, { username: "beto", fullName: "Beto" });
    for (let i = 0; i < 5; i++) await login("ana", "mal");

    expect((await login("beto", TEST_PASSWORD)).status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("con sesión devuelve el usuario", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ username: "ana", fullName: "Ana Propietaria" });
  });

  it("con una cookie inventada responde 401", async () => {
    const response = await request(app).get("/api/auth/me").set("Cookie", "oasis_session=codigo-falso");

    expect(response.status).toBe(401);
  });

  it("con una sesión vencida responde 401 y la borra", async () => {
    const agent = await loginAgent(app, prisma);
    advanceHours(13);

    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it("si el usuario fue dado de baja, la sesión deja de servir", async () => {
    const agent = await loginAgent(app, prisma);
    await prisma.user.updateMany({ data: { active: false } });

    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("cierra la sesión: responde 204, la borra y la cookie deja de servir", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent.post("/api/auth/logout");

    expect(response.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("responde 204 aunque no haya sesión abierta", async () => {
    expect((await request(app).post("/api/auth/logout")).status).toBe(204);
  });
});

describe("POST /api/auth/change-password", () => {
  const NEW_PASSWORD = "NuevaClave2026!";

  it("sin sesión responde 401", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(401);
  });

  it("cambia la contraseña: la vieja deja de servir y la nueva sirve", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(204);
    expect((await login("ana", TEST_PASSWORD)).status).toBe(401);
    expect((await login("ana", NEW_PASSWORD)).status).toBe(200);
  });

  it("cierra las demás sesiones del usuario pero mantiene la actual", async () => {
    const agent = await loginAgent(app, prisma);
    await login("ana", TEST_PASSWORD); // otra sesión, por ejemplo desde un celular
    expect(await prisma.session.count()).toBe(2);

    await agent.post("/api/auth/change-password").send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(await prisma.session.count()).toBe(1);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("rechaza con 400 si la contraseña actual es incorrecta", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "equivocada", newPassword: NEW_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "La contraseña actual no es correcta" });
  });

  it("rechaza con 400 una contraseña nueva de menos de 10 caracteres", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: "corta123" });

    expect(response.status).toBe(400);
    expect(response.body.details[0].message).toContain("al menos 10 caracteres");
  });

  it("rechaza con 400 una contraseña nueva igual a la actual", async () => {
    const agent = await loginAgent(app, prisma);

    const response = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("distinta de la actual");
  });
});

describe("rutas públicas", () => {
  it("/api/health no pide sesión", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
  });
});
