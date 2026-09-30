#!/usr/bin/env bash
# Comprueba que la máquina (VM de Proxmox) puede ejecutar Home Calendar.
# Uso: ./scripts/check-host.sh      (lo ejecuta también deploy.sh)
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
ok()   { echo "  ✔ $*"; }
warn() { echo "  ! $*"; }
bad()  { echo "  ✘ $*"; fail=1; }

echo "Comprobando el host…"

# CPU: MySQL 8.4 (Oracle Linux 9) y sharp necesitan x86-64-v2 (SSE4.2, POPCNT…)
arch=$(uname -m)
if [[ "$arch" == "x86_64" ]]; then
  flags=$(grep -m1 '^flags' /proc/cpuinfo 2>/dev/null || true)
  missing=()
  for f in sse4_2 popcnt ssse3 cx16; do [[ " $flags " == *" $f "* ]] || missing+=("$f"); done
  if ((${#missing[@]})); then
    bad "CPU sin soporte x86-64-v2 (faltan: ${missing[*]}). En Proxmox: VM → Hardware → Processors → Type = host (o x86-64-v2-AES)."
  else
    ok "CPU x86-64-v2 compatible"
  fi
elif [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
  ok "CPU ARM64"
else
  bad "Arquitectura $arch no soportada"
fi

# Memoria
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if ((mem_mb >= 1800)); then ok "RAM ${mem_mb} MB"
elif ((mem_mb >= 1400)); then warn "RAM ${mem_mb} MB: funciona, pero se recomiendan 2 GB (la compilación de imágenes es lo que más consume)"
else bad "RAM ${mem_mb} MB: insuficiente, asigna al menos 1.5 GB (recomendado 2 GB)"; fi

# Disco libre
free_gb=$(df -Pk . | awk 'NR==2 {print int($4/1024/1024)}')
if ((free_gb >= 5)); then ok "Disco libre ${free_gb} GB"; else bad "Solo ${free_gb} GB libres: deja al menos 5 GB"; fi

# Docker y Compose
if command -v docker >/dev/null 2>&1; then
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '(sin acceso al daemon)')"
  if ! docker info >/dev/null 2>&1; then
    bad "No hay acceso al daemon de Docker. Ejecuta: sudo usermod -aG docker \$USER  y vuelve a iniciar sesión"
  fi
  if docker compose version >/dev/null 2>&1; then ok "$(docker compose version)"
  else bad "Falta el plugin docker compose (instala Docker con: curl -fsSL https://get.docker.com | sh)"; fi
else
  bad "Docker no está instalado (curl -fsSL https://get.docker.com | sh)"
fi

# .env.prod
if [[ -f .env.prod ]]; then
  if grep -qE 'CAMBIAR' .env.prod; then bad ".env.prod todavía tiene valores CAMBIAR (usa ./scripts/setup-env.sh)"; else ok ".env.prod presente"; fi
  if grep -E '^[A-Z_]+=.*\$' .env.prod >/dev/null; then bad '.env.prod tiene algún valor con $ (Docker Compose lo interpreta como variable)'; fi
  port=$(grep -E '^HTTP_PORT=' .env.prod | cut -d= -f2); port=${port:-80}
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^home-calendar-web'; then
    if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN; then
      bad "El puerto $port ya está en uso por otro proceso"
    else
      ok "Puerto $port libre"
    fi
  fi
else
  bad "Falta .env.prod (ejecuta ./scripts/setup-env.sh)"
fi

if ((fail)); then
  echo "Hay problemas que impiden el despliegue."
  exit 1
fi
echo "Todo listo."
