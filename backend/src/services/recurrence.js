import { addDays, daysInMonth, diffDays, maxDate, minDate, parseDate, weekday } from './dates.js';

const MAX_RANGE_DAYS = 400;

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Número de días de calendario que ocupa una ocurrencia (>= 1). */
export function spanDays(task) {
  const value = Math.max(1, Number(task.duration_value) || 1);
  if (task.duration_unit === 'days') return value;
  const start = task.start_time ? timeToMinutes(task.start_time) : 0;
  return Math.floor((start + value * 60 - 1) / 1440) + 1;
}

function isStartDay(task, date) {
  switch (task.recurrence_type) {
    case 'weekly':
      return task.recurrence_days.includes(weekday(date));
    case 'monthly': {
      const day = parseDate(date).getUTCDate();
      if (task.recurrence_days.includes(day)) return true;
      // Días que no existen en el mes (p. ej. 31 en abril) caen en el último día.
      const last = daysInMonth(date);
      return day === last && task.recurrence_days.some((d) => d > last);
    }
    default:
      return date === task.start_date;
  }
}

/**
 * Devuelve las ocurrencias de una tarea que se solapan con el rango [from, to] (inclusive).
 * @param task fila de `tasks` con recurrence_days ya parseado como array
 * @param exceptions Set de fechas (YYYY-MM-DD) de ocurrencias eliminadas
 */
export function expandOccurrences(task, from, to, exceptions = new Set()) {
  if (diffDays(from, to) > MAX_RANGE_DAYS) throw new RangeError('Rango de fechas demasiado grande');

  const span = spanDays(task);
  const recurring = task.recurrence_type !== 'none' && task.recurrence_days?.length > 0;
  const effective = recurring ? task : { ...task, recurrence_type: 'none' };

  let first = maxDate(task.start_date, addDays(from, -(span - 1)));
  let last = to;
  if (!recurring) last = minDate(last, task.start_date);
  if (task.recurrence_until) last = minDate(last, task.recurrence_until);

  const occurrences = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (!isStartDay(effective, date) || exceptions.has(date)) continue;
    const occurrence = {
      taskId: task.id,
      date,
      endDate: addDays(date, span - 1),
      startTime: task.start_time ? task.start_time.slice(0, 5) : null,
      endTime: null,
    };
    if (task.start_time && task.duration_unit === 'hours') {
      occurrence.endTime = minutesToTime(timeToMinutes(task.start_time) + task.duration_value * 60);
    }
    occurrences.push(occurrence);
  }
  return occurrences;
}
