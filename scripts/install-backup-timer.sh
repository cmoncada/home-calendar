#!/usr/bin/env bash
# Programa un backup semanal automático (timer de systemd) que ejecuta scripts/backup-db.sh.
# Si la VM estaba apagada a la hora prevista, el backup se hace al volver a arrancar.
#
# Uso (en la VM, desde el proyecto):
#   sudo ./scripts/install-backup-timer.sh [--day dom] [--time 03:00] [--keep-weeks 8] [--dir /ruta/backups]
#   sudo ./scripts/install-backup-timer.sh --status      # próxima ejecución y últimos logs
#   sudo ./scripts/install-backup-timer.sh --run-now     # hace un backup ahora con la misma configuración
#   sudo ./scripts/install-backup-timer.sh --uninstall   # quita el timer (no borra los backups)
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd -P)

UNIT=home-calendar-backup
SERVICE_FILE=/etc/systemd/system/$UNIT.service
TIMER_FILE=/etc/systemd/system/$UNIT.timer

DAY=Sun; TIME=03:00; KEEP_WEEKS=8; DIR=""; ACTION=install

fail() { echo "✖ $*" >&2; exit 1; }

usage() { sed -n '5,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

while (($#)); do
  case "$1" in
    --day) DAY=${2:-}; shift ;;
    --time) TIME=${2:-}; shift ;;
    --keep-weeks) KEEP_WEEKS=${2:-}; shift ;;
    --dir) DIR=${2:-}; shift ;;
    --status) ACTION=status ;;
    --run-now) ACTION=run ;;
    --uninstall) ACTION=uninstall ;;
    -h|--help) usage ;;
    *) echo "Opción desconocida: $1" >&2; usage ;;
  esac
  shift
done

[[ $(uname -s) == Linux ]] && command -v systemctl >/dev/null && [[ -d /run/systemd/system ]] \
  || fail "Este script necesita Linux con systemd (la VM de Proxmox)."
((EUID == 0)) || fail "Ejecútalo con sudo: sudo $0 $*"

case "$ACTION" in
  status)
    systemctl list-timers "$UNIT.timer" --all --no-pager
    echo
    journalctl -u "$UNIT.service" -n 20 --no-pager || true
    exit 0 ;;
  run)
    [[ -f $SERVICE_FILE ]] || fail "El timer no está instalado. Ejecuta primero: sudo $0"
    echo "Haciendo backup…"
    systemctl start "$UNIT.service" || { journalctl -u "$UNIT.service" -n 20 --no-pager >&2; fail "El backup falló."; }
    journalctl -u "$UNIT.service" -n 3 --no-pager -o cat
    echo "✔ Backup terminado"
    exit 0 ;;
  uninstall)
    systemctl disable --now "$UNIT.timer" 2>/dev/null || true
    rm -f "$SERVICE_FILE" "$TIMER_FILE"
    systemctl daemon-reload
    echo "✔ Backup semanal desinstalado (los backups existentes no se han tocado)."
    exit 0 ;;
esac

# --- Validación de opciones ---
case "${DAY,,}" in
  mon|lun|lunes) DAY=Mon ;;
  tue|mar|martes) DAY=Tue ;;
  wed|mie|mié|miercoles|miércoles) DAY=Wed ;;
  thu|jue|jueves) DAY=Thu ;;
  fri|vie|viernes) DAY=Fri ;;
  sat|sab|sáb|sabado|sábado) DAY=Sat ;;
  sun|dom|domingo) DAY=Sun ;;
  *) fail "Día inválido: '$DAY' (usa lun, mar, mie, jue, vie, sab o dom)" ;;
esac
[[ $TIME =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || fail "Hora inválida: '$TIME' (formato HH:MM, p. ej. 03:00)"
[[ $KEEP_WEEKS =~ ^[1-9][0-9]*$ ]] || fail "--keep-weeks debe ser un número entero mayor que 0"
if [[ -n $DIR ]]; then
  [[ $DIR == /* ]] || fail "--dir debe ser una ruta absoluta"
  [[ ! $DIR =~ [[:space:]] ]] || fail "--dir no puede contener espacios"
fi
[[ -f .env.prod ]] || fail "Falta .env.prod en $PROJECT_DIR (ejecuta ./scripts/setup-env.sh)"
[[ -x scripts/backup-db.sh ]] || fail "No se encuentra scripts/backup-db.sh ejecutable"
[[ ! $PROJECT_DIR =~ [[:space:]] ]] || fail "La ruta del proyecto no puede contener espacios: $PROJECT_DIR"

KEEP_DAYS=$((KEEP_WEEKS * 7))

# El backup se ejecuta como el dueño del proyecto (así los ficheros no quedan de root),
# siempre que pueda usar Docker; si no, como root.
RUN_AS=$(stat -c %U "$PROJECT_DIR")
if [[ $RUN_AS != root ]] && ! id -nG "$RUN_AS" | tr ' ' '\n' | grep -qx docker; then
  echo "Aviso: '$RUN_AS' no está en el grupo docker; el backup se ejecutará como root." >&2
  RUN_AS=root
fi
if [[ -n $DIR && $RUN_AS != root ]]; then
  mkdir -p "$DIR" && chown "$RUN_AS" "$DIR"
fi

# --- Unidades de systemd (se sobrescriben si ya existían) ---
cat > "$SERVICE_FILE" <<EOF
# Generado por scripts/install-backup-timer.sh. Para cambiarlo, vuelve a ejecutar el script.
[Unit]
Description=Home Calendar: backup de la base de datos y las fotos
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=$RUN_AS
WorkingDirectory=$PROJECT_DIR
Environment=KEEP_DAYS=$KEEP_DAYS
${DIR:+Environment=BACKUP_DIR=$DIR}
ExecStart=$PROJECT_DIR/scripts/backup-db.sh
EOF

cat > "$TIMER_FILE" <<EOF
# Generado por scripts/install-backup-timer.sh. Para cambiarlo, vuelve a ejecutar el script.
[Unit]
Description=Home Calendar: backup semanal

[Timer]
OnCalendar=$DAY *-*-* $TIME:00
Persistent=true
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "$UNIT.timer" >/dev/null
systemctl restart "$UNIT.timer"

echo "✔ Backup semanal programado: cada $DAY a las $TIME"
echo "  Destino: ${DIR:-$PROJECT_DIR/backups} · se conservan $KEEP_WEEKS semanas ($KEEP_DAYS días) · usuario: $RUN_AS"
echo
systemctl list-timers "$UNIT.timer" --no-pager
echo
echo "Probar ahora:   sudo $0 --run-now"
echo "Ver estado:     sudo $0 --status"
echo "Logs:           journalctl -u $UNIT.service"
