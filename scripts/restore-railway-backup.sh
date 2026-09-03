#!/bin/sh
set -eu

BACKUP_FILE="/app/migration/railway/vacaciones-production.dump.gpg"
DECRYPTED_FILE="/tmp/vacaciones-production.dump"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL no configurada"
  exit 1
fi

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "ERROR: BACKUP_PASSPHRASE no configurada"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup no encontrado: $BACKUP_FILE"
  exit 1
fi

cleanup() {
  rm -f "$DECRYPTED_FILE"
}
trap cleanup EXIT

echo "Descifrando backup..."
gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --passphrase "$BACKUP_PASSPHRASE" \
  --output "$DECRYPTED_FILE" \
  --decrypt "$BACKUP_FILE"

echo "Validando conexión PostgreSQL..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;"

echo "Restaurando PostgreSQL..."
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --exit-on-error \
  "$DECRYPTED_FILE"

echo "Restauración completada correctamente."
