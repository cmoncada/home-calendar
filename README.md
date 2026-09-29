# Home Calendar

Calendario para organizar las tareas diarias del hogar.

- **Backend:** Node.js 24 + Express 5 + MySQL 8.4
- **Frontend:** Vue 3 + Vite + Pinia, **CSS puro** (sin frameworks)
- **Gestor de paquetes:** pnpm (workspace con `backend` y `frontend`)
- **Despliegue:** Docker Compose (desarrollo en el Mac y producción en una VM Proxmox)

## Funcionalidades

- **Login estilo Netflix:** pantalla "¿Quién va a organizar hoy?" con los perfiles; al elegir uno se pide su contraseña.
- **Perfiles:** nombre, contraseña de **mínimo 8 caracteres** y avatar (12 avatares incluidos o una foto propia, que se recorta a 256 px WebP). Se crean desde el tile "＋ Añadir perfil".
- **Tareas:** nombre, fecha, hora opcional ("todo el día"), duración en **horas o días**, color, notas y responsables (uno o varios miembros).
- **Recurrencia:** semanal (varios días de la semana) o mensual (varios días del mes; el 31 cae en el último día de los meses cortos), con fecha fin opcional. Se puede borrar una sola repetición.
- **Completar:** cada repetición se marca como hecha por separado y se guarda quién la completó.
- **Vistas:** mes, semana y día (con barra de progreso). Filtro "Solo mis tareas".
- **Superusuario (admin):** crea, desactiva o elimina usuarios, cambia roles, restablece contraseñas y gestiona los tokens del ESP32. Siempre queda al menos un administrador.
- **Usuario "Pantalla" (ESP32):** no aparece en el login y solo entra con un token de API.

## Desarrollo en el Mac

Necesitas Docker Desktop. Con pnpm solo hace falta para ejecutar los tests o compilar fuera de Docker.

```bash
cp .env.example .env
```

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Servicio | URL |
|---|---|
| App (Vite con recarga en caliente) | http://localhost:5173 |
| API | http://localhost:3000/api/health |
| MySQL | localhost:3306 (`home` / `home_dev_pass`) |
| Adminer (opcional) | `docker compose -f docker-compose.dev.yml --profile tools up` → http://localhost:8080 |

El superusuario se crea al arrancar con `ADMIN_NAME` / `ADMIN_PASSWORD` (en desarrollo, `Admin` / `admin12345`).

Tests y build:

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm build
```

Para borrar la base de datos de desarrollo: `docker compose -f docker-compose.dev.yml down -v`.

## Producción en Proxmox

### Recursos recomendados para la VM

| Recurso | Mínimo | Recomendado |
|---|---|---|
| vCPU | 1 | **2** |
| RAM | 1.5 GB | **2 GB** |
| Disco | 10 GB | **20 GB** |

En la prueba local del stack de producción, el consumo en reposo fue de ~200 MB (MySQL ~150 MB, Node ~40 MB, Nginx ~10 MB). Los límites de memoria de `docker-compose.prod.yml` son 640 MB para MySQL, 256 MB para el backend y 64 MB para Nginx. Con 2 GB queda margen para Debian, para compilar las imágenes (`docker build` es lo que más CPU/RAM consume) y para los backups.

Ajustes de la VM en Proxmox: tipo de CPU `host`, disco **VirtIO SCSI** (con `discard` si está sobre SSD/thin), red **VirtIO**, *ballooning* desactivado (MySQL no lleva bien que le quiten RAM) y *QEMU Guest Agent* activado.

### Pasos

1. Crea una VM con **Debian 12/13** (instalación mínima + SSH).
2. Instala Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
   ```bash
   sudo usermod -aG docker $USER
   ```
3. Copia el proyecto a la VM (por ejemplo en `/opt/home-calendar`) con `git clone` o `rsync`.
4. Configura los secretos:
   ```bash
   cp .env.prod.example .env.prod
   ```
   Edita `.env.prod` y cambia **todas** las contraseñas. Genera el `JWT_SECRET` con `openssl rand -hex 48`. Ajusta `APP_TZ` a tu zona horaria.
5. Despliega:
   ```bash
   ./scripts/deploy.sh
   ```
   La app queda en `http://IP-DE-LA-VM` (puerto configurable con `HTTP_PORT`).
6. Backups diarios (MySQL + fotos, se conservan 14 días en `./backups`):
   ```bash
   crontab -e
   ```
   ```
   0 3 * * * /opt/home-calendar/scripts/backup-db.sh >> /var/log/home-calendar-backup.log 2>&1
   ```
   Restaurar un backup:
   ```bash
   gunzip -c backups/db-FECHA.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
   ```

**HTTPS / acceso desde fuera de casa:** pon delante un reverse proxy con TLS (Nginx Proxy Manager, Caddy o Traefik, o un túnel como Tailscale/Cloudflare Tunnel) y luego cambia `COOKIE_SECURE=true` en `.env.prod`. Dentro de la LAN funciona tal cual por HTTP.

**Actualizar:** `./scripts/deploy.sh` (hace `git pull`, reconstruye y reinicia). Las migraciones de base de datos (`backend/migrations/*.sql`) se aplican solas al arrancar.

## ESP32

1. Entra como administrador → **Administrar** → *Pantalla ESP32* → **Generar token** (se muestra una sola vez).
2. El dispositivo consulta:

```
GET http://IP-DE-LA-VM/api/display/today
Authorization: Bearer hc_xxxxxxxx
```

Respuesta (compacta, pensada para ArduinoJson):

```json
{
  "date": "2026-09-30",
  "weekday": "Miércoles",
  "now": "18:31",
  "total": 2,
  "pending": 1,
  "tasks": [
    { "id": 1, "t": "Sacar la basura", "time": "20:00", "end": "21:00", "dur": "1h", "who": ["Ana"], "done": false, "color": "#e50914" }
  ]
}
```

Parámetro opcional `?date=YYYY-MM-DD`. Si el token se revoca, la API responde `401`.

Ejemplo mínimo con Arduino:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* URL = "http://192.168.1.50/api/display/today";
const char* TOKEN = "hc_xxxxxxxx";

void fetchToday() {
  HTTPClient http;
  http.begin(URL);
  http.addHeader("Authorization", String("Bearer ") + TOKEN);
  if (http.GET() == 200) {
    JsonDocument doc;
    deserializeJson(doc, http.getStream());
    for (JsonObject task : doc["tasks"].as<JsonArray>()) {
      Serial.printf("%s %s %s\n", task["done"] ? "[x]" : "[ ]", task["time"] | "--:--", task["t"].as<const char*>());
    }
  }
  http.end();
}
```

## Estructura

```
backend/            API Express
  src/routes/       auth, users, tasks (+ calendario), admin, display (ESP32)
  src/services/     recurrence.js (cálculo de repeticiones), tasks.js, avatars.js
  migrations/       SQL que se aplica al arrancar
  public/avatars/   avatares predefinidos
  tests/            node:test
frontend/           SPA Vue
  src/views/        Perfiles (login), Añadir perfil, Calendario, Día, Mi perfil, Admin
  src/components/   Grids de mes/semana, formulario de tareas, selector de avatar…
  src/styles/       tokens.css (colores y espacios) + base.css
  nginx.conf        Nginx de producción (SPA + proxy /api y /media)
docker/mysql/       my.cnf ajustado para poca RAM
scripts/            deploy.sh, backup-db.sh
```
