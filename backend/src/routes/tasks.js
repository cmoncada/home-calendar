import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { getTask, occurrencesInRange } from '../services/tasks.js';
import { expandOccurrences } from '../services/recurrence.js';
import { dateSchema, idParam, rangeSchema, taskSchema } from '../validation.js';

const router = Router();
router.use(['/calendar', '/tasks', '/categories'], requireAuth);

function toRow(data) {
  return {
    title: data.title,
    notes: data.notes,
    category_id: data.categoryId,
    color: data.color,
    start_date: data.startDate,
    start_time: data.startTime,
    duration_value: data.durationValue,
    duration_unit: data.durationUnit,
    recurrence_type: data.recurrenceType,
    recurrence_days: data.recurrenceDays.length ? JSON.stringify(data.recurrenceDays) : null,
    recurrence_interval: data.recurrenceInterval,
    recurrence_until: data.recurrenceUntil,
  };
}

async function validAssignees(ids) {
  if (!ids.length) return [];
  const rows = await query(
    "SELECT id FROM users WHERE id IN (?) AND is_active = 1 AND role <> 'display'",
    [ids],
  );
  if (rows.length !== new Set(ids).size) throw new HttpError(400, 'Algún usuario asignado no existe');
  return rows.map((r) => r.id);
}

async function setAssignees(conn, taskId, ids) {
  await conn.query('DELETE FROM task_assignees WHERE task_id = ?', [taskId]);
  if (ids.length) {
    await conn.query('INSERT INTO task_assignees (task_id, user_id) VALUES ?', [ids.map((u) => [taskId, u])]);
  }
}

async function validCategory(id) {
  if (id === null) return;
  const [row] = await query('SELECT id FROM categories WHERE id = ?', [id]);
  if (!row) throw new HttpError(400, 'La categoría no existe');
}

/** Solo el creador, un asignado o un admin pueden modificar la tarea. */
async function loadEditable(req) {
  const task = await getTask(idParam.parse(req.params.id));
  if (!task) throw new HttpError(404, 'Tarea no encontrada');
  const u = req.user;
  if (u.role !== 'admin' && task.createdBy !== u.id && !task.assignees.includes(u.id)) {
    throw new HttpError(403, 'Solo el creador, los asignados o un administrador pueden modificar esta tarea');
  }
  return task;
}

async function loadOccurrence(req) {
  const task = await getTask(idParam.parse(req.params.id));
  if (!task) throw new HttpError(404, 'Tarea no encontrada');
  const date = dateSchema.parse(req.params.date);
  const row = {
    ...task,
    start_date: task.startDate,
    start_time: task.startTime,
    duration_value: task.durationValue,
    duration_unit: task.durationUnit,
    recurrence_type: task.recurrenceType,
    recurrence_days: task.recurrenceDays,
    recurrence_interval: task.recurrenceInterval,
    recurrence_until: task.recurrenceUntil,
  };
  const exists = expandOccurrences(row, date, date).some((o) => o.date === date);
  if (!exists) throw new HttpError(400, 'La tarea no ocurre en esa fecha');
  return { task, date };
}

router.get('/categories', async (req, res) => {
  const categories = await query('SELECT id, name, icon, color FROM categories ORDER BY sort_order, name');
  res.json({ categories });
});

router.get('/calendar', async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const mine = req.query.mine === 'true';
  res.json({ occurrences: await occurrencesInRange(from, to, { userId: mine ? req.user.id : undefined }) });
});

router.get('/tasks/:id', async (req, res) => {
  const task = await getTask(idParam.parse(req.params.id));
  if (!task) throw new HttpError(404, 'Tarea no encontrada');
  res.json({ task });
});

router.post('/tasks', async (req, res) => {
  const data = taskSchema.parse(req.body);
  const assignees = await validAssignees(data.assignees);
  await validCategory(data.categoryId);
  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query('INSERT INTO tasks SET ?', [{ ...toRow(data), created_by: req.user.id }]);
    await setAssignees(conn, result.insertId, assignees);
    return result.insertId;
  });
  res.status(201).json({ task: await getTask(id) });
});

router.put('/tasks/:id', async (req, res) => {
  const task = await loadEditable(req);
  const data = taskSchema.parse(req.body);
  const assignees = await validAssignees(data.assignees);
  await validCategory(data.categoryId);
  await withTransaction(async (conn) => {
    await conn.query('UPDATE tasks SET ? WHERE id = ?', [toRow(data), task.id]);
    await setAssignees(conn, task.id, assignees);
  });
  res.json({ task: await getTask(task.id) });
});

router.delete('/tasks/:id', async (req, res) => {
  const task = await loadEditable(req);
  await query('DELETE FROM tasks WHERE id = ?', [task.id]);
  res.status(204).end();
});

/** Elimina una sola ocurrencia de una tarea recurrente. */
router.delete('/tasks/:id/occurrences/:date', async (req, res) => {
  await loadEditable(req);
  const { task, date } = await loadOccurrence(req);
  if (task.recurrenceType === 'none') {
    await query('DELETE FROM tasks WHERE id = ?', [task.id]);
  } else {
    await query('INSERT IGNORE INTO task_exceptions (task_id, occurrence_date) VALUES (?, ?)', [task.id, date]);
  }
  res.status(204).end();
});

router.post('/tasks/:id/complete/:date', async (req, res) => {
  const { task, date } = await loadOccurrence(req);
  await query(
    `INSERT INTO task_completions (task_id, occurrence_date, completed_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE completed_by = VALUES(completed_by), completed_at = NOW()`,
    [task.id, date, req.user.id],
  );
  res.status(204).end();
});

router.delete('/tasks/:id/complete/:date', async (req, res) => {
  const { task, date } = await loadOccurrence(req);
  await query('DELETE FROM task_completions WHERE task_id = ? AND occurrence_date = ?', [task.id, date]);
  res.status(204).end();
});

export default router;
