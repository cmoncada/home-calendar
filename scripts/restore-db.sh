#!/usr/bin/env bash
# Restaura un backup creado por backup-db.sh (BORRA los datos actuales).
# Uso: ./scripts/restore-db.sh backups/db-20260101-030000.sql.gz [backups/uploads-20260101-030000.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."

DB_FILE=${1:?Uso: ./scripts/restore-db.sh <db-XXXX.sql.gz> [uploads-XXXX.tar.gz]}
UPLOADS_FILE=${2:-}
[[ -f "$DB_FILE" ]] || { echo "No existe $DB_FILE" >&2; exit 1; }
[[ -z "$UPLOADS_FILE" || -f "$UPLOADS_FILE" ]] || { echo "No existe $UPLOADS_FILE" >&2; exit 1; }

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

read -r -p "Se reemplazarán los datos actuales por $DB_FILE. Escribe \"si\" para continuar: " answer
[[ "$answer" == "si" ]] || { echo "Cancelado."; exit 0; }

echo "Restaurando base de datos…"
gunzip -c "$DB_FILE" | "${COMPOSE[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$MYSQL_DATABASE"'

if [[ -n "$UPLOADS_FILE" ]]; then
  echo "Restaurando fotos de perfil…"
  "${COMPOSE[@]}" exec -T backend sh -c 'rm -rf /data/uploads/* && tar -C /data -xzf -' < "$UPLOADS_FILE"
fi

"${COMPOSE[@]}" restart backend >/dev/null
echo "Restauración completada."
