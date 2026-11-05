// Fechas de los reportes. El comercio está en Formosa (Argentina), que usa UTC-3 todo el año (no hay horario de verano).
// Los días de un reporte son días locales: una venta hecha a las 22:00 del 4/11 (hora de Argentina) cuenta para el 4/11,
// aunque en UTC ya sea el 5/11. Son funciones puras: no tocan la base.

export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

// "2026-11-04" para el día local en que cae esa fecha.
export const localDate = (date: Date): string => dayFormat.format(date);

// Instante en que empieza ese día local (00:00 hora de Argentina).
export const startOfLocalDay = (day: string): Date => new Date(`${day}T00:00:00${OFFSET}`);

// Suma días a un día "YYYY-MM-DD" (puede ser negativo).
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Todos los días entre `from` y `to`, ambos incluidos.
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

// ¿Es una fecha real? ("2026-02-30" tiene el formato pero no existe.)
export function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  // Un mes 13 da fecha inválida (toISOString lanzaría un error) y un 30 de febrero se corre a marzo: en ambos casos no es real.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
