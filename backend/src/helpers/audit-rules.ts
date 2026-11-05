// Qué operaciones se auditan y cómo se describen (D20). Es una sola tabla: cada fila dice, para una ruta que modifica
// datos, qué acción registrar y qué texto mostrar. Las operaciones de solo lectura y el inicio de sesión no se auditan.
// Son funciones puras: reciben lo que se pidió y lo que se respondió, y devuelven la anotación (o nada).

export type AuditEntry = { action: string; entityType: string; entityId: number | null; summary: string };

type Body = Record<string, any> | null; // la respuesta de la API ya validada; se lee con cuidado porque cambia según la ruta
type Context = { params: Record<string, unknown>; body: Body; userId: number };

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const money = (value: unknown) => pesos.format(Number(value));
const idFrom = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : null);
const paramId = (params: Record<string, unknown>) => {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
};

const rules: Record<string, (ctx: Context) => AuditEntry> = {
  "POST /api/sales": ({ body }) => ({
    action: "SALE_REGISTERED",
    entityType: "Sale",
    entityId: idFrom(body?.id),
    summary:
      `Registró la venta #${body?.id} por ${money(body?.total)}` +
      (body?.onCredit ? ` a crédito (cliente: ${body?.customer?.name})` : body?.customer ? ` (cliente: ${body.customer.name})` : ""),
  }),

  "POST /api/sales/:id/annul": ({ body }) => ({
    action: "SALE_ANNULLED",
    entityType: "Sale",
    entityId: idFrom(body?.id),
    summary: `Anuló la venta #${body?.id}. Motivo: ${body?.annulment?.reason}`,
  }),

  "POST /api/stock-movements": ({ body }) => ({
    action: "STOCK_MOVEMENT_REGISTERED",
    entityType: "StockMovement",
    entityId: idFrom(body?.id),
    summary:
      body?.type === "INITIAL_STOCK"
        ? `Cargó el stock inicial de "${body?.productName}": ${body?.quantity} unidades`
        : `Ajustó el stock de "${body?.productName}": ${body?.quantity > 0 ? "+" : ""}${body?.quantity} unidades (motivo: ${body?.reason})`,
  }),

  "POST /api/accounts/:id/payments": ({ body }) => {
    const payment = body?.payments?.at(-1);
    return {
      action: "ACCOUNT_PAYMENT_REGISTERED",
      entityType: "CreditAccount",
      entityId: idFrom(body?.id),
      summary:
        `Registró un pago de ${money(payment?.amount)} en la cuenta #${body?.id} de ${body?.customer?.name}` +
        (body?.status === "CANCELLED" ? " (la cuenta quedó cancelada)" : ""),
    };
  },

  "POST /api/accounts/:id/surcharges": ({ body }) => ({
    action: "SURCHARGES_APPLIED",
    entityType: "CreditAccount",
    entityId: idFrom(body?.id),
    summary: `Aplicó los recargos por mora de la cuenta #${body?.id} de ${body?.customer?.name} (recargos registrados en la cuenta: ${body?.surcharges?.length})`,
  }),

  "PUT /api/settings": ({ body }) => ({
    action: "SETTING_CHANGED",
    entityType: "Setting",
    entityId: 1,
    summary: `Cambió el recargo por mora a ${body?.lateFeePercent}%`,
  }),

  "PUT /api/settings/business": ({ body }) => ({
    action: "BUSINESS_DATA_CHANGED",
    entityType: "Setting",
    entityId: 1,
    summary: `Cambió los datos del comercio del remito${body?.name ? ` ("${body.name}")` : ""}`,
  }),

  "PUT /api/accounts/:id/remito": ({ body }) => ({
    action: "ACCOUNT_REMITO_UPDATED",
    entityType: "CreditAccount",
    entityId: idFrom(body?.id),
    summary: `Cambió los números del remito de la cuenta #${body?.id} de ${body?.customer?.name}`,
  }),

  "POST /api/customers": ({ body }) => ({
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: idFrom(body?.id),
    summary: `Dio de alta al cliente "${body?.name}" (crédito ${body?.creditAuthorized ? "autorizado" : "no autorizado"})`,
  }),

  "PUT /api/customers/:id": ({ body }) => ({
    action: "CUSTOMER_UPDATED",
    entityType: "Customer",
    entityId: idFrom(body?.id),
    summary: `Modificó al cliente "${body?.name}" (crédito ${body?.creditAuthorized ? "autorizado" : "no autorizado"}, ${body?.active ? "activo" : "dado de baja"})`,
  }),

  "POST /api/products": ({ body }) => ({
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: idFrom(body?.id),
    summary: `Dio de alta el producto "${body?.name}" a ${money(body?.salePrice)}`,
  }),

  "PUT /api/products/:id": ({ body }) => ({
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: idFrom(body?.id),
    summary: `Modificó el producto "${body?.name}" (precio ${money(body?.salePrice)}, ${body?.active ? "activo" : "dado de baja"})`,
  }),

  "POST /api/categories": ({ body }) => ({
    action: "CATEGORY_CREATED",
    entityType: "Category",
    entityId: idFrom(body?.id),
    summary: `Creó la categoría "${body?.name}"`,
  }),

  "PUT /api/categories/:id": ({ body }) => ({
    action: "CATEGORY_UPDATED",
    entityType: "Category",
    entityId: idFrom(body?.id),
    summary: `Renombró la categoría a "${body?.name}"`,
  }),

  "DELETE /api/categories/:id": ({ params }) => ({
    action: "CATEGORY_DELETED",
    entityType: "Category",
    entityId: paramId(params),
    summary: `Borró la categoría #${params.id}`,
  }),

  "POST /api/auth/change-password": ({ userId }) => ({
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: userId,
    summary: "Cambió su contraseña",
  }),
};

// La clave de una ruta: método + ruta completa con sus parámetros, sin barra final ("POST /api/sales/:id/annul").
export const routeKey = (method: string, baseUrl: string, routePath: string) =>
  `${method} ${baseUrl}${routePath}`.replace(/\/+$/, "");

export function auditEntryFor(key: string, ctx: Context): AuditEntry | null {
  const rule = rules[key];
  return rule ? rule(ctx) : null;
}

export const AUDITED_ROUTES = Object.keys(rules);
