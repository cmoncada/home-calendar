#!/usr/bin/env bash
# Copia de seguridad de la BD y de las fotos de perfil.
# Uso: ./scripts/backup-db.sh            (guarda en ./backups, conserva 14 días)
# Cron diario a las 3:00:
#   0 3 * * * /opt/home-calendar/scripts/backup-db.sh >> $HOME/home-calendar-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

# Las credenciales se leen del entorno del propio contenedor (no pasan por la línea de comandos del host)
"${COMPOSE[@]}" exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz.tmp"
mv "$BACKUP_DIR/db-$STAMP.sql.gz.tmp" "$BACKUP_DIR/db-$STAMP.sql.gz"

"${COMPOSE[@]}" exec -T backend tar -C /data -czf - uploads > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Backup completado: $BACKUP_DIR/{db,uploads}-$STAMP"
