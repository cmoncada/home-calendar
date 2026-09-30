// Limpia la base de datos.
//   node src/scripts/db-clean.js tasks [--yes]   Borra tareas y completados; mantiene usuarios y tokens.
//   node src/scripts/db-clean.js all   [--yes]   Borra TODO (tablas y fotos) y recrea Admin y Pantalla.
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { migrate } from '../migrate.js';
import { seed } from '../seed.js';

const mode = process.argv[2];
const skipConfirm = process.argv.includes('--yes');

if (!['tasks', 'all'].includes(mode)) {
  console.error('Uso: node src/scripts/db-clean.js <tasks|all> [--yes]');
  process.exit(1);
}

async function confirm(message) {
  if (skipConfirm) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${message}\nEscribe "si" para continuar: `);
  rl.close();
  return answer.trim().toLowerCase() === 'si';
}

async function cleanTasks() {
  const deleted = await withTransaction(async (conn) => {
    const counts = {};
    for (const table of ['task_completions', 'task_exceptions', 'task_assignees', 'tasks']) {
      const [result] = await conn.query(`DELETE FROM ${table}`);
      counts[table] = result.affectedRows;
    }
    return counts;
  });
  await pool.query('ALTER TABLE tasks AUTO_INCREMENT = 1');
  console.log('Tareas eliminadas:', deleted);
}

async function resetAll() {
  const conn = await pool.getConnection();
  try {
    const [tables] = await conn.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?',
      [config.db.database],
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { name } of tables) await conn.query('DROP TABLE ??', [name]);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`Tablas eliminadas: ${tables.map((t) => t.name).join(', ') || '(ninguna)'}`);
  } finally {
    conn.release();
  }

  const files = await readdir(config.uploadsDir).catch(() => []);
  await Promise.all(files.map((f) => rm(path.join(config.uploadsDir, f), { recursive: true, force: true })));
  console.log(`Fotos de perfil eliminadas: ${files.length}`);

  await migrate();
  await seed();
  console.log('Base de datos recreada con Admin y Pantalla.');
}

const target = `"${config.db.database}" en ${config.db.host}`;
const warning =
  mode === 'tasks'
    ? `Se borrarán TODAS las tareas y completados de ${target}. Los usuarios se mantienen.`
    : `Se borrará TODO en ${target}: usuarios, tareas, tokens y fotos. Solo quedarán Admin y Pantalla.`;

try {
  if (!(await confirm(warning))) {
    console.log('Cancelado.');
  } else if (mode === 'tasks') {
    await cleanTasks();
  } else {
    await resetAll();
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
