import { describe, expect, it } from "vitest";
import { AUDITED_ROUTES, auditEntryFor, routeKey } from "../src/helpers/audit-rules.js";

describe("routeKey", () => {
  it("une método, ruta base y ruta, sin barra final", () => {
    expect(routeKey("POST", "/api/sales", "/")).toBe("POST /api/sales");
    expect(routeKey("POST", "/api/sales", "/:id/annul")).toBe("POST /api/sales/:id/annul");
    expect(routeKey("PUT", "/api/settings", "/")).toBe("PUT /api/settings");
    expect(routeKey("POST", "/api/auth", "/change-password")).toBe("POST /api/auth/change-password");
  });
});

describe("auditEntryFor", () => {
  const ctx = { params: {}, body: null, userId: 7 };

  it("las rutas de solo lectura y el login no se auditan", () => {
    for (const key of ["GET /api/sales", "GET /api/reports/sales", "POST /api/auth/login", "POST /api/auth/logout", "GET /api/audit", "POST /api/nada"]) {
      expect(auditEntryFor(key, ctx), key).toBeNull();
    }
  });

  it("todas las rutas que modifican datos están en la lista de auditadas", () => {
    expect([...AUDITED_ROUTES].sort()).toEqual(
      [
        "DELETE /api/categories/:id",
        "POST /api/accounts/:id/payments",
        "POST /api/accounts/:id/surcharges",
        "POST /api/auth/change-password",
        "POST /api/categories",
        "POST /api/customers",
        "POST /api/products",
        "POST /api/sales",
        "POST /api/sales/:id/annul",
        "POST /api/stock-movements",
        "PUT /api/categories/:id",
        "PUT /api/customers/:id",
        "PUT /api/products/:id",
        "PUT /api/settings",
      ].sort(),
    );
  });

  it("describe una venta a crédito con el cliente y el importe en pesos argentinos", () => {
    const entry = auditEntryFor("POST /api/sales", { ...ctx, body: { id: 12, total: "1234.50", onCredit: true, customer: { name: "Ana" } } });

    expect(entry).toMatchObject({ action: "SALE_REGISTERED", entityType: "Sale", entityId: 12 });
    expect(entry!.summary).toMatch(/^Registró la venta #12 por \$\s?1\.234,50 a crédito \(cliente: Ana\)$/);
  });

  it("una venta de contado sin cliente no menciona cliente ni crédito", () => {
    const entry = auditEntryFor("POST /api/sales", { ...ctx, body: { id: 3, total: "10.00", onCredit: false, customer: null } });

    expect(entry!.summary).toMatch(/^Registró la venta #3 por \$\s?10,00$/);
  });

  it("el cambio de contraseña usa al propio usuario como entidad", () => {
    expect(auditEntryFor("POST /api/auth/change-password", ctx)).toEqual({
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: 7,
      summary: "Cambió su contraseña",
    });
  });

  it("borrar una categoría toma el id de la ruta (la respuesta no tiene cuerpo)", () => {
    expect(auditEntryFor("DELETE /api/categories/:id", { ...ctx, params: { id: "5" } })).toMatchObject({ entityId: 5, summary: "Borró la categoría #5" });
  });

  it("un id que no es un número queda sin entidad en lugar de romper", () => {
    expect(auditEntryFor("DELETE /api/categories/:id", { ...ctx, params: { id: "abc" } })!.entityId).toBeNull();
    expect(auditEntryFor("POST /api/sales", { ...ctx, body: { id: "7", total: "1.00" } })!.entityId).toBeNull();
  });

  it("describe los ajustes de stock con signo y los de stock inicial sin motivo", () => {
    const ajuste = auditEntryFor("POST /api/stock-movements", { ...ctx, body: { id: 1, type: "ADJUSTMENT", productName: "Goma", quantity: -3, reason: "DAMAGE_OR_LOSS" } });
    const inicial = auditEntryFor("POST /api/stock-movements", { ...ctx, body: { id: 2, type: "INITIAL_STOCK", productName: "Goma", quantity: 10, reason: null } });
    const suma = auditEntryFor("POST /api/stock-movements", { ...ctx, body: { id: 3, type: "ADJUSTMENT", productName: "Goma", quantity: 4, reason: "PHYSICAL_COUNT" } });

    expect(ajuste!.summary).toBe('Ajustó el stock de "Goma": -3 unidades (motivo: DAMAGE_OR_LOSS)');
    expect(suma!.summary).toBe('Ajustó el stock de "Goma": +4 unidades (motivo: PHYSICAL_COUNT)');
    expect(inicial!.summary).toBe('Cargó el stock inicial de "Goma": 10 unidades');
  });

  it("un pago que cancela la cuenta lo aclara", () => {
    const base = { id: 4, customer: { name: "Ana" }, payments: [{ amount: "10.00" }, { amount: "500.00" }] };

    const partial = auditEntryFor("POST /api/accounts/:id/payments", { ...ctx, body: { ...base, status: "OPEN" } });
    const full = auditEntryFor("POST /api/accounts/:id/payments", { ...ctx, body: { ...base, status: "CANCELLED" } });

    expect(partial!.summary).toMatch(/^Registró un pago de \$\s?500,00 en la cuenta #4 de Ana$/); // el último pago, no el primero
    expect(full!.summary).toMatch(/\(la cuenta quedó cancelada\)$/);
  });
});
