import { Prisma } from "../config/prisma.js";
import { addDays, daysBetween, localDate, startOfLocalDay } from "../helpers/report-dates.js";
import { badRequest } from "../helpers/errors.js";
import { totalOf } from "../helpers/sale-total.js";
import type { ReportRepository } from "../repositories/report.repository.js";
import type { CreditAccountService } from "./credit-account.service.js";
import { rangeProblem, type SalesReportQuery } from "../validators/report.validator.js";

const ZERO = new Prisma.Decimal(0);
const TOP_PRODUCTS = 10;
const DEFAULT_DAYS = 30;
// Orden fijo de los medios de pago en el reporte. ON_CREDIT agrupa las ventas a crédito (no tienen medio de pago).
const METHOD_ORDER = ["CASH", "TRANSFER", "CARD", "DIGITAL_WALLET", "ON_CREDIT"] as const;

// Reportes y estadísticas (módulo 7). Solo lectura y siempre calculados al momento: no se guarda nada.
// Cuentan las ventas CONFIRMADAS; las anuladas no suman. Las ventas a crédito cuentan como venta del día en que se hicieron
// (se agrupan aparte como "A crédito"); cuándo se cobran se ve en Cuentas corrientes. No hay reportes de costos de compra (D15).
export function createReportService(repository: ReportRepository, accounts: CreditAccountService, now: () => Date = () => new Date()) {
  return {
    async sales(query: SalesReportQuery) {
      const to = query.to ?? localDate(now());
      const from = query.from ?? addDays(to, -(DEFAULT_DAYS - 1));
      const problem = rangeProblem(from, to); // cubre el caso en que una de las dos fechas se completó por defecto
      if (problem) throw badRequest(problem);
      const sales = await repository.findConfirmedSales(startOfLocalDay(from), startOfLocalDay(addDays(to, 1)));

      const byDay = new Map(daysBetween(from, to).map((day) => [day, { count: 0, total: ZERO }]));
      const byMethod = new Map<string, { count: number; total: Prisma.Decimal }>();
      const byProduct = new Map<number, { productName: string; quantity: number; total: Prisma.Decimal }>();
      let grandTotal = ZERO;

      for (const sale of sales) {
        const total = totalOf(sale.items, sale.discountAmount);
        grandTotal = grandTotal.add(total);

        const day = byDay.get(localDate(sale.createdAt))!;
        day.count += 1;
        day.total = day.total.add(total);

        const method = sale.onCredit ? "ON_CREDIT" : sale.paymentMethod!;
        const entry = byMethod.get(method) ?? { count: 0, total: ZERO };
        byMethod.set(method, { count: entry.count + 1, total: entry.total.add(total) });

        for (const item of sale.items) {
          const product = byProduct.get(item.productId) ?? { productName: item.product.name, quantity: 0, total: ZERO };
          byProduct.set(item.productId, {
            productName: product.productName,
            quantity: product.quantity + item.quantity,
            total: product.total.add(item.unitPrice.mul(item.quantity)), // antes del descuento: el descuento es de toda la venta (D17-c)
          });
        }
      }

      return {
        from,
        to,
        totals: {
          count: sales.length,
          total: grandTotal.toFixed(2),
          average: (sales.length === 0 ? ZERO : grandTotal.div(sales.length)).toFixed(2),
        },
        byDay: [...byDay].map(([date, v]) => ({ date, count: v.count, total: v.total.toFixed(2) })),
        byPaymentMethod: METHOD_ORDER.filter((method) => byMethod.has(method)).map((method) => ({
          method,
          count: byMethod.get(method)!.count,
          total: byMethod.get(method)!.total.toFixed(2),
        })),
        topProducts: [...byProduct]
          .map(([productId, v]) => ({ productId, productName: v.productName, quantity: v.quantity, total: v.total }))
          .sort((a, b) => b.quantity - a.quantity || b.total.comparedTo(a.total) || a.productName.localeCompare(b.productName))
          .slice(0, TOP_PRODUCTS)
          .map((p) => ({ ...p, total: p.total.toFixed(2) })),
      };
    },

    // Deuda de clientes: las cuentas pendientes, de mayor a menor monto a pagar hoy (saldo + recargos que ya corresponden).
    async debt() {
      const open = await accounts.list({ status: "OPEN" });
      const rows = open
        .map((account) => ({
          accountId: account.id,
          customer: account.customer,
          balance: account.balance,
          payable: account.payable,
          dueDate: account.dueDate,
          overdue: account.overdue,
          monthsOverdue: account.monthsOverdue,
        }))
        .sort((a, b) => Number(b.payable) - Number(a.payable) || a.customer.name.localeCompare(b.customer.name));
      const sum = (key: "balance" | "payable") => rows.reduce((total, row) => total.add(row[key]), ZERO).toFixed(2);

      return { totalBalance: sum("balance"), totalPayable: sum("payable"), accounts: rows };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
