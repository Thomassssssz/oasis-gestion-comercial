import { Prisma } from "../config/prisma.js";
import { accountBalance } from "../helpers/credit.js";
import { badRequest, conflict, notFound } from "../helpers/errors.js";
import { subtotalOf } from "../helpers/sale-total.js";
import type { SaleRecord, SaleRepository } from "../repositories/sale.repository.js";
import type { AnnulInput, SaleInput, SaleListQuery } from "../validators/sale.validator.js";

const NOT_FOUND = "La venta no existe";

// Forma en que la API devuelve una venta. Los importes van como texto con 2 decimales.
// El total no se guarda: se calcula como subtotal (suma de cantidad × precio de cada ítem) menos el descuento (D13-c, D17).
function toDto(sale: SaleRecord) {
  const items = sale.items.map((item) => ({
    productId: item.productId,
    productName: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    subtotal: item.unitPrice.mul(item.quantity).toFixed(2),
  }));
  const subtotal = subtotalOf(sale.items);

  return {
    id: sale.id,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    onCredit: sale.onCredit,
    customer: sale.customer,
    accountId: sale.creditAccountId,
    subtotal: subtotal.toFixed(2),
    discount: sale.discountAmount.toFixed(2),
    total: subtotal.sub(sale.discountAmount).toFixed(2),
    note: sale.note,
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

// Reglas de negocio de las ventas, rápidas y completas (D2, D3, D13 y D17).
// Una venta no se edita ni se borra: se anula y queda el registro.
export function createSaleService(repository: SaleRepository, now: () => Date = () => new Date()) {
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
    // Si es a crédito, la suma a la ficha de cuenta corriente del cliente (y la abre si no tiene una abierta) (D17).
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

          // El descuento es un importe en pesos y tiene que dejar algo para cobrar (D17-c).
          const discount = new Prisma.Decimal(input.discount);
          if (discount.greaterThanOrEqualTo(subtotalOf(items))) {
            throw badRequest("El descuento no puede ser igual o mayor al total de la venta");
          }

          if (input.customerId !== undefined) {
            const customer = await ops.customer(input.customerId);
            if (!customer) throw badRequest("El cliente no existe");
            if (!customer.active) throw conflict(`El cliente "${customer.name}" está dado de baja`);
            if (input.onCredit && !customer.creditAuthorized) {
              throw conflict(`El cliente "${customer.name}" no está autorizado a comprar a crédito`);
            }
          }

          const createdAt = now();
          let creditAccountId: number | null = null;
          if (input.onCredit) {
            // La ficha del cliente: la abierta si hay una; si no, se abre una nueva y empieza su plazo de un mes.
            creditAccountId =
              (await ops.account.findOpenFor(input.customerId!)) ?? (await ops.account.open(input.customerId!, createdAt));
          }

          return ops.createSale({
            userId,
            paymentMethod: input.onCredit ? null : (input.paymentMethod ?? null),
            customerId: input.customerId ?? null,
            discountAmount: discount,
            note: input.note,
            onCredit: input.onCredit,
            creditAccountId,
            createdAt,
            items,
          });
        },
        // Al vender a crédito se bloquea al cliente para que dos ventas simultáneas no abran dos fichas.
        input.onCredit ? { customerId: input.customerId } : {},
      );

      return getDto(saleId);
    },

    // Anula la venta: queda en el historial con quién, cuándo y por qué, y devuelve el stock (D13-b).
    // Si era a crédito, el saldo de la ficha baja; si queda en cero, la ficha pasa al historial de canceladas (D17-d).
    async annul(id: number, userId: number, { reason }: AnnulInput) {
      const sale = await repository.findById(id);
      if (!sale) throw notFound(NOT_FOUND);

      await repository.withLockedProducts(
        sale.items.map((item) => item.productId),
        async (ops) => {
          // Se vuelve a leer el estado con los productos bloqueados: si otra anulación se coló, acá se detecta.
          if ((await ops.saleStatus(id)) === "ANNULLED") throw conflict("La venta ya está anulada");

          const at = now();
          await ops.annulSale(id, userId, reason, at);

          if (sale.creditAccountId !== null) {
            const balance = accountBalance(await ops.account.movements(sale.creditAccountId));
            // Si el cliente ya pagó más de lo que quedaría debiendo, no se puede anular (se revierte todo).
            if (balance.isNegative()) {
              throw conflict("No se puede anular: el cliente ya pagó más de lo que quedaría adeudado en su cuenta");
            }
            if (balance.isZero()) await ops.account.close(sale.creditAccountId, at);
          }
        },
        sale.creditAccountId !== null ? { accountId: sale.creditAccountId } : {},
      );

      return getDto(id);
    },
  };
}

export type SaleService = ReturnType<typeof createSaleService>;
