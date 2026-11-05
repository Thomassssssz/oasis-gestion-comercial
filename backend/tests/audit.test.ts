import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { loginAgent, TEST_PASSWORD } from "./helpers/users.js";

// Auditoría (D20): quién hizo cada operación importante.
const prisma = createTestPrisma();
let clock = new Date("2026-11-04T15:00:00.000Z");
const app = createApp({ prisma, businessNow: () => clock });

let agent: Awaited<ReturnType<typeof loginAgent>>;
let userId: number;
let categoryId: number;

beforeEach(async () => {
  clock = new Date("2026-11-04T15:00:00.000Z");
  await resetDatabase(prisma);
  agent = await loginAgent(app, prisma);
  userId = (await prisma.user.findFirstOrThrow()).id;
  categoryId = (await prisma.category.create({ data: { name: "Papelería" } })).id;
});
afterAll(() => prisma.$disconnect());

const log = () => prisma.auditLog.findMany({ orderBy: { id: "asc" } });
const only = async () => {
  const entries = await log();
  expect(entries).toHaveLength(1);
  return entries[0]!;
};

async function seedProduct(name = "Cuaderno", salePrice = "100.00", stock = 50) {
  const product = await prisma.product.create({ data: { name, categoryId, salePrice } });
  if (stock) await prisma.stockMovement.create({ data: { productId: product.id, userId, type: "INITIAL_STOCK", quantity: stock } });
  return product.id;
}
const seedCustomer = async (creditAuthorized = true) => (await prisma.customer.create({ data: { name: "Ana", creditAuthorized } })).id;

describe("acceso", () => {
  it("sin sesión GET /api/audit responde 401", async () => {
    expect((await request(app).get("/api/audit")).status).toBe(401);
  });

  it("el registro de auditoría no se puede crear, editar ni borrar por la API", async () => {
    expect((await agent.post("/api/audit").send({})).status).toBe(404);
    expect((await agent.put("/api/audit/1").send({})).status).toBe(404);
    expect((await agent.delete("/api/audit/1")).status).toBe(404);
  });
});

describe("qué se anota", () => {
  it("una venta registrada: quién, la entidad y el resumen", async () => {
    const product = await seedProduct();
    const customer = await seedCustomer();

    const sale = await agent.post("/api/sales").send({ onCredit: true, customerId: customer, items: [{ productId: product, quantity: 2 }] });

    const entry = await only();
    expect(entry).toMatchObject({ userId, action: "SALE_REGISTERED", entityType: "Sale", entityId: sale.body.id });
    expect(entry.summary).toMatch(/^Registró la venta #\d+ por \$\s?200,00 a crédito \(cliente: Ana\)$/);
  });

  it("una venta anulada con su motivo", async () => {
    const product = await seedProduct();
    const sale = await agent.post("/api/sales").send({ paymentMethod: "CASH", items: [{ productId: product, quantity: 1 }] });

    await agent.post(`/api/sales/${sale.body.id}/annul`).send({ reason: "Cargué mal" });

    const entries = await log();
    expect(entries.map((e) => e.action)).toEqual(["SALE_REGISTERED", "SALE_ANNULLED"]);
    expect(entries[1]).toMatchObject({ entityType: "Sale", entityId: sale.body.id, summary: `Anuló la venta #${sale.body.id}. Motivo: Cargué mal` });
  });

  it("stock inicial y ajuste", async () => {
    const product = await seedProduct("Goma", "10.00", 0);

    await agent.post("/api/stock-movements").send({ type: "INITIAL_STOCK", productId: product, quantity: 20 });
    await agent.post("/api/stock-movements").send({ type: "ADJUSTMENT", productId: product, quantity: -2, reason: "DAMAGE_OR_LOSS" });

    const entries = await log();
    expect(entries.map((e) => [e.action, e.entityType, e.summary])).toEqual([
      ["STOCK_MOVEMENT_REGISTERED", "StockMovement", 'Cargó el stock inicial de "Goma": 20 unidades'],
      ["STOCK_MOVEMENT_REGISTERED", "StockMovement", 'Ajustó el stock de "Goma": -2 unidades (motivo: DAMAGE_OR_LOSS)'],
    ]);
  });

  it("pagos de cuenta corriente (y que la cuenta quedó cancelada) y recargos", async () => {
    const product = await seedProduct();
    const customer = await seedCustomer();
    const sale = await agent.post("/api/sales").send({ onCredit: true, customerId: customer, items: [{ productId: product, quantity: 10 }] }); // 1000
    const accountId = sale.body.accountId;

    await agent.post(`/api/accounts/${accountId}/payments`).send({ amount: "400.00", paymentMethod: "CASH" });
    await agent.post(`/api/accounts/${accountId}/surcharges`);
    await agent.post(`/api/accounts/${accountId}/payments`).send({ amount: "600.00", paymentMethod: "CARD" });

    const [, partial, surcharges, full] = await log();
    expect(partial).toMatchObject({ action: "ACCOUNT_PAYMENT_REGISTERED", entityType: "CreditAccount", entityId: accountId, userId });
    expect(partial!.summary).toMatch(/^Registró un pago de \$\s?400,00 en la cuenta #\d+ de Ana$/);
    expect(surcharges).toMatchObject({ action: "SURCHARGES_APPLIED", entityType: "CreditAccount", entityId: accountId });
    expect(full!.summary).toMatch(/\$\s?600,00 .*\(la cuenta quedó cancelada\)$/);
  });

  it("el cambio del recargo por mora", async () => {
    await agent.put("/api/settings").send({ lateFeePercent: "7.5" });

    expect(await only()).toMatchObject({ action: "SETTING_CHANGED", entityType: "Setting", entityId: 1, summary: "Cambió el recargo por mora a 7.50%" });
  });

  it("altas y cambios de clientes, con el crédito autorizado", async () => {
    const created = await agent.post("/api/customers").send({ name: "Beto", creditAuthorized: false });
    await agent
      .put(`/api/customers/${created.body.id}`)
      .send({ name: "Beto", phone: "", dni: "", address: "", notes: "", creditAuthorized: true, active: true });

    const entries = await log();
    expect(entries.map((e) => [e.action, e.entityId, e.summary])).toEqual([
      ["CUSTOMER_CREATED", created.body.id, 'Dio de alta al cliente "Beto" (crédito no autorizado)'],
      ["CUSTOMER_UPDATED", created.body.id, 'Modificó al cliente "Beto" (crédito autorizado, activo)'],
    ]);
  });

  it("altas y cambios de productos, con el precio", async () => {
    const created = await agent.post("/api/products").send({ name: "Lapicera", categoryId, salePrice: "250.50", minStock: 2 });
    await agent.put(`/api/products/${created.body.id}`).send({ name: "Lapicera", categoryId, salePrice: "300", minStock: 2, active: false });

    const entries = await log();
    expect(entries.map((e) => [e.action, e.entityType, e.entityId])).toEqual([
      ["PRODUCT_CREATED", "Product", created.body.id],
      ["PRODUCT_UPDATED", "Product", created.body.id],
    ]);
    expect(entries[0]!.summary).toMatch(/^Dio de alta el producto "Lapicera" a \$\s?250,50$/);
    expect(entries[1]!.summary).toMatch(/^Modificó el producto "Lapicera" \(precio \$\s?300,00, dado de baja\)$/);
  });

  it("categorías: alta, cambio y borrado (que responde sin cuerpo)", async () => {
    const created = await agent.post("/api/categories").send({ name: "Útiles" });
    await agent.put(`/api/categories/${created.body.id}`).send({ name: "Útiles escolares" });
    const removed = await agent.delete(`/api/categories/${created.body.id}`);

    expect(removed.status).toBe(204);
    const entries = await log();
    expect(entries.map((e) => [e.action, e.entityId, e.summary])).toEqual([
      ["CATEGORY_CREATED", created.body.id, 'Creó la categoría "Útiles"'],
      ["CATEGORY_UPDATED", created.body.id, 'Renombró la categoría a "Útiles escolares"'],
      ["CATEGORY_DELETED", created.body.id, `Borró la categoría #${created.body.id}`],
    ]);
  });

  it("el cambio de contraseña (que responde sin cuerpo)", async () => {
    const response = await agent.post("/api/auth/change-password").send({ currentPassword: TEST_PASSWORD, newPassword: "NuevaClave2026!" });

    expect(response.status).toBe(204);
    expect(await only()).toMatchObject({ action: "PASSWORD_CHANGED", entityType: "User", entityId: userId, userId, summary: "Cambió su contraseña" });
  });

  it("la anotación queda a nombre del usuario de la sesión, no de otro", async () => {
    const beto = await loginAgent(app, prisma, { username: "beto", fullName: "Beto Propietario" });
    const betoId = (await prisma.user.findFirstOrThrow({ where: { username: "beto" } })).id;

    await beto.post("/api/categories").send({ name: "Libros" });

    expect((await only()).userId).toBe(betoId);
    expect(betoId).not.toBe(userId);
  });
});

describe("qué NO se anota", () => {
  it("las consultas (GET), el inicio y el cierre de sesión", async () => {
    await agent.get("/api/sales");
    await agent.get("/api/products");
    await agent.get("/api/reports/sales");
    await agent.get("/api/audit");
    await agent.post("/api/auth/logout");
    await request(app).post("/api/auth/login").send({ username: "ana", password: TEST_PASSWORD });

    expect(await log()).toEqual([]);
  });

  it("las operaciones que fallan (datos inválidos, sin stock, no existe, sin permiso)", async () => {
    const product = await seedProduct("Cuaderno", "100.00", 1);

    expect((await agent.post("/api/sales").send({ paymentMethod: "CASH", items: [{ productId: product, quantity: 5 }] })).status).toBe(409); // sin stock
    expect((await agent.post("/api/sales").send({})).status).toBe(400);
    expect((await agent.post("/api/sales/999/annul").send({ reason: "x" })).status).toBe(404);
    expect((await agent.put("/api/settings").send({ lateFeePercent: "500" })).status).toBe(400);
    expect((await agent.post("/api/auth/change-password").send({ currentPassword: "incorrecta", newPassword: "NuevaClave2026!" })).status).toBe(400); // contraseña actual incorrecta
    expect((await request(app).post("/api/categories").send({ name: "X" })).status).toBe(401); // sin sesión

    expect(await log()).toEqual([]);
  });
});

describe("si falla la escritura de la auditoría", () => {
  it("la operación ya hecha no se presenta como error: responde igual y deja el error en el log del servidor", async () => {
    const spy = vi.spyOn(prisma.auditLog, "create").mockRejectedValueOnce(new Error("la base no responde"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await agent.post("/api/categories").send({ name: "Libros" });

    expect(response.status).toBe(201);
    expect(await prisma.category.count({ where: { name: "Libros" } })).toBe(1);
    expect(await log()).toEqual([]);
    expect(logged).toHaveBeenCalledWith("No se pudo escribir en el registro de auditoría:", expect.any(Error));
    spy.mockRestore();
    logged.mockRestore();
  });
});

describe("GET /api/audit", () => {
  async function seedEntries() {
    const beto = await loginAgent(app, prisma, { username: "beto", fullName: "Beto Propietario" });
    clock = new Date("2026-11-04T15:00:00.000Z");
    await agent.post("/api/categories").send({ name: "A" });
    await beto.post("/api/categories").send({ name: "B" });
    await agent.put("/api/settings").send({ lateFeePercent: "6" });
    // Fechas distintas para probar el filtro por día local (hora de Argentina)
    const [a, b, c] = await log();
    for (const [entry, createdAt] of [[a, "2026-11-01T02:59:59.000Z"], [b, "2026-11-02T10:00:00.000Z"], [c, "2026-11-05T03:00:00.000Z"]] as const) {
      await prisma.$executeRaw`ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_append_only"`;
      await prisma.$executeRaw`UPDATE "AuditLog" SET "createdAt" = ${new Date(createdAt)} WHERE id = ${entry!.id}`;
      await prisma.$executeRaw`ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_append_only"`;
    }
    return { betoId: (await prisma.user.findFirstOrThrow({ where: { username: "beto" } })).id };
  }

  it("devuelve del más nuevo al más viejo, con el nombre del usuario", async () => {
    await agent.post("/api/categories").send({ name: "A" });
    await agent.post("/api/categories").send({ name: "B" });

    const response = await agent.get("/api/audit");

    expect(response.status).toBe(200);
    expect(response.body.map((e: { summary: string }) => e.summary)).toEqual(['Creó la categoría "B"', 'Creó la categoría "A"']);
    expect(response.body[0]).toEqual({
      id: expect.any(Number),
      createdAt: expect.any(String),
      userId,
      userName: "Ana Propietaria",
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: expect.any(Number),
      summary: 'Creó la categoría "B"',
    });
  });

  it("filtra por usuario, acción y tipo de entidad", async () => {
    const { betoId } = await seedEntries();

    const byUser = await agent.get(`/api/audit?userId=${betoId}`);
    const byAction = await agent.get("/api/audit?action=SETTING_CHANGED");
    const byEntity = await agent.get("/api/audit?entityType=Category");
    const combined = await agent.get(`/api/audit?entityType=Category&userId=${userId}`);

    expect(byUser.body.map((e: { summary: string }) => e.summary)).toEqual(['Creó la categoría "B"']);
    expect(byAction.body).toHaveLength(1);
    expect(byEntity.body).toHaveLength(2);
    expect(combined.body.map((e: { summary: string }) => e.summary)).toEqual(['Creó la categoría "A"']);
  });

  it("filtra por días de Argentina, ambos incluidos", async () => {
    await seedEntries(); // A: 31/10 23:59:59 local · B: 2/11 07:00 local · C: 4/11 24:00 → 5/11 00:00 (03:00Z) local = 5/11

    const oct31 = await agent.get("/api/audit?from=2026-10-31&to=2026-10-31");
    const nov1to4 = await agent.get("/api/audit?from=2026-11-01&to=2026-11-04");
    const from = await agent.get("/api/audit?from=2026-11-02");
    const to = await agent.get("/api/audit?to=2026-11-02");

    expect(oct31.body.map((e: { summary: string }) => e.summary)).toEqual(['Creó la categoría "A"']);
    expect(nov1to4.body.map((e: { summary: string }) => e.summary)).toEqual(['Creó la categoría "B"']);
    expect(from.body).toHaveLength(2); // B y C
    expect(to.body).toHaveLength(2); // A y B
  });

  it("limita la cantidad: 100 por defecto, de 1 a 500", async () => {
    for (let i = 0; i < 3; i++) await agent.post("/api/categories").send({ name: `Cat ${i}` });

    expect((await agent.get("/api/audit?limit=2")).body).toHaveLength(2);
    expect((await agent.get("/api/audit?limit=2")).body[0].summary).toBe('Creó la categoría "Cat 2"'); // las más nuevas
    expect((await agent.get("/api/audit")).body).toHaveLength(3);
    expect((await agent.get("/api/audit?limit=500")).status).toBe(200);
    for (const bad of ["0", "501", "abc", "-1", "1.5"]) expect((await agent.get(`/api/audit?limit=${bad}`)).status, bad).toBe(400);
  });

  it("sin límite devuelve las 100 anotaciones más nuevas", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({ userId, action: "X", entityType: "Y", summary: `Anotación ${i + 1}` })),
    });

    const response = await agent.get("/api/audit");

    expect(response.body).toHaveLength(100);
    expect(response.body[0].summary).toBe("Anotación 105");
    expect(response.body[99].summary).toBe("Anotación 6");
  });

  it("rechaza filtros inválidos", async () => {
    for (const query of ["userId=abc", "userId=0", "from=2026-02-30", "to=hoy", "from=2026-11-05&to=2026-11-04", "action="]) {
      expect((await agent.get(`/api/audit?${query}`)).status, query).toBe(400);
    }
  });
});
