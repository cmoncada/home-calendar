import { addDays, daysInMonth } from './dates.js';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function emptyCounts() {
  return { generated: 0, completed: 0, unfinished: 0, pending: 0 };
}

/**
 * completed: marcada como hecha.
 * unfinished: no hecha y ya terminó su plazo (endDate < hoy).
 * pending: no hecha y todavía en curso o futura.
 */
export function classify(occ, today) {
  if (occ.completed) return 'completed';
  return occ.endDate < today ? 'unfinished' : 'pending';
}

function add(counts, status) {
  counts.generated += 1;
  counts[status] += 1;
}

export function completionRate(counts) {
  const due = counts.completed + counts.unfinished;
  return due ? Math.round((counts.completed / due) * 100) : null;
}

/** Cubos de la gráfica según el periodo: meses del año, días del mes o usuarios del día. */
function buildBuckets(period, from, users) {
  if (period === 'year') {
    const year = from.slice(0, 4);
    return MONTHS.map((label, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, label }));
  }
  if (period === 'month') {
    return Array.from({ length: daysInMonth(from) }, (_, i) => {
      const date = addDays(from, i);
      return { key: date, label: String(i + 1) };
    });
  }
  return [
    ...users.map((u) => ({ key: String(u.id), label: u.name })),
    { key: 'none', label: 'Sin asignar' },
  ];
}

function bucketKeys(period, occ) {
  if (period === 'year') return [occ.date.slice(0, 7)];
  if (period === 'month') return [occ.date];
  return occ.task.assignees.length ? occ.task.assignees.map(String) : ['none'];
}

/**
 * Agrega ocurrencias para el dashboard. Solo devuelve números (nunca títulos),
 * así que es seguro incluir tareas privadas.
 * @param occurrences salida de occurrencesInRange
 * @param opts { period: 'year'|'month'|'day', from, to, today, userId?, users: [{id, name}] }
 */
export function computeStats(occurrences, { period, from, to, today, userId = null, users = [] }) {
  // Solo cuentan las ocurrencias que empiezan dentro del periodo
  let list = occurrences.filter((o) => o.date >= from && o.date <= to);
  if (userId) list = list.filter((o) => o.task.assignees.includes(userId));

  const totals = emptyCounts();
  const buckets = buildBuckets(period, from, userId ? users.filter((u) => u.id === userId) : users);
  const byKey = new Map(buckets.map((b) => [b.key, { ...b, ...emptyCounts() }]));
  const byUser = new Map();

  for (const occ of list) {
    const status = classify(occ, today);
    add(totals, status);

    for (const key of bucketKeys(period, occ)) {
      if (userId && period === 'day' && key !== String(userId)) continue;
      const bucket = byKey.get(key);
      if (bucket) add(bucket, status);
    }

    const owners = occ.task.assignees.length ? occ.task.assignees : [null];
    for (const owner of owners) {
      if (userId && owner !== userId) continue;
      if (!byUser.has(owner)) byUser.set(owner, { userId: owner, ...emptyCounts() });
      add(byUser.get(owner), status);
    }
  }

  let series = [...byKey.values()];
  // En el modo día no tiene sentido mostrar "Sin asignar" vacío
  if (period === 'day') series = series.filter((s) => s.key !== 'none' || s.generated > 0);

  return {
    totals: { ...totals, completionRate: completionRate(totals) },
    series,
    byUser: [...byUser.values()]
      .map((u) => ({ ...u, completionRate: completionRate(u) }))
      .sort((a, b) => b.generated - a.generated),
  };
}
