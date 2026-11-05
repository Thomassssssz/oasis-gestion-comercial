import { accountBalance, monthsOverdue } from "../helpers/credit.js";
import { notFound } from "../helpers/errors.js";
import { totalOf } from "../helpers/sale-total.js";
import type { CreditAccountRecord, CreditAccountRepository } from "../repositories/credit-account.repository.js";
import type { AccountListQuery } from "../validators/credit-account.validator.js";

const NOT_FOUND = "La cuenta no existe";

// Reglas de las fichas de cuenta corriente (D17). El saldo no se guarda: se calcula con los movimientos de la ficha.
export function createCreditAccountService(repository: CreditAccountRepository, now: () => Date = () => new Date()) {
  function toDto(account: CreditAccountRecord) {
    const sales = account.sales.map((sale) => ({
      id: sale.id,
      status: sale.status,
      createdAt: sale.createdAt,
      note: sale.note,
      total: totalOf(sale.items, sale.discountAmount),
      annulledAt: sale.annulledAt,
    }));
    const balance = accountBalance({
      sales: sales.map((sale) => ({ total: sale.total, createdAt: sale.createdAt, annulledAt: sale.annulledAt })),
      payments: [],
      surcharges: [],
    });
    const open = account.status === "OPEN";
    const today = now();

    return {
      id: account.id,
      customer: account.customer,
      status: account.status,
      openedAt: account.openedAt,
      dueDate: account.dueDate,
      closedAt: account.closedAt,
      balance: balance.toFixed(2),
      overdue: open && today > account.dueDate,
      monthsOverdue: open ? monthsOverdue(account.dueDate, today) : 0,
      sales: sales.map((sale) => ({
        id: sale.id,
        status: sale.status,
        createdAt: sale.createdAt,
        note: sale.note,
        total: sale.total.toFixed(2),
      })),
    };
  }

  return {
    async list(query: AccountListQuery) {
      return (await repository.findAll(query)).map(toDto);
    },

    async get(id: number) {
      const account = await repository.findById(id);
      if (!account) throw notFound(NOT_FOUND);
      return toDto(account);
    },
  };
}

export type CreditAccountService = ReturnType<typeof createCreditAccountService>;
