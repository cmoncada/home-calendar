# Despliegue de Home Calendar en Proxmox

Guía paso a paso para instalar Home Calendar en una máquina virtual de Proxmox, mantenerla actualizada y hacer copias de seguridad.

> Proceso verificado de punta a punta en **linux/amd64** (la arquitectura de la VM):
> - generar la configuración;
> - comprobar el host;
> - desplegar;
> - hacer backup y restaurarlo;
> - redesplegar conservando los datos.

---

## 1. Cómo queda montado

```
                    VM Debian (Proxmox)
┌─────────────────────────────────────────────────────────┐
│  Docker Compose (proyecto "home-calendar")              │
│                                                         │
│  ┌──────────────┐   /api, /media  ┌─────────────────┐   │
│  │ web          │ ───────────────▶│ backend         │   │
│  │ Nginx + Vue  │                 │ Node.js 24 API  │   │
│  │ puerto 80 ◀──┼── navegador     └────────┬────────┘   │
│  └──────────────┘   y ESP32                │            │
│                                   ┌────────▼────────┐   │
│                                   │ db  MySQL 8.4   │   │
│                                   └─────────────────┘   │
│  Volúmenes: db_data (base de datos), uploads (fotos)    │
└─────────────────────────────────────────────────────────┘
```

- Solo se publica el puerto HTTP del contenedor `web` (80 por defecto). MySQL y la API no quedan expuestos.
- Las migraciones de base de datos se aplican solas al arrancar.
- El superusuario y el usuario "Pantalla" (ESP32) se crean automáticamente la primera vez.

---

## 2. Recursos de la VM

| Recurso | Mínimo | Recomendado |
|---|---|---|
| vCPU | 1 | **2** |
| RAM | 1.5 GB | **2 GB** |
| Disco | 10 GB | **20 GB** |

- **Consumo medido:** en reposo, unos 310 MB entre los tres contenedores:
  - MySQL: ~200 MB
  - Node: ~90 MB
  - Nginx: ~20 MB
- **Límites de memoria** en `docker-compose.prod.yml`:
  - MySQL: 640 MB
  - backend: 256 MB
  - Nginx: 64 MB
- **Por qué 2 GB:** lo que más consume es **compilar las imágenes** en cada despliegue.

### ⚠️ Importante: tipo de CPU

MySQL 8.4 y la librería de imágenes (`sharp`) necesitan una CPU **x86-64-v2**. El tipo de CPU antiguo de Proxmox (`kvm64`) **no** lo es, y MySQL no llegaría a arrancar.

En la VM, ve a **Hardware → Processors → Type** y elige **`host`** (recomendado) o **`x86-64-v2-AES`**. `scripts/check-host.sh` lo comprueba y avisa.

---

## 3. Crear la VM en Proxmox

Crea la VM con **Debian 13** (o 12), instalación mínima con **servidor SSH** y sin entorno gráfico.

### Desde la interfaz web

| Pestaña | Valor |
|---|---|
| General | Nombre `home-calendar`, marcar *Start at boot* |
| OS | ISO de Debian netinst, tipo Linux 6.x |
| System | *Qemu Agent* ✔, controlador SCSI **VirtIO SCSI single** |
| Disks | 20 GB, bus SCSI, *Discard* ✔ y *SSD emulation* ✔ si el almacenamiento es SSD |
| CPU | 2 cores, **Type: host** |
| Memory | 2048 MB, **desmarcar *Ballooning*** (a MySQL no le sienta bien que le quiten RAM) |
| Network | VirtIO, bridge `vmbr0` |

### O desde la consola del nodo

Ajusta el ID, el almacenamiento y el nombre de la ISO:

```bash
qm create 120 --name home-calendar --ostype l26 --onboot 1 \
  --cores 2 --cpu host --memory 2048 --balloon 0 \
  --scsihw virtio-scsi-single --scsi0 local-lvm:20,discard=on,ssd=1 \
  --net0 virtio,bridge=vmbr0 --agent enabled=1 \
  --ide2 local:iso/debian-13-amd64-netinst.iso,media=cdrom --boot 'order=scsi0;ide2'
```

**IP fija:** conviene que la VM tenga siempre la misma IP, porque el ESP32 la llevará escrita. Resérvala en tu router (DHCP estático) o configúrala en Debian.

---

## 4. Preparar Debian

Conéctate por SSH a la VM y ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y qemu-guest-agent git curl openssl avahi-daemon
sudo systemctl enable --now qemu-guest-agent

# Docker Engine + plugin Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

**Cierra la sesión SSH y vuelve a entrar** para que se aplique el grupo `docker`. Luego comprueba:

```bash
docker compose version
```

La hora del sistema no afecta a la app: la zona horaria se configura con `APP_TZ`.

---

## 5. Copiar el proyecto a la VM

Crea la carpeta de destino:

```bash
sudo mkdir -p /opt/home-calendar && sudo chown $USER: /opt/home-calendar
```

### Opción A: desde GitHub (recomendado)

El repositorio es público, así que no hace falta iniciar sesión ni configurar claves:

```bash
git clone https://github.com/cmoncada/home-calendar.git /opt/home-calendar
```

Con esta opción, `deploy.sh` hace `git pull` automáticamente en cada actualización.

> Los secretos nunca están en el repositorio: `.env.prod` se genera en la VM con `setup-env.sh` y está en `.gitignore`.

### Opción B: copiarlo desde el Mac con rsync

Desde la carpeta del proyecto en el Mac:

```bash
rsync -av --delete --exclude node_modules --exclude dist --exclude .env --exclude .env.prod --exclude backups --exclude backend/uploads ./ USUARIO@IP-DE-LA-VM:/opt/home-calendar/
```

Para actualizar, repite el mismo comando y luego ejecuta `deploy.sh`.

---

## 6. Configurar los secretos

En la VM:

```bash
cd /opt/home-calendar
./scripts/setup-env.sh
```

El script pregunta la zona horaria, el puerto, el nombre del superusuario y su contraseña (vacía = genera una). Después crea `.env.prod` con permisos `600`:
- contraseñas de MySQL y `JWT_SECRET` **aleatorias**, en hexadecimal (sin caracteres que Docker Compose pueda malinterpretar);
- no sobrescribe un `.env.prod` existente.

| Variable | Para qué sirve |
|---|---|
| `APP_TZ` | Zona horaria para "hoy", el ESP32 y las estadísticas (p. ej. `America/Bogota`) |
| `HTTP_PORT` | Puerto publicado en la VM (80 por defecto) |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Contraseñas de MySQL (generadas) |
| `JWT_SECRET` | Firma de las sesiones (generado, 96 caracteres) |
| `ADMIN_NAME`, `ADMIN_PASSWORD` | Superusuario que se crea **solo la primera vez** |
| `ALLOW_REGISTRATION` | `false` para que solo el admin pueda crear perfiles |
| `COOKIE_SECURE` | `true` solo si sirves la app por HTTPS (ver §10) |
| `TRUST_PROXY` | `1` sin proxy externo; `2` si hay un reverse proxy delante (ver §10) |

- **Validación al arrancar:** en producción la API **se niega a arrancar** si detecta secretos de ejemplo (`CAMBIAR`), un `JWT_SECRET` corto, una contraseña de admin de menos de 8 caracteres o una zona horaria inválida. Te dice exactamente qué corregir.
- **Contraseñas de MySQL:** cambiar `DB_PASSWORD` o `DB_ROOT_PASSWORD` **después** de la primera instalación no cambia las de MySQL, que se fijan al crear el volumen. Guarda bien el `.env.prod`.

---

## 7. Desplegar

```bash
./scripts/deploy.sh
```

Qué hace:

1. **`check-host.sh`** comprueba:
   - CPU x86-64-v2;
   - RAM y disco libre;
   - Docker y Compose, y acceso al daemon;
   - que `.env.prod` no tenga valores de ejemplo ni caracteres `$`;
   - que el puerto esté libre.
2. `git pull`, solo si el repositorio tiene una rama remota.
3. Compila las imágenes. La primera vez tarda unos minutos.
4. Arranca los servicios y **espera a que los tres estén sanos**. Si alguno falla, muestra sus logs.
5. Muestra la URL, por ejemplo `http://192.168.1.50`.

---

## 8. Primer uso

1. Abre `http://IP-DE-LA-VM` y entra con el superusuario.
2. Crea los perfiles del hogar con "＋ Añadir perfil" o desde **Administrar**.
3. **ESP32:** en **Administrar → Pantalla ESP32 → Generar token**, copia el token (solo se muestra una vez). El dispositivo consulta:
   ```
   GET http://IP-DE-LA-VM/api/display/today
   Authorization: Bearer <token>
   ```

---

### Nombre amigable en lugar de la IP

`avahi-daemon` (instalado en el paso 4) anuncia la VM en la red local por mDNS. Así la app se abre en **`http://NOMBRE-DE-LA-VM.local`** (por ejemplo `http://home-calendar.local`) en lugar de la IP.

- **Cambiar el nombre** (ejemplo: `calendario.local`):

  ```bash
  sudo hostnamectl set-hostname calendario && sudo systemctl restart avahi-daemon
  ```

- **Compatibilidad:**
  - funciona en Mac, iPhone, iPad y Windows 10/11;
  - en Android depende de la versión y del navegador: si no abre, usa la IP;
  - el ESP32 también acepta la dirección `.local` en su portal (la resuelve por mDNS); la IP sigue funcionando.
- **Comprobarlo** desde el Mac: `ping -c 1 home-calendar.local`.
- **Si ya instalaste la PWA con la IP**, bórrala y vuelve a añadirla desde la dirección `.local`: la sesión va ligada a la dirección.

---

## 9. Actualizar la aplicación

- **Opción A (git):** `./scripts/deploy.sh`
- **Opción B (rsync):** repite el `rsync` desde el Mac y después ejecuta `./scripts/deploy.sh --no-pull`.

Los datos (volúmenes `db_data` y `uploads`) se conservan. Las migraciones nuevas se aplican solas.

---

## 10. HTTPS y acceso desde fuera de casa (opcional)

Dentro de la red de casa la app funciona por HTTP sin cambios. Para usarla desde fuera:

- **Recomendado: VPN o túnel** (Tailscale, WireGuard o Cloudflare Tunnel). No hace falta abrir puertos en el router.
- **Reverse proxy con TLS** (Nginx Proxy Manager, Caddy, Traefik) apuntando a `http://IP-DE-LA-VM:80`. Después, en `.env.prod`:
  ```
  COOKIE_SECURE=true
  TRUST_PROXY=2
  ```
  Luego ejecuta `./scripts/deploy.sh`.
  - `TRUST_PROXY=2` hace que el límite de intentos de login use la IP real de cada persona y no la del proxy.
  - **No** pongas `COOKIE_SECURE=true` si sigues entrando por `http://`: las sesiones dejarían de funcionar.
  - El ESP32 puede seguir usando la IP local por HTTP.

**Instalar como app (PWA).** La app ya incluye manifest, iconos y service worker:

| Dispositivo | Cómo instalarla | Requisito |
|---|---|---|
| iPhone / iPad | Safari → Compartir → **Añadir a pantalla de inicio** | Funciona también por HTTP: se abre a pantalla completa con su icono |
| Android / Chrome / Edge | Menú → **Instalar app** | **HTTPS** |

- **El service worker solo funciona con HTTPS.** Con HTTP, Android y Chrome no ofrecen instalarla ni la abren sin conexión. Para eso usa una de las opciones anteriores con certificado (Tailscale, por ejemplo, da HTTPS con `tailscale serve`).
- **Las actualizaciones llegan solas.** Nginx sirve `sw.js` y `manifest.webmanifest` sin caché, así que cada `deploy.sh` se aplica en la siguiente apertura de la app.

---

## 11. Copias de seguridad

```bash
./scripts/backup-db.sh
```

- Guarda en `./backups/` la base de datos (`db-FECHA.sql.gz`) y las fotos (`uploads-FECHA.tar.gz`).
- Borra los backups de más de 14 días (configurable con `KEEP_DAYS`).
- Las contraseñas se leen dentro del contenedor, nunca en la línea de comandos.
- Si se lanzan dos a la vez (manual y programado), el segundo espera a que termine el primero.

### Backup semanal automático (recomendado)

Un solo comando deja programado el backup con un timer de systemd:

```bash
sudo ./scripts/install-backup-timer.sh
```

- Por defecto se ejecuta **cada domingo a las 3:00** y conserva **8 semanas** de copias.
- Si la VM estaba apagada a esa hora, el backup se hace en cuanto vuelve a arrancar.
- Se puede volver a ejecutar para cambiar la configuración; reemplaza la anterior.

| Opción | Para qué sirve | Por defecto |
|---|---|---|
| `--day lun…dom` | Día de la semana (también `mon…sun`) | `dom` |
| `--time HH:MM` | Hora (zona horaria de la VM) | `03:00` |
| `--keep-weeks N` | Semanas de copias que se conservan | `8` |
| `--dir /ruta` | Carpeta de destino, p. ej. un NAS montado | `./backups` |

Ejemplo: miércoles a las 22:30, conservando 12 semanas en un NAS:

```bash
sudo ./scripts/install-backup-timer.sh --day mie --time 22:30 --keep-weeks 12 --dir /mnt/nas/home-calendar
```

| Acción | Comando |
|---|---|
| Hacer un backup ahora (para probar) | `sudo ./scripts/install-backup-timer.sh --run-now` |
| Ver la próxima ejecución y los últimos logs | `sudo ./scripts/install-backup-timer.sh --status` |
| Logs completos | `journalctl -u home-calendar-backup.service` |
| Desinstalar (no borra los backups) | `sudo ./scripts/install-backup-timer.sh --uninstall` |

> El backup programado se ejecuta como el usuario dueño de la carpeta del proyecto (debe estar en el grupo `docker`, como en el paso 4), así que los ficheros quedan a su nombre y puedes restaurarlos sin `sudo`.

**Alternativa con cron** (si prefieres no usar systemd), por ejemplo cada domingo a las 3:00. Abre `crontab -e` y añade:

```
0 3 * * 0 KEEP_DAYS=56 /opt/home-calendar/scripts/backup-db.sh >> $HOME/home-calendar-backup.log 2>&1
```

**Restaurar** (reemplaza los datos actuales y pide confirmación):

```bash
./scripts/restore-db.sh backups/db-20261001-030000.sql.gz backups/uploads-20261001-030000.tar.gz
```

**Consejos:**
- Copia `./backups` fuera de la VM de vez en cuando (NAS, otro disco).
- Además, haz un backup de la VM completa desde Proxmox: **Datacenter → Backup**, o snapshots antes de actualizar.

---

## 12. Operación diaria

| Tarea | Comando (desde `/opt/home-calendar`) |
|---|---|
| Ver estado | `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` |
| Ver logs | `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend` |
| Reiniciar | `docker compose -f docker-compose.prod.yml --env-file .env.prod restart` |
| Parar | `docker compose -f docker-compose.prod.yml --env-file .env.prod down` (los datos se conservan) |
| Borrar solo las tareas | `docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend node src/scripts/db-clean.js tasks` |
| Reset total | `docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend node src/scripts/db-clean.js all` |
| Consumo | `docker stats --no-stream` |

- **Arranque automático:** los contenedores tienen `restart: unless-stopped`, así que arrancan solos cuando la VM se reinicia.
- **Contraseña olvidada:** otro administrador puede restablecerla desde **Administrar**. Si era la del único admin, usa el "Reset total" (borra todo) o pide ayuda para cambiarla directamente en la base de datos.

---

## 13. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `db` se reinicia en bucle; en los logs aparece `Fatal glibc error: CPU does not support x86-64-v2` | Tipo de CPU `kvm64` | Proxmox → VM → Processors → Type = `host`, y reinicia la VM |
| `backend` no queda sano; en los logs aparece `Configuración de producción inválida` | `.env.prod` con valores de ejemplo o inválidos | Corrige lo que indica el mensaje y ejecuta `./scripts/deploy.sh` |
| `Access denied for user 'home'` | Se cambió `DB_PASSWORD` después de crear la BD | Restaura el `.env.prod` original. Si no hay datos que conservar: `docker compose … down -v` (**borra todo**) y redespliega |
| `permission denied … docker.sock` | El usuario no está en el grupo `docker` | `sudo usermod -aG docker $USER` y vuelve a iniciar sesión |
| `port is already allocated` | El puerto 80 lo usa otro servicio | Cambia `HTTP_PORT` en `.env.prod` |
| Tras iniciar sesión se vuelve siempre a la pantalla de perfiles | `COOKIE_SECURE=true` accediendo por `http://` | Pon `COOKIE_SECURE=false` o entra por HTTPS |
| La compilación se corta o la VM se congela | Poca RAM | Sube la VM a 2 GB |
| El ESP32 recibe `401` | Token revocado o mal copiado | Genera un token nuevo en Administrar |
| "Hoy" no coincide con la fecha real | `APP_TZ` incorrecta | Corrige `APP_TZ` y redespliega |

---

## Lista de comprobación

- [ ] VM con CPU **host**, 2 vCPU, 2 GB RAM (sin ballooning), 20 GB de disco, IP fija
- [ ] Debian actualizado, `qemu-guest-agent`, Docker y usuario en el grupo `docker`
- [ ] Proyecto en `/opt/home-calendar`
- [ ] `./scripts/setup-env.sh` ejecutado y `.env.prod` guardado en un lugar seguro
- [ ] `./scripts/deploy.sh` terminado con "✔ Home Calendar desplegado"
- [ ] Login como admin y perfiles creados
- [ ] Backup semanal programado (`sudo ./scripts/install-backup-timer.sh`) y backup de la VM en Proxmox
- [ ] Token del ESP32 generado (cuando llegue el dispositivo)
