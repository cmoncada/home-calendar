import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteUploadedAvatar, isPreset, publicUser, saveUploadedAvatar } from '../services/avatars.js';
import { colorSchema, nameSchema, passwordSchema } from '../validation.js';

const router = Router();
router.use('/users', requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new HttpError(400, 'Formato no permitido (usa JPG, PNG o WebP)'), ok);
  },
});

async function loadUser(id) {
  const [user] = await query('SELECT * FROM users WHERE id = ?', [id]);
  return user;
}

/** Miembros del hogar a los que se pueden asignar tareas. */
router.get('/users', async (req, res) => {
  const users = await query(
    `SELECT id, name, role, avatar_type, avatar_value, color FROM users
      WHERE is_active = 1 AND role <> 'display' ORDER BY name`,
  );
  res.json({ users: users.map(publicUser) });
});

router.patch('/users/me', async (req, res) => {
  const data = z
    .object({
      name: nameSchema.optional(),
      color: colorSchema.optional(),
      avatar: z.string().optional(),
      currentPassword: z.string().optional(),
      newPassword: passwordSchema.optional(),
    })
    .parse(req.body);

  const user = await loadUser(req.user.id);
  const updates = {};
  if (data.name) updates.name = data.name;
  if (data.color) updates.color = data.color;
  if (data.avatar) {
    if (!(await isPreset(data.avatar))) throw new HttpError(400, 'Avatar no válido');
    updates.avatar_type = 'preset';
    updates.avatar_value = data.avatar;
  }
  if (data.newPassword) {
    const ok = data.currentPassword && (await bcrypt.compare(data.currentPassword, user.password_hash));
    if (!ok) throw new HttpError(400, 'La contraseña actual no es correcta');
    updates.password_hash = await bcrypt.hash(data.newPassword, 12);
  }
  if (Object.keys(updates).length) {
    await query('UPDATE users SET ? WHERE id = ?', [updates, user.id]).catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe un perfil con ese nombre');
      throw err;
    });
    if (updates.avatar_type) await deleteUploadedAvatar(user);
  }
  res.json({ user: publicUser(await loadUser(user.id)) });
});

router.post('/users/me/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No se recibió ninguna imagen');
  const user = await loadUser(req.user.id);
  let filename;
  try {
    filename = await saveUploadedAvatar(req.file.buffer);
  } catch {
    throw new HttpError(400, 'No se pudo procesar la imagen');
  }
  await query("UPDATE users SET avatar_type = 'upload', avatar_value = ? WHERE id = ?", [filename, user.id]);
  await deleteUploadedAvatar(user);
  res.json({ user: publicUser(await loadUser(user.id)) });
});

export default router;
