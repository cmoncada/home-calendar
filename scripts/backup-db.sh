#!/usr/bin/env bash
# Copia de seguridad de la BD y de las fotos de perfil.
# Uso: ./scripts/backup-db.sh            (guarda en ./backups, conserva 14 días)
# Cron diario a las 3:00:
#   0 3 * * * /opt/home-calendar/scripts/backup-db.sh >> /var/log/home-calendar-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env.prod; set +a
BACKUP_DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

"${COMPOSE[@]}" exec -T -e MYSQL_PWD="$DB_ROOT_PASSWORD" db \
  mysqldump -u root --single-transaction --routines --triggers "$DB_NAME" \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

"${COMPOSE[@]}" exec -T backend tar -C /data -czf - uploads > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup completado: $BACKUP_DIR/*-$STAMP.*"
