import { randomUUID } from 'node:crypto';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

export const PRESETS_DIR = new URL('../../public/avatars/', import.meta.url).pathname;
export const MEDIA_PREFIX = '/media';

let presetCache;

export async function listPresets() {
  presetCache ??= (await readdir(PRESETS_DIR)).filter((f) => f.endsWith('.svg')).sort();
  return presetCache;
}

export async function isPreset(name) {
  return (await listPresets()).includes(name);
}

export function avatarUrl(user) {
  return user.avatar_type === 'upload'
    ? `${MEDIA_PREFIX}/uploads/${user.avatar_value}`
    : `${MEDIA_PREFIX}/avatars/${user.avatar_value}`;
}

/** Normaliza la imagen subida a un WebP cuadrado de 256 px y devuelve el nombre del archivo. */
export async function saveUploadedAvatar(buffer) {
  await mkdir(config.uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await sharp(buffer)
    .rotate()
    .resize(256, 256, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(path.join(config.uploadsDir, filename));
  return filename;
}

export async function deleteUploadedAvatar(user) {
  if (user?.avatar_type !== 'upload') return;
  await unlink(path.join(config.uploadsDir, path.basename(user.avatar_value))).catch(() => {});
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    color: user.color,
    avatar: avatarUrl(user),
    avatarType: user.avatar_type,
    avatarValue: user.avatar_value,
  };
}
