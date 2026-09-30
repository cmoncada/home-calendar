#!/usr/bin/env bash
# Crea .env.prod con secretos aleatorios (solo caracteres hexadecimales, seguros para Docker Compose).
# Uso: ./scripts/setup-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.prod ]]; then
  echo ".env.prod ya existe; no se sobrescribe. Bórralo a mano si quieres regenerarlo." >&2
  echo "OJO: cambiar DB_PASSWORD o DB_ROOT_PASSWORD después de la primera instalación no cambia las de MySQL." >&2
  exit 1
fi

rand() { openssl rand -hex "$1"; }

read -r -p "Zona horaria [America/Bogota]: " TZ_INPUT
APP_TZ=${TZ_INPUT:-America/Bogota}
if [[ ! -e "/usr/share/zoneinfo/$APP_TZ" ]]; then
  echo "Aviso: no encuentro /usr/share/zoneinfo/$APP_TZ; revisa que el nombre sea correcto." >&2
fi

read -r -p "Puerto HTTP [80]: " PORT_INPUT
HTTP_PORT=${PORT_INPUT:-80}

read -r -p "Nombre del superusuario [Admin]: " ADMIN_INPUT
ADMIN_NAME=${ADMIN_INPUT:-Admin}

while true; do
  read -r -s -p "Contraseña del superusuario (mín. 8, vacío = generar una): " ADMIN_PASSWORD
  echo
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    ADMIN_PASSWORD=$(rand 6)
    echo "Contraseña generada para $ADMIN_NAME: $ADMIN_PASSWORD  (guárdala; podrás cambiarla en 'Mi perfil')"
    break
  fi
  if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
    echo "Debe tener al menos 8 caracteres." >&2
  elif [[ "$ADMIN_PASSWORD" == *'$'* || "$ADMIN_PASSWORD" == *'"'* || "$ADMIN_PASSWORD" == *"'"* ]]; then
    echo 'Evita los caracteres $ " y '"'"' (Docker Compose los interpreta).' >&2
  else
    break
  fi
done

umask 077
cat > .env.prod <<EOF
# Generado por scripts/setup-env.sh el $(date '+%Y-%m-%d %H:%M')
APP_TZ=$APP_TZ
HTTP_PORT=$HTTP_PORT

DB_NAME=home_calendar
DB_USER=home
DB_PASSWORD=$(rand 24)
DB_ROOT_PASSWORD=$(rand 24)

JWT_SECRET=$(rand 48)

ADMIN_NAME=$ADMIN_NAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

DISPLAY_NAME=Pantalla
ALLOW_REGISTRATION=true

# true solo si la app se sirve por HTTPS (reverse proxy con TLS delante)
COOKIE_SECURE=false
# 1 = acceso directo; 2 si hay un reverse proxy (Nginx Proxy Manager, Caddy…) delante
TRUST_PROXY=1
EOF

echo ".env.prod creado (permisos 600)."
