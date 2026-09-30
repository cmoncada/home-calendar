// Utilidades de fechas "de calendario" (YYYY-MM-DD) sin zona horaria.
// Internamente se usan fechas UTC a medianoche para que la aritmética sea exacta.

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return toDateString(parseDate(value)) === value;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(str, days) {
  return toDateString(new Date(parseDate(str).getTime() + days * DAY_MS));
}

export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/** 0 = domingo … 6 = sábado */
export function weekday(str) {
  return parseDate(str).getUTCDay();
}

export function daysInMonth(str) {
  const d = parseDate(str);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function maxDate(a, b) {
  return a > b ? a : b;
}

export function minDate(a, b) {
  return a < b ? a : b;
}

/** Fecha y hora actuales en la zona horaria configurada. */
export function nowInZone(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function startOfMonth(str) {
  return `${str.slice(0, 7)}-01`;
}

export function endOfMonth(str) {
  return `${str.slice(0, 7)}-${String(daysInMonth(str)).padStart(2, '0')}`;
}

export function startOfYear(str) {
  return `${str.slice(0, 4)}-01-01`;
}

export function endOfYear(str) {
  return `${str.slice(0, 4)}-12-31`;
}
