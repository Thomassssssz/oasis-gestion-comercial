import { Prisma } from "../config/prisma.js";
import { accountBalance, computeDueSurcharges, monthsOverdue, type AccountMovements } from "../helpers/credit.js";
import { conflict, notFound } from "../helpers/errors.js";
import { totalOf } from "../helpers/sale-total.js";
import type { AccountQueries, CreditAccountRecord, CreditAccountRepository } from "../repositories/credit-account.repository.js";
import { hasPrismaCode } from "../helpers/prisma-errors.js";
import type { AccountListQuery, AccountPaymentInput, AccountRemitoInput } from "../validators/credit-account.validator.js";

const NOT_FOUND = "La cuenta no existe";
const money = (value: Prisma.Decimal) => value.toFixed(2);

function movementsOf(account: CreditAccountRecord): AccountMovements {
  return {
    sales: account.sales.map((sale) => ({
      total: totalOf(sale.items, sale.discountAmount),
      createdAt: sale.createdAt,
      annulledAt: sale.annulledAt,
    })),
    payments: account.payments,
    surcharges: account.surcharges,
  };
}

// Reglas de las fichas de cuenta corriente (D17 y D18). El saldo no se guarda: se calcula con los movimientos de la ficha.
// La fórmula del recargo vive en helpers/credit.ts; acá solo se decide cuándo se calcula y cuándo se registra.
export function createCreditAccountService(repository: CreditAccountRepository, now: () => Date = () => new Date()) {
  // Arma la respuesta de una ficha. `percent` es el recargo vigente, para mostrar los recargos que ya corresponden
  // pero todavía no se registraron (solo se muestran: registrarlos es una acción aparte).
  function toDto(account: CreditAccountRecord, percent: Prisma.Decimal) {
    const movements = movementsOf(account);
    const balance = accountBalance(movements);
    const open = account.status === "OPEN";
    const today = now();
    const pending = open ? computeDueSurcharges({ dueDate: account.dueDate, now: today, percent, movements }) : [];
    const pendingTotal = pending.reduce((total, s) => total.add(s.amount), new Prisma.Decimal(0));

    return {
      id: account.id,
      customer: account.customer,
      status: account.status,
      openedAt: account.openedAt,
      dueDate: account.dueDate,
      closedAt: account.closedAt,
      number: account.number,
      remitoNumber: account.remitoNumber,
      balance: money(balance),
      pendingSurchargesTotal: money(pendingTotal),
      payable: money(balance.add(pendingTotal)), // saldo + recargos que ya corresponden: lo que hay que pagar hoy
      overdue: open && today > account.dueDate,
      monthsOverdue: open ? monthsOverdue(account.dueDate, today) : 0,
      pendingSurcharges: pending.map((s) => ({
        monthNumber: s.monthNumber,
        base: money(s.base),
        percent: money(s.percent),
        amount: money(s.amount),
        chargedOn: s.chargedOn,
      })),
      surcharges: account.surcharges.map((s) => ({
        monthNumber: s.monthNumber,
        base: money(s.base),
        percent: money(s.percent),
        amount: money(s.amount),
        chargedOn: s.chargedOn,
        registeredAt: s.createdAt,
      })),
      payments: account.payments.map((p) => ({
        id: p.id,
        amount: money(p.amount),
        paymentMethod: p.paymentMethod,
        note: p.note,
        createdAt: p.createdAt,
        userName: p.user.fullName,
      })),
      // Cada venta con sus artículos (lo que va en la ficha impresa): cantidad, detalle, precio unitario y total de la línea.
      sales: account.sales.map((sale) => ({
        id: sale.id,
        status: sale.status,
        createdAt: sale.createdAt,
        note: sale.note,
        discount: money(sale.discountAmount),
        total: money(totalOf(sale.items, sale.discountAmount)),
        items: sale.items.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: money(item.unitPrice),
          subtotal: money(item.unitPrice.mul(item.quantity)),
        })),
      })),
    };
  }

  async function getDto(id: number) {
    const account = await repository.findById(id);
    if (!account) throw notFound(NOT_FOUND);
    return toDto(account, await repository.lateFeePercent());
  }

  // Registra, dentro de la transacción de la ficha, los recargos que ya corresponden y todavía no figuran (D18).
  // Cada uno guarda el porcentaje y la base con que se calculó. Devuelve los movimientos actualizados.
  async function registerDueSurcharges(ops: AccountQueries, accountId: number, dueDate: Date, userId: number, at: Date) {
    const movements = await ops.movements(accountId);
    const due = computeDueSurcharges({ dueDate, now: at, percent: await ops.lateFeePercent(), movements });

    for (const surcharge of due) {
      await ops.addSurcharge({
        accountId,
        userId,
        monthNumber: surcharge.monthNumber,
        base: surcharge.base,
        percent: surcharge.percent,
        amount: surcharge.amount,
        chargedOn: surcharge.chargedOn,
        createdAt: at,
      });
      movements.surcharges.push({ monthNumber: surcharge.monthNumber, amount: surcharge.amount });
    }
    return movements;
  }

  return {
    async list(query: AccountListQuery) {
      const [accounts, percent] = await Promise.all([repository.findAll(query), repository.lateFeePercent()]);
      return accounts.map((account) => toDto(account, percent));
    },

    get: getDto,

    // Guarda el número de ficha y el de remito. Se puede en fichas abiertas y canceladas: no cambia dinero ni vencimientos.
    async updateRemito(id: number, input: AccountRemitoInput) {
      try {
        return toDto(await repository.updateRemito(id, input), await repository.lateFeePercent());
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        throw error;
      }
    },

    // Registra los recargos por mora que ya corresponden. No toca los ya registrados (no se recalcula el pasado).
    async applySurcharges(id: number, userId: number) {
      await repository.withLockedAccount(id, async (ops) => {
        const account = await ops.find(id);
        if (!account) throw notFound(NOT_FOUND);
        if (account.status === "CANCELLED") throw conflict("La cuenta ya está cancelada");
        await registerDueSurcharges(ops, id, account.dueDate, userId, now());
      });
      return getDto(id);
    },

    // Registra un pago. Primero se registran los recargos que ya corresponden (así el pago los cubre), después se
    // valida que no supere el saldo. Un pago parcial NO cambia el vencimiento. Si el saldo llega a cero, la ficha
    // pasa al historial de canceladas. Todo o nada: si el pago se rechaza, tampoco quedan recargos registrados.
    async pay(id: number, userId: number, input: AccountPaymentInput) {
      await repository.withLockedAccount(id, async (ops) => {
        const account = await ops.find(id);
        if (!account) throw notFound(NOT_FOUND);
        if (account.status === "CANCELLED") throw conflict("La cuenta ya está cancelada");

        const at = now();
        const movements = await registerDueSurcharges(ops, id, account.dueDate, userId, at);
        const balance = accountBalance(movements);
        const amount = new Prisma.Decimal(input.amount);

        if (amount.greaterThan(balance)) {
          throw conflict(`El pago no puede superar el saldo de la cuenta (saldo actual: ${money(balance)})`);
        }

        await ops.addPayment({ accountId: id, userId, amount, paymentMethod: input.paymentMethod, note: input.note, createdAt: at });
        if (balance.sub(amount).isZero()) await ops.close(id, at);
      });
      return getDto(id);
    },
  };
}

export type CreditAccountService = ReturnType<typeof createCreditAccountService>;
