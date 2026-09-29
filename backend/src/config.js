const env = process.env;

function required(name, fallback) {
  const value = env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

const isProd = env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(env.PORT ?? 3000),
  tz: env.APP_TZ ?? 'America/Bogota',
  db: {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    database: required('DB_NAME', 'home_calendar'),
    user: required('DB_USER', 'home'),
    password: required('DB_PASSWORD', isProd ? undefined : 'home_dev_pass'),
  },
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-secret'),
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  cookieSecure: env.COOKIE_SECURE === 'true',
  admin: {
    name: required('ADMIN_NAME', 'Admin'),
    password: required('ADMIN_PASSWORD', isProd ? undefined : 'admin12345'),
  },
  displayName: env.DISPLAY_NAME ?? 'Pantalla',
  allowRegistration: env.ALLOW_REGISTRATION !== 'false',
  uploadsDir: env.UPLOADS_DIR ?? new URL('../uploads', import.meta.url).pathname,
};
