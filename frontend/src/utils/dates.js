// Fechas de calendario como cadenas YYYY-MM-DD (aritmética en UTC para evitar saltos de horario).

const DAY_MS = 86_400_000;

export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Orden lunes→domingo con el índice JS (0 = domingo) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function parse(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function format(date) {
  return date.toISOString().slice(0, 10);
}

export function today() {
  const d = new Date();
  return format(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

export function addDays(str, n) {
  return format(new Date(parse(str).getTime() + n * DAY_MS));
}

export function addMonths(str, n) {
  const d = parse(str);
  return format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

export function startOfMonth(str) {
  return str.slice(0, 8) + '01';
}

export function endOfMonth(str) {
  const d = parse(str);
  return format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(str) {
  const day = parse(str).getUTCDay();
  return addDays(str, -((day + 6) % 7));
}

export function weekday(str) {
  return parse(str).getUTCDay();
}

export function dayOfMonth(str) {
  return parse(str).getUTCDate();
}

export function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const fmt = (opts) => new Intl.DateTimeFormat('es', { timeZone: 'UTC', ...opts });
const monthYearFmt = fmt({ month: 'long', year: 'numeric' });
const longFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = fmt({ day: 'numeric', month: 'short' });

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatMonthYear = (str) => capitalize(monthYearFmt.format(parse(str)));
export const formatLong = (str) => capitalize(longFmt.format(parse(str)));
export const formatShort = (str) => shortFmt.format(parse(str));

export function formatDuration(value, unit) {
  if (unit === 'days') return value === 1 ? '1 día' : `${value} días`;
  return value === 1 ? '1 hora' : `${value} horas`;
}

export function describeRecurrence(task) {
  if (task.recurrenceType === 'weekly') {
    const names = WEEK_ORDER.filter((d) => task.recurrenceDays.includes(d)).map((d) => WEEKDAY_NAMES[d].slice(0, 3));
    return `Cada semana: ${names.join(', ')}`;
  }
  if (task.recurrenceType === 'monthly') {
    return `Cada mes, día ${task.recurrenceDays.join(', ')}`;
  }
  return null;
}
