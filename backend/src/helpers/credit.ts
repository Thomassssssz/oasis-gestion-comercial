import { Prisma } from "../config/prisma.js";

// Cálculos de las cuentas corrientes (D17 y D18). Son funciones puras: reciben datos y devuelven resultados,
// sin tocar la base. Así la fórmula del recargo está toda en este archivo y se puede probar y cambiar en un solo lugar.

type Money = Prisma.Decimal;

export type AccountSale = { total: Money; createdAt: Date; annulledAt: Date | null };
export type AccountPayment = { amount: Money; createdAt: Date };
export type AccountSurcharge = { monthNumber: number; amount: Money };
export type AccountMovements = { sales: AccountSale[]; payments: AccountPayment[]; surcharges: AccountSurcharge[] };

const ZERO = new Prisma.Decimal(0);
const sum = (values: Money[]) => values.reduce((total, value) => total.add(value), ZERO);

// Suma meses a una fecha en UTC. Si el día no existe en el mes de destino, se usa el último día de ese mes
// (31 de enero + 1 mes = 28 o 29 de febrero).
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// El plazo de una ficha es de un mes desde el primer producto registrado en ella (regla confirmada).
export const dueDateFor = (openedAt: Date) => addMonths(openedAt, 1);

// Fecha en que el mes de atraso número `monthNumber` queda completo (y por lo tanto se puede recargar).
export const surchargeDate = (dueDate: Date, monthNumber: number) => addMonths(dueDate, monthNumber);

// Saldo de la ficha hoy: ventas que no se anularon + recargos registrados - pagos.
export function accountBalance({ sales, payments, surcharges }: AccountMovements): Money {
  const charged = sum(sales.filter((sale) => sale.annulledAt === null).map((sale) => sale.total));
  return charged.add(sum(surcharges.map((s) => s.amount))).sub(sum(payments.map((p) => p.amount)));
}

// Capital pendiente a una fecha: lo vendido hasta ese momento (sin contar ventas anuladas hasta entonces)
// menos lo que los pagos hechos hasta entonces cubrieron del capital. Los pagos cubren primero los recargos
// que ya correspondían a esa fecha y después el capital (D18-c). Nunca es negativo.
export function capitalPendingAt(date: Date, dueDate: Date, { sales, payments, surcharges }: AccountMovements): Money {
  const sold = sum(
    sales
      .filter((sale) => sale.createdAt <= date && (sale.annulledAt === null || sale.annulledAt > date))
      .map((sale) => sale.total),
  );
  const paid = sum(payments.filter((payment) => payment.createdAt <= date).map((payment) => payment.amount));
  const surchargesDue = sum(surcharges.filter((s) => surchargeDate(dueDate, s.monthNumber) <= date).map((s) => s.amount));

  const paidToCapital = maxMoney(paid.sub(surchargesDue), ZERO);
  return maxMoney(sold.sub(paidToCapital), ZERO);
}

function maxMoney(a: Money, b: Money): Money {
  return a.greaterThan(b) ? a : b;
}

// Cantidad de meses de atraso completos que pasaron desde el vencimiento hasta `now`.
export function monthsOverdue(dueDate: Date, now: Date): number {
  let months = 0;
  while (surchargeDate(dueDate, months + 1) <= now) months += 1;
  return months;
}

export type DueSurcharge = { monthNumber: number; base: Money; percent: Money; amount: Money; chargedOn: Date };

// Recargos que ya corresponden y todavía no se registraron (D18). Fórmula propuesta, sin confirmar:
//   por cada mes de atraso completo, recargo = porcentaje × capital pendiente al inicio de ese mes, sin capitalizar
//   (el recargo de un mes no genera recargo en el mes siguiente).
// El primer mes toma el saldo pendiente al vencimiento. No toca los recargos ya registrados: no recalcula el pasado.
export function computeDueSurcharges(params: {
  dueDate: Date;
  now: Date;
  percent: Money;
  movements: AccountMovements;
}): DueSurcharge[] {
  const { dueDate, now, percent, movements } = params;
  const registered = new Set(movements.surcharges.map((s) => s.monthNumber));
  // Se van sumando los recargos nuevos para que cada mes tenga en cuenta a los anteriores al imputar los pagos.
  const known = [...movements.surcharges];
  const due: DueSurcharge[] = [];

  for (let month = 1; month <= monthsOverdue(dueDate, now); month += 1) {
    if (registered.has(month)) continue;

    const base = capitalPendingAt(addMonths(dueDate, month - 1), dueDate, { ...movements, surcharges: known });
    const amount = base.mul(percent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (amount.isZero()) continue;

    due.push({ monthNumber: month, base, percent, amount, chargedOn: surchargeDate(dueDate, month) });
    known.push({ monthNumber: month, amount });
  }

  return due;
}
