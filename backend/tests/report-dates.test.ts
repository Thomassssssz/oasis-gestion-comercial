import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isRealDay, localDate, startOfLocalDay } from "../src/helpers/report-dates.js";

describe("localDate (días de Argentina, UTC-3)", () => {
  it("una hora antes de las 03:00 UTC todavía es el día anterior", () => {
    expect(localDate(new Date("2026-11-05T02:59:59.999Z"))).toBe("2026-11-04");
    expect(localDate(new Date("2026-11-05T03:00:00.000Z"))).toBe("2026-11-05");
  });

  it("de mañana en UTC sigue siendo el mismo día local", () => {
    expect(localDate(new Date("2026-11-04T12:00:00.000Z"))).toBe("2026-11-04");
    expect(localDate(new Date("2026-11-04T03:00:00.000Z"))).toBe("2026-11-04");
  });

  it("cruza meses y años", () => {
    expect(localDate(new Date("2027-01-01T02:00:00.000Z"))).toBe("2026-12-31");
  });
});

describe("startOfLocalDay", () => {
  it("el día local empieza a las 03:00 UTC", () => {
    expect(startOfLocalDay("2026-11-04").toISOString()).toBe("2026-11-04T03:00:00.000Z");
  });
  it("es el inverso de localDate", () => {
    const start = startOfLocalDay("2026-03-15");
    expect(localDate(start)).toBe("2026-03-15");
    expect(localDate(new Date(start.getTime() - 1))).toBe("2026-03-14");
  });
});

describe("addDays", () => {
  it("suma y resta días cruzando meses, años y bisiestos", () => {
    expect(addDays("2026-11-04", 1)).toBe("2026-11-05");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-04", 0)).toBe("2026-11-04");
    expect(addDays("2026-11-04", -29)).toBe("2026-10-06");
  });
});

describe("daysBetween", () => {
  it("incluye los dos extremos", () => {
    expect(daysBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
  it("un solo día devuelve ese día", () => {
    expect(daysBetween("2026-11-04", "2026-11-04")).toEqual(["2026-11-04"]);
  });
  it("si el rango está al revés no devuelve nada", () => {
    expect(daysBetween("2026-11-05", "2026-11-04")).toEqual([]);
  });
});

describe("isRealDay", () => {
  it("acepta fechas reales", () => {
    expect(isRealDay("2026-11-04")).toBe(true);
    expect(isRealDay("2028-02-29")).toBe(true);
  });
  it("rechaza formato inválido y fechas que no existen", () => {
    for (const value of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-1", "26-11-04", "abc", "", "2026-11-04T10:00"]) {
      expect(isRealDay(value), value).toBe(false);
    }
  });
});
