import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { isPreset, listPresets, publicUser } from '../services/avatars.js';
import { colorSchema, nameSchema, passwordSchema } from '../validation.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos, espera unos minutos' },
});

/** Datos públicos para pintar la pantalla de perfiles. */
router.get('/profiles', async (req, res) => {
  const users = await query(
    `SELECT id, name, role, avatar_type, avatar_value, color FROM users
      WHERE is_active = 1 AND role <> 'display'
      ORDER BY role = 'admin', created_at`,
  );
  res.json({
    profiles: users.map(publicUser),
    allowRegistration: config.allowRegistration,
    presets: await listPresets(),
  });
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const { userId, password } = z
    .object({ userId: z.number().int().positive(), password: z.string().min(1) })
    .parse(req.body);
  const [user] = await query('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId]);
  const ok = user?.password_hash && user.role !== 'display' && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Contraseña incorrecta');
  setSessionCookie(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/auth/register', loginLimiter, async (req, res) => {
  if (!config.allowRegistration) throw new HttpError(403, 'El registro está deshabilitado');
  const data = z
    .object({
      name: nameSchema,
      password: passwordSchema,
      avatar: z.string().default('avatar-01.svg'),
      color: colorSchema.default('#e50914'),
    })
    .parse(req.body);
  if (!(await isPreset(data.avatar))) throw new HttpError(400, 'Avatar no válido');

  const hash = await bcrypt.hash(data.password, 12);
  const result = await query(
    `INSERT INTO users (name, password_hash, role, avatar_type, avatar_value, color)
     VALUES (?, ?, 'member', 'preset', ?, ?)`,
    [data.name, hash, data.avatar, data.color],
  ).catch((err) => {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe un perfil con ese nombre');
    throw err;
  });
  const [user] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  setSessionCookie(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
