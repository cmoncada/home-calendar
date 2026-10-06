#!/usr/bin/env bash
# Copia de seguridad de la BD y de las fotos de perfil.
# Uso: ./scripts/backup-db.sh            (guarda en ./backups, conserva 14 días)
# Variables: BACKUP_DIR (destino), KEEP_DAYS (días que se conservan).
# Para programarlo cada semana: sudo ./scripts/install-backup-timer.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-14}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Evita dos backups a la vez (p. ej. uno manual mientras corre el programado): el segundo espera
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.lock"
  flock 9
fi
STAMP=$(date +%Y%m%d-%H%M%S)

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

# Las credenciales se leen del entorno del propio contenedor (no pasan por la línea de comandos del host)
"${COMPOSE[@]}" exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz.tmp"
mv "$BACKUP_DIR/db-$STAMP.sql.gz.tmp" "$BACKUP_DIR/db-$STAMP.sql.gz"

"${COMPOSE[@]}" exec -T backend tar -C /data -czf - uploads > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Backup completado: $BACKUP_DIR/{db,uploads}-$STAMP"
