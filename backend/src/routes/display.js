import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireDisplayToken } from '../middleware/auth.js';
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
  const [occurrences, users] = await Promise.all([
    occurrencesInRange(date, date),
    query("SELECT id, name FROM users WHERE role <> 'display'"),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));

  const tasks = occurrences.map((o) => ({
    id: o.taskId,
    t: o.task.title,
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

export default router;
