import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { pool, waitForDb } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { MEDIA_PREFIX, PRESETS_DIR } from './services/avatars.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import adminRoutes from './routes/admin.js';
import displayRoutes from './routes/display.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: false, // la API solo devuelve JSON e imágenes; el HTML lo sirve Nginx/Vite
    hsts: config.cookieSecure, // solo tiene sentido detrás de HTTPS
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const staticOpts = { maxAge: '7d', fallthrough: false };
app.use(`${MEDIA_PREFIX}/avatars`, express.static(PRESETS_DIR, staticOpts));
app.use(`${MEDIA_PREFIX}/uploads`, express.static(config.uploadsDir, staticOpts));

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api', authRoutes, userRoutes, taskRoutes, adminRoutes, displayRoutes);
app.use(notFound);
app.use(errorHandler);

await waitForDb();
await migrate();
await seed();

const server = app.listen(config.port, () => {
  console.log(`Home Calendar API escuchando en :${config.port} (TZ ${config.tz})`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}
