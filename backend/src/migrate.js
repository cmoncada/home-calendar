import { readdir, readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { config } from './config.js';

const migrationsDir = new URL('../migrations/', import.meta.url);

/** Aplica en orden los archivos migrations/*.sql que aún no se hayan ejecutado. */
export async function migrate() {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(new URL(file, migrationsDir), 'utf8');
      console.log(`Aplicando migración ${file}`);
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    }
  } finally {
    await conn.end();
  }
}
