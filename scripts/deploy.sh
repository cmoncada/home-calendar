#!/usr/bin/env bash
# Instala o actualiza la app en la VM de producción.
# Uso: ./scripts/deploy.sh [--no-pull] [--skip-checks]
set -euo pipefail
cd "$(dirname "$0")/.."

NO_PULL=0; SKIP_CHECKS=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) NO_PULL=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 1 ;;
  esac
done

if ((SKIP_CHECKS)); then
  [[ -f .env.prod ]] || { echo "Falta .env.prod (ejecuta ./scripts/setup-env.sh)" >&2; exit 1; }
else
  ./scripts/check-host.sh
fi

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

# Actualizar el código solo si el repo tiene una rama remota configurada
if ((!NO_PULL)) && [[ -d .git ]] && git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  echo "Actualizando código (git pull)…"
  git pull --ff-only
else
  echo "Sin git pull (no hay rama remota o se pasó --no-pull); se despliega el código actual."
fi

echo "Construyendo imágenes…"
"${COMPOSE[@]}" build --pull

echo "Arrancando servicios…"
if ! "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 300; then
  echo "Algún servicio no quedó sano. Últimos logs:" >&2
  "${COMPOSE[@]}" logs --tail 40 db backend >&2
  exit 1
fi

docker image prune -f >/dev/null
"${COMPOSE[@]}" ps

port=$(grep -E '^HTTP_PORT=' .env.prod | cut -d= -f2)
ip=$( (hostname -I 2>/dev/null || true) | awk '{print $1}')
echo
echo "✔ Home Calendar desplegado en http://${ip:-IP-DE-LA-VM}${port:+:$port}" | sed 's/:80$//'
