# CLAUDE.md

Calendario de tareas del hogar. Backend Node.js 24 + Express 5 + MySQL 8.4, frontend Vue 3 + Vite + Pinia, todo con **pnpm** (workspace `backend` + `frontend`). Despliegue con Docker en una VM de Proxmox (`docs/despliegue-proxmox.md`).

## Comandos

- Dev (Mac, Docker): `docker compose -f docker-compose.dev.yml up -d` → app en http://localhost:5173 (Vite, proxy de `/api` y `/media` al backend :3000). El backend recarga con `node --watch`; las migraciones se aplican al arrancar.
- Tests (solo backend, `node:test`): `pnpm test`
- Build del frontend: `pnpm build`
- Limpiar BD de dev: `pnpm db:clean` (solo tareas) / `pnpm db:reset` (todo; recrea Admin y Pantalla). Ambos aceptan `--yes`.
- Login de dev: Admin / `admin12345` (de `.env` / defaults de `docker-compose.dev.yml`).
- Producción: `scripts/setup-env.sh`, `scripts/deploy.sh`, `scripts/backup-db.sh`, `scripts/install-backup-timer.sh` (backup semanal con systemd), `scripts/restore-db.sh`, `scripts/check-host.sh`.

Antes de dar algo por terminado: `pnpm test`, `pnpm build` y comprobarlo en el navegador (http://localhost:5173), incluido móvil (375 px) y **ambos temas** si toca UI.

## Convenciones

- **Idioma**: rutas de API y del frontend en **inglés** (`/api/tasks`, `/day/:date`, `/profiles/new`); textos de UI, comentarios, mensajes de error y commits en **español**.
- **CSS puro**: nada de Tailwind ni librerías de UI/gráficas (la gráfica del dashboard es SVG propio). Todos los colores son variables de `frontend/src/styles/tokens.css`, con paleta oscura (por defecto) y clara (`:root[data-theme='light']`). No escribir colores fijos en componentes; añadir un token para ambos temas.
- **BD**: cambios de esquema solo con una migración nueva numerada en `backend/migrations/NNN_nombre.sql` (nunca editar las aplicadas). Usar `query()` de `src/db.js` (`pool.query`, admite `IN (?)` con arrays) y `withTransaction`.
- **Validación** con zod (`backend/src/validation.js`); errores con `HttpError` → `{ error: "mensaje en español" }`.
- **Fechas** como cadenas `YYYY-MM-DD` con aritmética UTC (`backend/src/services/dates.js`, `frontend/src/utils/dates.js`). "Hoy" en el servidor = `nowInZone(config.tz)` (`APP_TZ`).
- Modales con `BaseModal.vue` (pila: Escape cierra solo el de arriba). En móvil (≤560 px) ocupan toda la pantalla.

## Reglas de negocio (no evidentes en el código)

- **Ocurrencias**: las tareas recurrentes (`weekly`, `monthly`, `interval` = cada N días) se expanden en el servidor con `expandOccurrences` (`services/recurrence.js`, con tests). Rango máximo 400 días; duración máx. 168 h / 365 días. Mensual con día 31 → último día de meses cortos.
- **Borrar** una ocurrencia: `DELETE /api/tasks/:id/occurrences/:date?scope=single|following`. `single` crea una excepción; `following` fija `recurrence_until` al día anterior (o borra la tarea si no queda ninguna anterior).
- **Permisos de edición/borrado**: creador, responsable o admin (`loadEditable` en `routes/tasks.js`; espejo en `auth.canEditTask`). Marcar como hecha: cualquiera que vea la tarea.
- **Tareas privadas**: solo las ve su creador (ni admin ni ESP32); para los demás son 404. Su único responsable es el creador. Se borran al eliminar al usuario. El dashboard las **cuenta** (`includePrivate`) pero nunca devuelve títulos.
- **Dashboard** (`/api/admin/stats`): "sin terminar" = no completada y `endDate < hoy`; "pendiente" = hoy o futura; cumplimiento = completadas / (completadas + sin terminar).
- **Usuarios especiales**: el superusuario y "Pantalla" (rol `display`, sin login web, accede por token Bearer a `/api/display/today`) se crean en `seed.js`. Debe quedar siempre al menos un admin activo.
- En producción la API se niega a arrancar con secretos de ejemplo (`config.js` → `validateProduction`).

## Pruebas manuales y datos

La BD de desarrollo contiene **datos reales del usuario** (perfiles como pepe y tom y sus tareas). Para probar, crear usuarios/tareas temporales con nombres obvios (p. ej. "PruebaX") vía API y **borrar solo esos** al terminar. No usar `db:clean`/`db:reset` sin pedir permiso.
