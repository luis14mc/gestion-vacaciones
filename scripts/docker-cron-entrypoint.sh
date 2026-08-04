#!/bin/sh
# =============================================================
# Entrypoint del contenedor `cni-cron`.
# =============================================================
# Genera el crontab con los valores YA sustituidos (no depende de que
# BusyBox crond reenvíe variables de entorno) y lo instala con el comando
# `crontab`, que lo coloca en la ruta real del spool de crond (evita la
# ambigüedad /etc/crontabs vs /var/spool/cron/crontabs). Luego arranca
# crond en foreground con log a stderr, visible en `docker logs`.
# =============================================================
set -eu

apk add --no-cache curl tzdata >/dev/null

mkdir -p /var/log/cron

: "${APP_URL:?APP_URL no definido}"
: "${CRON_SECRET:?CRON_SECRET no definido}"

# Heredoc SIN comillas en el delimitador → $APP_URL y $CRON_SECRET se
# expanden aquí, quedando valores literales en el crontab instalado.
cat > /tmp/crontab <<EOF
# Asignación mensual de vacaciones (día de aniversario de cada empleado) — 07:00 diario.
0 7 * * * curl -sS --fail -X POST "${APP_URL}/api/cron/asignacion-mensual" -H "Authorization: Bearer ${CRON_SECRET}" -H "Content-Type: application/json" -d '{"modo":"automatico","soloAniversario":true}' >> /var/log/cron/asignacion-mensual.log 2>&1
# Transiciones automáticas de solicitudes — medianoche.
0 0 * * * curl -sS --fail -X POST "${APP_URL}/api/cron/transiciones" -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron/transiciones.log 2>&1
# Notificaciones de cumpleaños — día 1 de cada mes 06:00.
0 6 1 * * curl -sS --fail -X POST "${APP_URL}/api/cron/cumpleanos" -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron/cumpleanos.log 2>&1
EOF

crontab /tmp/crontab
rm -f /tmp/crontab

echo "[cni-cron] $(date) — crontab instalado:"
crontab -l

# -f foreground, -d 8 log a stderr (para docker logs).
exec crond -f -d 8
