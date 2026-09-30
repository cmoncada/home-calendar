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
  // Nº de proxies delante de la API: 1 = solo el Nginx del contenedor web;
  // 2 si además hay un reverse proxy con HTTPS (Nginx Proxy Manager, Caddy…)
  trustProxy: Number(env.TRUST_PROXY ?? 1),
};

/** En producción se niega a arrancar con secretos de ejemplo o inseguros. */
function validateProduction() {
  const problems = [];
  const placeholder = (v) => /CAMBIAR|changeme|dev-secret|dev_pass/i.test(v ?? '');
  if (config.jwtSecret.length < 32 || placeholder(config.jwtSecret)) {
    problems.push('JWT_SECRET debe tener al menos 32 caracteres aleatorios (genera uno con: openssl rand -hex 48)');
  }
  if (config.admin.password.length < 8 || placeholder(config.admin.password)) {
    problems.push('ADMIN_PASSWORD debe tener al menos 8 caracteres y no ser el valor de ejemplo');
  }
  if (placeholder(config.db.password)) problems.push('DB_PASSWORD sigue con el valor de ejemplo');
  try {
    new Intl.DateTimeFormat('en', { timeZone: config.tz });
  } catch {
    problems.push(`APP_TZ "${config.tz}" no es una zona horaria válida (ej. America/Bogota, Europe/Madrid)`);
  }
  if (problems.length) {
    throw new Error(`Configuración de producción inválida:\n  - ${problems.join('\n  - ')}`);
  }
}

if (isProd) validateProduction();
