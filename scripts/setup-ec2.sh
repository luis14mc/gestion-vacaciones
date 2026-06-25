#!/bin/bash
# =============================================================
# SETUP INICIAL - EC2 Ubuntu (t3.medium)
# =============================================================
# Ejecutar UNA SOLA VEZ al crear la instancia:
#   chmod +x scripts/setup-ec2.sh
#   sudo ./scripts/setup-ec2.sh
# =============================================================

set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo "  CONFIGURACIÓN INICIAL - EC2 Ubuntu para CNI"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────
# 1. ACTUALIZAR SISTEMA
# ─────────────────────────────────────────────────────────
echo "[1/7] Actualizando sistema operativo..."
apt update -y && apt upgrade -y

# ─────────────────────────────────────────────────────────
# 2. INSTALAR DOCKER
# ─────────────────────────────────────────────────────────
echo "[2/7] Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker instalado"
else
    echo "✓ Docker ya está instalado"
fi

# ─────────────────────────────────────────────────────────
# 3. INSTALAR HERRAMIENTAS CLAVE (Git, AWS CLI, CloudWatch)
# ─────────────────────────────────────────────────────────
echo "[3/8] Instalando Git y utilidades AWS..."
apt install -y git awscli unzip

# Instalar CloudWatch Agent
if [ ! -f /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent ]; then
    echo "Instalando Amazon CloudWatch Agent..."
    wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
    dpkg -i -E ./amazon-cloudwatch-agent.deb
    rm ./amazon-cloudwatch-agent.deb
    echo "✓ CloudWatch Agent instalado (requiere IAM Role para activarse)"
else
    echo "✓ CloudWatch Agent ya instalado"
fi


# ─────────────────────────────────────────────────────────
# 4. CONFIGURAR SWAP (2 GB extra para builds pesados)
# ─────────────────────────────────────────────────────────
echo "[4/8] Configurando SWAP de 2GB..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Reducir swappiness (usar swap solo en emergencia)
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo "✓ SWAP de 2GB configurado"
else
    echo "✓ SWAP ya existe"
fi

# ─────────────────────────────────────────────────────────
# 5. OPTIMIZAR KERNEL PARA SERVIDOR WEB
# ─────────────────────────────────────────────────────────
echo "[5/8] Optimizando parámetros del kernel..."
cat >> /etc/sysctl.conf <<EOF

# === CNI Server Tuning ===
# Permitir más conexiones TCP simultáneas
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024

# Reutilizar conexiones TCP cerradas
net.ipv4.tcp_tw_reuse = 1

# Reducir tiempo de espera de conexiones cerradas
net.ipv4.tcp_fin_timeout = 15

# Archivos abiertos
fs.file-max = 65535
EOF
sysctl -p

# ─────────────────────────────────────────────────────────
# 6. CREAR ESTRUCTURA DE DIRECTORIOS
# ─────────────────────────────────────────────────────────
echo "[6/8] Creando estructura de directorios..."
mkdir -p /opt/apps/vacaciones-cni
mkdir -p /opt/apps/web-nueva
mkdir -p /opt/backups
mkdir -p /opt/apps/vacaciones-cni/nginx/ssl
chown -R ubuntu:ubuntu /opt/apps /opt/backups

# ─────────────────────────────────────────────────────────
# 7. CONFIGURAR CRON PARA BACKUPS A S3 Y TRANSICIONES
# ─────────────────────────────────────────────────────────
echo "[7/8] Configurando cron jobs..."
(crontab -l 2>/dev/null; echo "
# Backup diario de PostgreSQL a S3 a las 2:00 AM
0 2 * * * /opt/apps/vacaciones-cni/scripts/backup-s3.sh >> /var/log/backup-s3.log 2>&1

# Transiciones automáticas de solicitudes a medianoche
0 0 * * * curl -s -X POST http://localhost:3000/api/cron/transiciones -H 'Authorization: Bearer \$(grep CRON_SECRET /opt/apps/vacaciones-cni/.env.production | cut -d= -f2)' > /dev/null 2>&1

# Limpiar logs de Docker semanalmente
0 4 * * 0 docker system prune -f > /dev/null 2>&1
") | crontab -

# ─────────────────────────────────────────────────────────
# 8. CONFIGURAR CLOUDWATCH BÁSICO (Opcional)
# ─────────────────────────────────────────────────────────
echo "[8/8] Preparando CloudWatch..."
# Si tienes un archivo config.json en el repo, descomenta esto para aplicarlo:
# /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/apps/vacaciones-cni/scripts/cloudwatch-config.json


echo ""
echo "═══════════════════════════════════════════════════════"
echo "  CONFIGURACIÓN COMPLETADA"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  PRÓXIMOS PASOS:"
echo ""
echo "  1. Cerrar sesión y volver a entrar (para grupo Docker):"
echo "     exit && ssh -i tu-key.pem ubuntu@tu-ip"
echo ""
echo "  2. Clonar el repositorio:"
echo "     cd /opt/apps/vacaciones-cni"
echo "     git clone TU_REPO_URL ."
echo ""
echo "  3. Configurar variables de entorno:"
echo "     cp .env.production.example .env.production"
echo "     nano .env.production"
echo ""
echo "  4. Desplegar:"
echo "     ./scripts/deploy-ec2.sh"
echo ""
echo "═══════════════════════════════════════════════════════"
