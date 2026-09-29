import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { hashToken, requireAuth, requireRole } from '../middleware/auth.js';
import { deleteUploadedAvatar, publicUser } from '../services/avatars.js';
import { colorSchema, idParam, nameSchema, passwordSchema } from '../validation.js';

const router = Router();
router.use('/admin', requireAuth, requireRole('admin'));

async function loadUser(id) {
  const [user] = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return user;
}

async function adminCount() {
  const [row] = await query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1");
  return row.n;
}

router.get('/admin/users', async (req, res) => {
  const users = await query(
    `SELECT u.*, (SELECT COUNT(*) FROM task_assignees a WHERE a.user_id = u.id) AS task_count
       FROM users u ORDER BY FIELD(u.role, 'admin', 'member', 'display'), u.name`,
  );
  res.json({
    users: users.map((u) => ({
      ...publicUser(u),
      isActive: Boolean(u.is_active),
      taskCount: u.task_count,
      createdAt: u.created_at,
    })),
  });
});

router.post('/admin/users', async (req, res) => {
  const data = z
    .object({
      name: nameSchema,
      password: passwordSchema,
      role: z.enum(['admin', 'member']).default('member'),
      avatar: z.string().default('avatar-01.svg'),
      color: colorSchema.default('#e50914'),
    })
    .parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const result = await query(
    `INSERT INTO users (name, password_hash, role, avatar_type, avatar_value, color)
     VALUES (?, ?, ?, 'preset', ?, ?)`,
    [data.name, hash, data.role, data.avatar, data.color],
  );
  res.status(201).json({ user: publicUser(await loadUser(result.insertId)) });
});

router.patch('/admin/users/:id', async (req, res) => {
  const user = await loadUser(idParam.parse(req.params.id));
  const data = z
    .object({
      name: nameSchema.optional(),
      role: z.enum(['admin', 'member']).optional(),
      isActive: z.boolean().optional(),
      password: passwordSchema.optional(),
      color: colorSchema.optional(),
    })
    .parse(req.body);

  if (user.role === 'display' && (data.role || data.password)) {
    throw new HttpError(400, 'El usuario de pantalla no tiene rol ni contraseña web');
  }
  const losingAdmin = user.role === 'admin' && (data.role === 'member' || data.isActive === false);
  if (losingAdmin && (await adminCount()) <= 1) {
    throw new HttpError(400, 'Debe quedar al menos un administrador activo');
  }

  const updates = {};
  if (data.name) updates.name = data.name;
  if (data.role) updates.role = data.role;
  if (data.color) updates.color = data.color;
  if (data.isActive !== undefined) updates.is_active = data.isActive ? 1 : 0;
  if (data.password) updates.password_hash = await bcrypt.hash(data.password, 12);
  if (Object.keys(updates).length) await query('UPDATE users SET ? WHERE id = ?', [updates, user.id]);
  res.json({ user: publicUser(await loadUser(user.id)) });
});

router.delete('/admin/users/:id', async (req, res) => {
  const user = await loadUser(idParam.parse(req.params.id));
  if (user.id === req.user.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  if (user.role === 'display') throw new HttpError(400, 'El usuario de pantalla no se puede eliminar');
  if (user.role === 'admin' && (await adminCount()) <= 1) {
    throw new HttpError(400, 'Debe quedar al menos un administrador');
  }
  await query('DELETE FROM users WHERE id = ?', [user.id]);
  await deleteUploadedAvatar(user);
  res.status(204).end();
});

router.get('/admin/display-tokens', async (req, res) => {
  const tokens = await query(
    `SELECT id, label, token_hint, last_used_at, created_at, revoked_at
       FROM display_tokens ORDER BY revoked_at IS NOT NULL, created_at DESC`,
  );
  res.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      label: t.label,
      hint: t.token_hint,
      lastUsedAt: t.last_used_at,
      createdAt: t.created_at,
      revokedAt: t.revoked_at,
    })),
  });
});

/** Genera un token para el ESP32. Se devuelve en claro solo esta vez. */
router.post('/admin/display-tokens', async (req, res) => {
  const { label } = z.object({ label: z.string().trim().min(1).max(80).default('ESP32') }).parse(req.body ?? {});
  const [display] = await query("SELECT id FROM users WHERE role = 'display' LIMIT 1");
  if (!display) throw new HttpError(500, 'No existe el usuario de pantalla');
  const token = `hc_${randomBytes(24).toString('base64url')}`;
  const result = await query(
    'INSERT INTO display_tokens (user_id, label, token_hash, token_hint) VALUES (?, ?, ?, ?)',
    [display.id, label, hashToken(token), token.slice(-4)],
  );
  res.status(201).json({ id: result.insertId, label, token });
});

router.delete('/admin/display-tokens/:id', async (req, res) => {
  await query('UPDATE display_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [
    idParam.parse(req.params.id),
  ]);
  res.status(204).end();
});

export default router;
