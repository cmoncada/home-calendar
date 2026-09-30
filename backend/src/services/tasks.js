import { query } from '../db.js';
import { addDays } from './dates.js';
import { expandOccurrences } from './recurrence.js';

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

export function serializeTask(task, assigneeIds = []) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    categoryId: task.category_id,
    color: task.color,
    startDate: task.start_date,
    startTime: task.start_time ? task.start_time.slice(0, 5) : null,
    durationValue: task.duration_value,
    durationUnit: task.duration_unit,
    recurrenceType: task.recurrence_type,
    recurrenceDays: task.recurrence_days ?? [],
    recurrenceInterval: task.recurrence_interval,
    recurrenceUntil: task.recurrence_until,
    assignees: assigneeIds,
    createdBy: task.created_by,
  };
}

export async function getTask(id) {
  const [task] = await query('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) return null;
  const rows = await query('SELECT user_id FROM task_assignees WHERE task_id = ?', [id]);
  return serializeTask(task, rows.map((r) => r.user_id));
}

/**
 * Devuelve todas las ocurrencias en [from, to], ordenadas por fecha y hora,
 * con la tarea, sus asignados y el estado de completado.
 */
export async function occurrencesInRange(from, to, { userId } = {}) {
  // La duración máxima es 365 días, así que una tarea única que empezó hace más no puede solaparse.
  const tasks = await query(
    `SELECT * FROM tasks
      WHERE start_date <= ?
        AND (recurrence_type <> 'none' OR start_date >= ?)
        AND (recurrence_until IS NULL OR recurrence_until >= ?)`,
    [to, addDays(from, -366), addDays(from, -366)],
  );
  if (!tasks.length) return [];

  const ids = tasks.map((t) => t.id);
  const [assignees, completions, exceptions] = await Promise.all([
    query('SELECT task_id, user_id FROM task_assignees WHERE task_id IN (?)', [ids]),
    query(
      `SELECT task_id, occurrence_date, completed_by, completed_at FROM task_completions
        WHERE task_id IN (?) AND occurrence_date BETWEEN ? AND ?`,
      [ids, addDays(from, -366), to],
    ),
    query('SELECT task_id, occurrence_date FROM task_exceptions WHERE task_id IN (?)', [ids]),
  ]);
  const assigneesByTask = groupBy(assignees, 'task_id');
  const exceptionsByTask = groupBy(exceptions, 'task_id');
  const completionMap = new Map(completions.map((c) => [`${c.task_id}|${c.occurrence_date}`, c]));

  const result = [];
  for (const task of tasks) {
    const assigneeIds = (assigneesByTask.get(task.id) ?? []).map((a) => a.user_id);
    if (userId && !assigneeIds.includes(userId)) continue;
    const skip = new Set((exceptionsByTask.get(task.id) ?? []).map((e) => e.occurrence_date));
    const serialized = serializeTask(task, assigneeIds);
    for (const occ of expandOccurrences(task, from, to, skip)) {
      const done = completionMap.get(`${task.id}|${occ.date}`);
      result.push({
        ...occ,
        task: serialized,
        completed: Boolean(done),
        completedBy: done?.completed_by ?? null,
        completedAt: done?.completed_at ?? null,
      });
    }
  }
  result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.task.title.localeCompare(b.task.title),
  );
  return result;
}
