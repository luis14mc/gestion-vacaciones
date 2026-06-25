#!/bin/bash
# =============================================================
# SCRIPT DE DESPLIEGUE - Vacaciones CNI
# =============================================================
# Ejecutar en la EC2 vía SSH:
#   chmod +x scripts/deploy-ec2.sh
#   ./scripts/deploy-ec2.sh
# =============================================================

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/opt/vacaciones/app/gestion-vacaciones}"
BACKUP_DIR="/opt/backups"

log() { echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────
# 0. VERIFICAR PREREQUISITOS
# ─────────────────────────────────────────────────────────
log "Verificando prerequisitos..."

command -v docker >/dev/null 2>&1 || error "Docker no está instalado. Ejecuta: curl -fsSL https://get.docker.com | sh"
command -v docker compose >/dev/null 2>&1 || error "Docker Compose no está instalado."
command -v git >/dev/null 2>&1 || error "Git no está instalado. Ejecuta: sudo apt install git"

success "Prerequisitos OK"

# ─────────────────────────────────────────────────────────
# 1. VERIFICAR ARCHIVO DE ENTORNO
# ─────────────────────────────────────────────────────────
log "Verificando archivo de entorno..."

if [ ! -f "$APP_DIR/.env.production" ]; then
    error "Falta $APP_DIR/.env.production. Copia .env.production.example y completa los valores."
fi

# Verificar que no hay valores placeholder
if grep -q "CAMBIAR" "$APP_DIR/.env.production"; then
    error "El archivo .env.production tiene valores sin configurar (contiene 'CAMBIAR'). Edítalo antes de desplegar."
fi

success "Archivo de entorno OK"

# ─────────────────────────────────────────────────────────
# 2. BACKUP DE BASE DE DATOS (si existe contenedor previo)
# ─────────────────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "cni-postgres"; then
    log "Creando backup de la base de datos..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/vacaciones_$(date +'%Y%m%d_%H%M%S').sql.gz"

    docker exec cni-postgres pg_dumpall -U cni_admin | gzip > "$BACKUP_FILE"
    success "Backup creado: $BACKUP_FILE"

    # Eliminar backups mayores a 7 días
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
    log "Backups antiguos limpiados (retención: 7 días)"
fi

# ─────────────────────────────────────────────────────────
# 3. CONSTRUIR Y DESPLEGAR
# ─────────────────────────────────────────────────────────
cd "$APP_DIR"

log "Construyendo imagen Docker..."
docker compose build --no-cache vacaciones-app
success "Imagen construida"

log "Deteniendo servicios anteriores..."
docker compose down --remove-orphans 2>/dev/null || true

log "Iniciando PostgreSQL..."
docker compose up -d postgres
success "PostgreSQL iniciado"

log "Esperando que PostgreSQL esté listo..."
sleep 10
if docker exec cni-postgres pg_isready -U cni_admin >/dev/null 2>&1; then
    success "PostgreSQL está listo"
else
    warn "PostgreSQL podría no estar listo aún, intentando inicialización..."
fi

log "Inicializando esquema de base de datos..."
docker run --rm \
    --network cni-network \
    -v $(pwd):/app \
    -w /app \
    --env-file .env.production \
    node:22-alpine \
    sh -c "corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile --prod=false && node scripts/init-prod.mjs"
success "Base de datos inicializada"

log "Iniciando resto de servicios..."
docker compose up -d
success "Servicios iniciados"

# ─────────────────────────────────────────────────────────
# 4. VERIFICAR SALUD
# ─────────────────────────────────────────────────────────
log "Esperando que los servicios arranquen..."
sleep 15

# Verificar PostgreSQL
if docker exec cni-postgres pg_isready -U cni_admin >/dev/null 2>&1; then
    success "PostgreSQL: OK"
else
    warn "PostgreSQL: No responde aún (puede tardar hasta 30s)"
fi

# Verificar App Vacaciones
if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    success "App Vacaciones: OK (http://localhost:3000)"
else
    warn "App Vacaciones: No responde aún (puede tardar hasta 60s)"
fi

# Verificar Nginx
if curl -sf http://localhost >/dev/null 2>&1; then
    success "Nginx: OK (http://localhost)"
else
    warn "Nginx: No responde. Revisa: docker logs cni-nginx"
fi

# ─────────────────────────────────────────────────────────
# 5. RESUMEN
# ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DESPLIEGUE COMPLETADO"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  🟢 App Vacaciones  → http://localhost:3000"
echo "  🟢 PostgreSQL      → localhost:5432"
echo "  🟢 Nginx (proxy)   → http://localhost:80"
echo ""
echo "  📊 Monitorear recursos:"
echo "     docker stats --no-stream"
echo ""
echo "  📋 Ver logs:"
echo "     docker logs -f cni-vacaciones"
echo "     docker logs -f cni-postgres"
echo "     docker logs -f cni-nginx"
echo ""
echo "  🔄 Actualizar en el futuro:"
echo "     cd $APP_DIR && git pull && ./scripts/deploy-ec2.sh"
echo ""
echo "═══════════════════════════════════════════════════════"
