#!/usr/bin/env bash
# Actualiza y (re)despliega la app en la VM de producción.
# Uso: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.prod ]]; then
  echo "Falta .env.prod (copia .env.prod.example y cambia los secretos)" >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

if [[ -d .git ]]; then
  git pull --ff-only
fi

"${COMPOSE[@]}" build --pull
"${COMPOSE[@]}" up -d --remove-orphans
docker image prune -f >/dev/null
"${COMPOSE[@]}" ps
