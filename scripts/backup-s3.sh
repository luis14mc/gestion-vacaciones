#!/bin/bash
# =============================================================
# SCRIPT DE BACKUP A S3 - Vacaciones CNI
# =============================================================
# Este script crea un dump de PostgreSQL y lo sincroniza con un
# bucket de AWS S3.
#
# Requiere que la EC2 tenga un IAM Role (Instance Profile) con
# permisos de escritura en S3 (s3:PutObject).
# =============================================================

set -e

# Configuración
BACKUP_DIR="/opt/backups"
DB_CONTAINER="cni-postgres"
DB_USER="cni_admin"
S3_BUCKET="s3://cni-backups-bucket/vacaciones-app"  # ← CAMBIAR POR TU BUCKET REAL
DATE=$(date +'%Y%m%d_%H%M%S')
FILE_NAME="vacaciones_${DATE}.sql.gz"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

# 1. Crear el backup localmente
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando backup local..."
mkdir -p "$BACKUP_DIR"
docker exec "$DB_CONTAINER" pg_dumpall -U "$DB_USER" | gzip > "$FILE_PATH"
echo "Backup local completado: $FILE_PATH"

# 2. Sincronizar con S3
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Subiendo a S3 ($S3_BUCKET)..."
if aws s3 cp "$FILE_PATH" "$S3_BUCKET/$FILE_NAME" --storage-class STANDARD_IA; then
    echo "Subida a S3 exitosa."
else
    echo "Error al subir a S3."
    # Aquí podrías agregar un comando para enviar una alerta por Slack/Email
    exit 1
fi

# 3. Limpieza de backups locales antiguos (retención 7 días local)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Limpiando backups locales antiguos (>7 días)..."
find "$BACKUP_DIR" -name "vacaciones_*.sql.gz" -type f -mtime +7 -delete

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Proceso de backup finalizado exitosamente."
