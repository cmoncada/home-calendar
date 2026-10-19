import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireDisplayToken } from '../middleware/auth.js';
import { publicUser } from '../services/avatars.js';
import { nowInZone, weekday } from '../services/dates.js';
import { occurrencesInRange } from '../services/tasks.js';
import { dateSchema } from '../validation.js';

const router = Router();

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Resumen compacto del día para el ESP32 (pensado para ArduinoJson).
 * GET /api/display/today            Authorization: Bearer <token>
 * GET /api/display/today?date=YYYY-MM-DD
 */
router.get('/display/today', requireDisplayToken, async (req, res) => {
  const now = nowInZone(config.tz);
  const date = req.query.date ? dateSchema.parse(req.query.date) : now.date;
  const [occurrences, users, categories] = await Promise.all([
    occurrencesInRange(date, date),
    query("SELECT id, name FROM users WHERE role <> 'display'"),
    query('SELECT id, name FROM categories'),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const tasks = occurrences.map((o) => ({
    id: o.taskId,
    t: o.task.title,
    cat: categoryNames.get(o.task.categoryId) ?? null,
    time: o.date === date ? o.startTime : null,
    end: o.endTime,
    dur: `${o.task.durationValue}${o.task.durationUnit === 'hours' ? 'h' : 'd'}`,
    who: o.task.assignees.map((id) => names.get(id)).filter(Boolean),
    done: o.completed,
    color: o.task.color,
  }));

  res.set('Cache-Control', 'no-store').json({
    date,
    weekday: WEEKDAYS[weekday(date)],
    now: now.time,
    total: tasks.length,
    pending: tasks.filter((t) => !t.done).length,
    tasks,
  });
});

/**
 * Vista de televisor (/tv del frontend): el mismo día pero con más detalle
 * (avatares, colores, iconos de categoría). Mismo token que el ESP32; nunca incluye tareas privadas.
 * GET /api/display/day?date=YYYY-MM-DD      Authorization: Bearer <token>
 */
router.get('/display/day', requireDisplayToken, async (req, res) => {
  const now = nowInZone(config.tz);
  const date = req.query.date ? dateSchema.parse(req.query.date) : now.date;
  const [occurrences, users, categories] = await Promise.all([
    occurrencesInRange(date, date),
    query(
      `SELECT id, name, role, avatar_type, avatar_value, color FROM users
        WHERE is_active = 1 AND role <> 'display' ORDER BY name`,
    ),
    query('SELECT id, name, icon, color FROM categories ORDER BY sort_order, name'),
  ]);

  const tasks = occurrences.map((o) => ({
    id: o.taskId,
    title: o.task.title,
    categoryId: o.task.categoryId,
    color: o.task.color,
    date: o.date,
    endDate: o.endDate,
    startTime: o.date === date ? o.startTime : null,
    endTime: o.endTime,
    durationValue: o.task.durationValue,
    durationUnit: o.task.durationUnit,
    assignees: o.task.assignees,
    done: o.completed,
    completedBy: o.completedBy,
  }));

  res.set('Cache-Control', 'no-store').json({
    date,
    today: now.date,
    weekday: WEEKDAYS[weekday(date)],
    now: now.time,
    total: tasks.length,
    pending: tasks.filter((t) => !t.done).length,
    members: users.map((u) => {
      const { id, name, color, avatar } = publicUser(u);
      return { id, name, color, avatar };
    }),
    categories,
    tasks,
  });
});

export default router;
