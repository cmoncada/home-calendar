import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { query } from './db.js';

/** Crea el superusuario y el usuario de pantalla si no existen (idempotente). */
export async function seed() {
  const [admin] = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const hash = await bcrypt.hash(config.admin.password, 12);
    await query(
      `INSERT INTO users (name, password_hash, role, avatar_value, color)
       VALUES (?, ?, 'admin', 'avatar-01.svg', '#e50914')`,
      [config.admin.name, hash],
    );
    console.log(`Superusuario "${config.admin.name}" creado`);
  }

  const [display] = await query("SELECT id FROM users WHERE role = 'display' LIMIT 1");
  if (!display) {
    await query(
      `INSERT INTO users (name, password_hash, role, avatar_value, color)
       VALUES (?, NULL, 'display', 'avatar-12.svg', '#5a5a5a')`,
      [config.displayName],
    );
    console.log(`Usuario de pantalla "${config.displayName}" creado`);
  }
}
