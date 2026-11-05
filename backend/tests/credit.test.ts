import { describe, expect, it } from "vitest";
import { Prisma } from "../src/config/prisma.js";
import {
  accountBalance,
  addMonths,
  capitalPendingAt,
  computeDueSurcharges,
  dueDateFor,
  monthsOverdue,
  surchargeDate,
  type AccountMovements,
} from "../src/helpers/credit.js";

// Pruebas de las funciones puras de cuentas corrientes (sin base de datos).
const D = (value: string | number) => new Prisma.Decimal(value);
const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const none: AccountMovements = { sales: [], payments: [], surcharges: [] };
const sale = (total: number | string, createdAt: string, annulledAt: string | null = null) => ({
  total: D(total),
  createdAt: at(createdAt),
  annulledAt: annulledAt ? at(annulledAt) : null,
});
const payment = (amount: number | string, createdAt: string) => ({ amount: D(amount), createdAt: at(createdAt) });

describe("addMonths", () => {
  it("suma meses manteniendo el día y la hora", () => {
    expect(addMonths(new Date("2026-03-15T10:30:00.000Z"), 1).toISOString()).toBe("2026-04-15T10:30:00.000Z");
    expect(addMonths(new Date("2026-03-15T10:30:00.000Z"), 12).toISOString()).toBe("2027-03-15T10:30:00.000Z");
  });

  it("pasa de diciembre a enero del año siguiente", () => {
    expect(addMonths(at("2026-12-10"), 1).toISOString().slice(0, 10)).toBe("2027-01-10");
  });

  it("si el día no existe en el mes de destino, usa el último día de ese mes", () => {
    expect(addMonths(at("2027-01-31"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(at("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29"); // año bisiesto
    expect(addMonths(at("2026-03-31"), 1).toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("no modifica la fecha original", () => {
    const original = at("2026-05-20");
    addMonths(original, 3);
    expect(original.toISOString()).toBe(at("2026-05-20").toISOString());
  });
});

describe("vencimiento", () => {
  it("el plazo de la ficha es de un mes desde su apertura", () => {
    expect(dueDateFor(at("2026-11-04")).toISOString().slice(0, 10)).toBe("2026-12-04");
  });

  it("cada mes de atraso se cuenta desde el vencimiento original, sin arrastrar el recorte de días", () => {
    const due = at("2027-01-31");
    expect(surchargeDate(due, 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(surchargeDate(due, 2).toISOString().slice(0, 10)).toBe("2027-03-31");
  });
});

describe("accountBalance", () => {
  it("una ficha sin movimientos debe cero", () => {
    expect(accountBalance(none).toFixed(2)).toBe("0.00");
  });

  it("suma las ventas y resta los pagos", () => {
    const balance = accountBalance({
      sales: [sale("1000.50", "2026-01-05"), sale("500", "2026-01-10")],
      payments: [payment("300.25", "2026-01-12")],
      surcharges: [],
    });
    expect(balance.toFixed(2)).toBe("1200.25");
  });

  it("no cuenta las ventas anuladas", () => {
    const balance = accountBalance({ ...none, sales: [sale(1000, "2026-01-05"), sale(400, "2026-01-06", "2026-01-07")] });
    expect(balance.toFixed(2)).toBe("1000.00");
  });

  it("suma los recargos registrados", () => {
    const balance = accountBalance({
      sales: [sale(1000, "2026-01-05")],
      payments: [],
      surcharges: [{ monthNumber: 1, amount: D("50") }, { monthNumber: 2, amount: D("50") }],
    });
    expect(balance.toFixed(2)).toBe("1100.00");
  });

  it("no pierde centavos con importes decimales", () => {
    const balance = accountBalance({ ...none, sales: [sale("0.10", "2026-01-05"), sale("0.20", "2026-01-05")] });
    expect(balance.toFixed(2)).toBe("0.30");
  });
});

describe("capitalPendingAt", () => {
  const due = at("2026-02-05");

  it("no cuenta ventas posteriores a la fecha", () => {
    const m = { ...none, sales: [sale(1000, "2026-01-05"), sale(700, "2026-02-10")] };
    expect(capitalPendingAt(at("2026-02-05"), due, m).toFixed(2)).toBe("1000.00");
    expect(capitalPendingAt(at("2026-02-10"), due, m).toFixed(2)).toBe("1700.00");
  });

  it("una venta anulada después de la fecha cuenta; una anulada antes, no", () => {
    const m = { ...none, sales: [sale(1000, "2026-01-05", "2026-02-20"), sale(400, "2026-01-06", "2026-01-20")] };
    expect(capitalPendingAt(at("2026-02-05"), due, m).toFixed(2)).toBe("1000.00");
    expect(capitalPendingAt(at("2026-03-05"), due, m).toFixed(2)).toBe("0.00");
  });

  it("los pagos posteriores a la fecha no la modifican", () => {
    const m = { ...none, sales: [sale(1000, "2026-01-05")], payments: [payment(400, "2026-02-10")] };
    expect(capitalPendingAt(at("2026-02-05"), due, m).toFixed(2)).toBe("1000.00");
    expect(capitalPendingAt(at("2026-02-10"), due, m).toFixed(2)).toBe("600.00");
  });

  it("los pagos cubren primero los recargos que ya correspondían y después el capital", () => {
    const m: AccountMovements = {
      sales: [sale(1000, "2026-01-05")],
      payments: [payment(80, "2026-03-06")],
      surcharges: [{ monthNumber: 1, amount: D(50) }], // le corresponde desde el 5/3
    };
    // 80 de pago: 50 cubren el recargo y 30 el capital
    expect(capitalPendingAt(at("2026-03-10"), due, m).toFixed(2)).toBe("970.00");
  });

  it("un recargo que todavía no correspondía a esa fecha no absorbe pagos", () => {
    const m: AccountMovements = {
      sales: [sale(1000, "2026-01-05")],
      payments: [payment(80, "2026-02-20")],
      surcharges: [{ monthNumber: 1, amount: D(50) }], // le corresponde desde el 5/3, recién después
    };
    expect(capitalPendingAt(at("2026-02-25"), due, m).toFixed(2)).toBe("920.00");
  });

  it("nunca es negativo", () => {
    const m = { ...none, sales: [sale(100, "2026-01-05")], payments: [payment(500, "2026-01-06")] };
    expect(capitalPendingAt(at("2026-02-05"), due, m).toFixed(2)).toBe("0.00");
  });
});

describe("monthsOverdue", () => {
  const due = at("2026-02-05");

  it("antes del vencimiento, o justo en él, no hay meses de atraso", () => {
    expect(monthsOverdue(due, at("2026-01-20"))).toBe(0);
    expect(monthsOverdue(due, due)).toBe(0);
  });

  it("un mes cuenta recién cuando se completa", () => {
    expect(monthsOverdue(due, new Date(surchargeDate(due, 1).getTime() - 1))).toBe(0);
    expect(monthsOverdue(due, surchargeDate(due, 1))).toBe(1);
    expect(monthsOverdue(due, at("2026-05-04"))).toBe(2);
    expect(monthsOverdue(due, at("2026-05-05"))).toBe(3);
  });

  it("con vencimiento a fin de mes, cuenta bien los meses cortos", () => {
    const endOfMonth = at("2027-01-31");
    expect(monthsOverdue(endOfMonth, at("2027-02-27"))).toBe(0);
    expect(monthsOverdue(endOfMonth, at("2027-02-28"))).toBe(1);
    expect(monthsOverdue(endOfMonth, at("2027-03-30"))).toBe(1);
    expect(monthsOverdue(endOfMonth, at("2027-03-31"))).toBe(2);
  });
});

describe("computeDueSurcharges", () => {
  const due = at("2026-02-05");
  const run = (now: string, movements: AccountMovements, percent: number | string = 5) =>
    computeDueSurcharges({ dueDate: due, now: at(now), percent: D(percent), movements });
  const view = (list: ReturnType<typeof run>) => list.map((s) => [s.monthNumber, s.base.toFixed(2), s.amount.toFixed(2)]);

  it("no hay recargo antes de completar el primer mes de atraso", () => {
    expect(run("2026-03-04", { ...none, sales: [sale(10000, "2026-01-05")] })).toEqual([]);
  });

  it("un mes de atraso: 5% del saldo pendiente al vencimiento, con el porcentaje usado y la fecha en que corresponde", () => {
    const result = run("2026-03-05", { ...none, sales: [sale(10000, "2026-01-05")] });

    expect(view(result)).toEqual([[1, "10000.00", "500.00"]]);
    expect(result[0].percent.toFixed(2)).toBe("5.00");
    expect(result[0].chargedOn.toISOString().slice(0, 10)).toBe("2026-03-05");
  });

  it("sin capitalizar: el recargo del primer mes no genera recargo en el segundo", () => {
    const result = run("2026-04-05", { ...none, sales: [sale(10000, "2026-01-05")] });

    expect(view(result)).toEqual([[1, "10000.00", "500.00"], [2, "10000.00", "500.00"]]);
  });

  it("un pago parcial antes del vencimiento reduce la base", () => {
    const result = run("2026-03-05", { ...none, sales: [sale(10000, "2026-01-05")], payments: [payment(4000, "2026-01-20")] });

    expect(view(result)).toEqual([[1, "6000.00", "300.00"]]);
  });

  it("un pago posterior al vencimiento no baja el recargo del primer mes, pero sí el de los siguientes", () => {
    const result = run("2026-04-05", {
      ...none,
      sales: [sale(10000, "2026-01-05")],
      payments: [payment(3000, "2026-02-15")],
    });

    // mes 1: base al vencimiento (10000). mes 2: 3000 pagados, de los cuales 500 cubren el recargo del mes 1 y 2500 el capital.
    expect(view(result)).toEqual([[1, "10000.00", "500.00"], [2, "7500.00", "375.00"]]);
  });

  it("si lo debido se pagó antes del vencimiento, no hay recargo", () => {
    expect(run("2026-06-05", { ...none, sales: [sale(10000, "2026-01-05")], payments: [payment(10000, "2026-01-30")] })).toEqual([]);
  });

  it("una venta agregada después del vencimiento entra en la base de los meses que empiezan después", () => {
    const result = run("2026-04-05", { ...none, sales: [sale(10000, "2026-01-05"), sale(2000, "2026-02-20")] });

    expect(view(result)).toEqual([[1, "10000.00", "500.00"], [2, "12000.00", "600.00"]]);
  });

  it("una venta anulada antes del vencimiento no entra en la base", () => {
    const result = run("2026-03-05", { ...none, sales: [sale(10000, "2026-01-05"), sale(4000, "2026-01-06", "2026-01-10")] });

    expect(view(result)).toEqual([[1, "10000.00", "500.00"]]);
  });

  it("no repite ni recalcula los recargos ya registrados: solo agrega los que faltan", () => {
    const result = run("2026-04-05", {
      ...none,
      sales: [sale(10000, "2026-01-05")],
      surcharges: [{ monthNumber: 1, amount: D("123.45") }], // registrado con otro criterio: se respeta tal cual
    });

    expect(view(result)).toEqual([[2, "10000.00", "500.00"]]);
  });

  it("si ya están todos registrados, no devuelve nada", () => {
    const result = run("2026-03-05", {
      ...none,
      sales: [sale(10000, "2026-01-05")],
      surcharges: [{ monthNumber: 1, amount: D(500) }],
    });

    expect(result).toEqual([]);
  });

  it.each([
    ["333.33", "5", "16.67"], // 16.6665 se redondea hacia arriba
    ["0.10", "5", "0.01"], // 0.005 se redondea hacia arriba
    ["100", "7.5", "7.50"],
    ["1234.56", "5", "61.73"], // 61.728
  ])("redondea a centavos: base %s al %s%% = %s", (base, percent, expected) => {
    const result = run("2026-03-05", { ...none, sales: [sale(base, "2026-01-05")] }, percent);

    expect(result[0].amount.toFixed(2)).toBe(expected);
  });

  it("con porcentaje 0 no hay recargos", () => {
    expect(run("2026-06-05", { ...none, sales: [sale(10000, "2026-01-05")] }, 0)).toEqual([]);
  });

  it("devuelve los meses en orden y numerados desde 1", () => {
    const result = run("2026-06-05", { ...none, sales: [sale(1000, "2026-01-05")] });

    expect(result.map((s) => s.monthNumber)).toEqual([1, 2, 3, 4]);
  });
});
