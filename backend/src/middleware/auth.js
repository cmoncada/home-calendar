import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'hc_session';

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: `${config.sessionDays}d`,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionDays * 86_400_000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Requiere una sesión web válida de un usuario activo (admin o miembro). */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(new HttpError(401, 'Sesión no iniciada'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    clearSessionCookie(res);
    return next(new HttpError(401, 'Sesión expirada'));
  }
  const [user] = await query(
    `SELECT id, name, role, avatar_type, avatar_value, color, is_active
       FROM users WHERE id = ?`,
    [payload.sub],
  );
  if (!user || !user.is_active || user.role === 'display') {
    clearSessionCookie(res);
    return next(new HttpError(401, 'Usuario no disponible'));
  }
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return next(new HttpError(403, 'No tienes permisos'));
    next();
  };
}

/** Autenticación del dispositivo ESP32: `Authorization: Bearer <token>` o `?token=`. */
export async function requireDisplayToken(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : req.query.token;
  if (!token) return next(new HttpError(401, 'Token requerido'));
  const [row] = await query(
    `SELECT t.id, u.id AS user_id, u.name
       FROM display_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL AND u.is_active = 1`,
    [hashToken(String(token))],
  );
  if (!row) return next(new HttpError(401, 'Token inválido'));
  await query('UPDATE display_tokens SET last_used_at = NOW() WHERE id = ?', [row.id]);
  req.display = row;
  next();
}
