import { Prisma } from "../config/prisma.js";
import { badRequest, conflict, notFound } from "../helpers/errors.js";
import type { SaleRecord, SaleRepository } from "../repositories/sale.repository.js";
import type { AnnulInput, SaleInput, SaleListQuery } from "../validators/sale.validator.js";

const NOT_FOUND = "La venta no existe";

// Forma en que la API devuelve una venta. Los importes van como texto con 2 decimales.
// El total no se guarda: se calcula sumando cantidad × precio de cada ítem (D13-c).
function toDto(sale: SaleRecord) {
  const items = sale.items.map((item) => ({
    productId: item.productId,
    productName: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    subtotal: item.unitPrice.mul(item.quantity).toFixed(2),
  }));
  const total = sale.items.reduce((sum, item) => sum.add(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));

  return {
    id: sale.id,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    total: total.toFixed(2),
    userId: sale.userId,
    userName: sale.user.fullName,
    createdAt: sale.createdAt,
    annulment:
      sale.status === "ANNULLED"
        ? { at: sale.annulledAt, byId: sale.annulledById, byName: sale.annulledBy?.fullName ?? null, reason: sale.annulmentReason }
        : null,
    items,
  };
}

// Reglas de negocio de las ventas rápidas (D2, D3 y D13).
// Una venta no se edita ni se borra: se anula y queda el registro.
export function createSaleService(repository: SaleRepository) {
  async function getDto(id: number) {
    const sale = await repository.findById(id);
    if (!sale) throw notFound(NOT_FOUND);
    return toDto(sale);
  }

  return {
    async list(query: SaleListQuery) {
      return (await repository.findAll(query)).map(toDto);
    },

    get: getDto,

    // Registra la venta a nombre de `userId`: todo o nada. Usa el precio de lista de hoy (D13-a)
    // y descuenta el stock; si algún producto no alcanza, no se guarda nada (D2).
    async register(userId: number, input: SaleInput) {
      const saleId = await repository.withLockedProducts(
        input.items.map((item) => item.productId),
        async (ops) => {
          const products = new Map((await ops.products()).map((product) => [product.id, product]));
          const stocks = await ops.stocks();

          const items = input.items.map((item) => {
            const product = products.get(item.productId);
            if (!product) throw badRequest(`El producto ${item.productId} no existe`);
            if (!product.active) throw conflict(`El producto "${product.name}" está dado de baja y no se puede vender`);

            const stock = stocks.get(product.id) ?? 0;
            if (stock < item.quantity) {
              throw conflict(`No hay stock suficiente de "${product.name}" (stock actual: ${stock})`);
            }
            return { productId: product.id, quantity: item.quantity, unitPrice: product.salePrice };
          });

          return ops.createSale({ userId, paymentMethod: input.paymentMethod, items });
        },
      );

      return getDto(saleId);
    },

    // Anula la venta: queda en el historial con quién, cuándo y por qué, y devuelve el stock (D13-b).
    async annul(id: number, userId: number, { reason }: AnnulInput) {
      const sale = await repository.findById(id);
      if (!sale) throw notFound(NOT_FOUND);

      await repository.withLockedProducts(
        sale.items.map((item) => item.productId),
        async (ops) => {
          // Se vuelve a leer el estado con los productos bloqueados: si otra anulación se coló, acá se detecta.
          if ((await ops.saleStatus(id)) === "ANNULLED") throw conflict("La venta ya está anulada");
          await ops.annulSale(id, userId, reason);
        },
      );

      return getDto(id);
    },
  };
}

export type SaleService = ReturnType<typeof createSaleService>;
