# 🚀 ANÁLISIS DE HOSTING Y DEPLOYMENT
## Sistema de Gestión de Vacaciones - CNI Honduras

**Fecha**: 8 de enero de 2026  
**Stack Técnico**: Next.js 14 (App Router) + PostgreSQL + Drizzle ORM  
**Dominio actual**: punto.hn (no optimizado para aplicaciones)

---

## 🎯 Requisitos Técnicos

### Stack de la Aplicación
- **Frontend/Backend**: Next.js 14 con App Router (SSR + API Routes)
- **Base de Datos**: PostgreSQL 15+
- **ORM**: Drizzle
- **Autenticación**: NextAuth (sesiones + cookies)
- **Assets**: Imágenes, PDFs (reportes)
- **Variables de entorno**: Sensibles (BD, secrets)

### Necesidades de Performance
- **Usuarios concurrentes**: ~50-100 usuarios (CNI Honduras)
- **Uptime requerido**: 99.5% mínimo
- **Latencia aceptable**: <500ms (usuarios en Honduras)
- **Almacenamiento BD**: ~5-10GB inicial
- **Tráfico mensual**: ~50-100GB

---

## 📊 OPCIONES DE HOSTING (Ranking)

### 🥇 OPCIÓN 1: Vercel + Neon PostgreSQL (RECOMENDADA)

#### ✅ Ventajas
- **Deploy automático**: Push a git = deploy instantáneo
- **Optimizado para Next.js**: Creadores de Next.js
- **Edge Network global**: CDN incluido, baja latencia
- **Serverless**: Escalamiento automático
- **SSL gratuito**: HTTPS automático
- **Preview deployments**: Rama = preview URL
- **Rollback**: 1 click para volver a versión anterior
- **Monitoreo incluido**: Analytics, logs, errores
- **Dominio personalizado**: Fácil conectar punto.hn

#### Neon PostgreSQL (Base de Datos)
- **Serverless Postgres**: Escalamiento automático
- **Branching**: BD por rama (dev, staging, prod)
- **Backups automáticos**: Point-in-time recovery
- **Conexiones desde cualquier lugar**
- **Compatible con Drizzle ORM**

#### 💰 Costos
```
Plan Pro (recomendado para producción):
- Vercel Pro: $20/mes
- Neon Scale: $19/mes (incluye 10GB storage)
TOTAL: $39/mes (~L975/mes)

Plan Hobby (para empezar/testing):
- Vercel Hobby: $0/mes
- Neon Free: $0/mes (1GB storage, 0.5GB RAM)
TOTAL: $0/mes (limitado, bueno para POC)
```

#### 🚀 Setup en 30 minutos
```bash
# 1. Conectar repo a Vercel
vercel login
vercel link

# 2. Configurar variables de entorno en Vercel
# Dashboard → Settings → Environment Variables
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://vacaciones.punto.hn

# 3. Deploy
vercel --prod
```

#### 📍 Configuración DNS punto.hn
```
Agregar en panel de punto.hn:
CNAME: vacaciones → cname.vercel-dns.com
TXT: _vercel → [código de verificación]
```

#### ⚠️ Desventajas
- Costos en USD (fluctuación cambiaria)
- Requiere tarjeta internacional
- Soporte en inglés

---

### 🥈 OPCIÓN 2: Railway.app (Alternativa Excelente)

#### ✅ Ventajas
- **Todo en uno**: App + PostgreSQL en un lugar
- **Deploy desde GitHub**: CI/CD automático
- **$5 gratis/mes**: Crédito incluido
- **Más barato que Vercel+Neon**: Single vendor
- **CLI potente**: Comandos locales
- **Logs en tiempo real**: Debugging fácil
- **Staging/Production**: Múltiples ambientes

#### 💰 Costos
```
Plan Hobby (suficiente para CNI):
- $5 crédito gratis/mes
- ~$0.000231/min CPU + $0.000007/GB RAM/min
- PostgreSQL: $0.000139/GB/hora storage

Estimado real para CNI:
- App Next.js: ~$8-12/mes
- PostgreSQL 10GB: ~$10/mes
TOTAL: $18-22/mes (~L450-550/mes)
```

#### 🚀 Setup en 45 minutos
```bash
# 1. Instalar CLI
npm i -g @railway/cli

# 2. Login y crear proyecto
railway login
railway init

# 3. Agregar PostgreSQL
railway add postgresql

# 4. Deploy
railway up
```

#### 📍 Dominio personalizado
```
Railway Dashboard → Settings → Domains
Agregar: vacaciones.punto.hn
Copiar CNAME y configurar en punto.hn
```

#### ⚠️ Desventajas
- Menos conocido que Vercel
- Sin edge network tan robusto
- Monitoreo básico (vs Vercel)

---

### 🥉 OPCIÓN 3: DigitalOcean App Platform + Managed PostgreSQL

#### ✅ Ventajas
- **App Platform**: PaaS simple para Next.js
- **PostgreSQL Managed**: Alta disponibilidad
- **Datacenter Miami**: Latencia baja a Honduras (~50ms)
- **Backups diarios**: Incluidos
- **Escalamiento vertical**: Fácil aumentar recursos
- **Soporte 24/7**: En español disponible
- **Presencia en LATAM**: Facturación en USD

#### 💰 Costos
```
App Platform Basic:
- Next.js App: $12/mes (1GB RAM, 512MB CPU)
- Postgres Basic: $15/mes (1GB RAM, 10GB storage, 25 conexiones)
TOTAL: $27/mes (~L675/mes)

App Platform Professional (recomendado):
- Next.js App: $24/mes (2GB RAM)
- Postgres Pro: $60/mes (4GB RAM, 50GB storage)
TOTAL: $84/mes (~L2,100/mes)
```

#### 🚀 Setup en 1 hora
```bash
# 1. Crear cuenta DigitalOcean
# 2. Dashboard → App Platform → Create App
# 3. Conectar GitHub repo
# 4. Agregar PostgreSQL desde Add-ons
# 5. Configurar env vars
# 6. Deploy
```

#### 📍 Dominio personalizado
```
App Settings → Domains → Add Domain
Agregar: vacaciones.punto.hn
Configurar CNAME en punto.hn
```

#### ⚠️ Desventajas
- Más caro que Railway
- Setup menos automático
- No serverless (pagas por recursos fijos)

---

### 🏗️ OPCIÓN 4: AWS Amplify + RDS (Empresarial)

#### ✅ Ventajas
- **Enterprise-grade**: Máxima confiabilidad
- **Escalabilidad ilimitada**: Para crecimiento futuro
- **Región Ohio**: ~80ms a Honduras
- **RDS PostgreSQL**: Backups automáticos, read replicas
- **CloudFront CDN**: Distribución global
- **IAM completo**: Seguridad granular
- **CloudWatch**: Monitoreo avanzado

#### 💰 Costos
```
Setup básico:
- Amplify Hosting: ~$15/mes
- RDS db.t3.micro: ~$15/mes
- Data transfer: ~$5-10/mes
TOTAL: ~$35-40/mes (~L875-1000/mes)

Setup recomendado:
- Amplify + CloudFront: ~$25/mes
- RDS db.t3.small: ~$30/mes
- Backups + monitoring: ~$10/mes
TOTAL: ~$65/mes (~L1,625/mes)
```

#### ⚠️ Desventajas
- Setup complejo (curva de aprendizaje)
- Requiere experiencia en AWS
- Costos variables (difícil estimar)
- Facturación en USD

---

### 🇭🇳 OPCIÓN 5: Hosting Local Honduras (punto.hn VPS)

#### ✅ Ventajas
- **Ya tienes dominio**: Sin costos adicionales dominio
- **Soporte local**: En español, misma zona horaria
- **Facturación en Lempiras**: Sin fluctuación cambiaria
- **Control total**: Acceso root al servidor

#### 💰 Costos (ejemplo punto.hn)
```
VPS Cloud Standard:
- 2GB RAM, 2 CPU, 40GB SSD: L800-1200/mes
- Backup semanal: L200/mes
- Panel de control: Incluido
TOTAL: L1,000-1,400/mes ($40-56/mes)
```

#### 🚀 Setup en 3-4 horas
```bash
# 1. Provisionar VPS Ubuntu 22.04
# 2. Instalar Node.js 20, PostgreSQL 15, Nginx
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx

# 3. Configurar Nginx como reverse proxy
# 4. Instalar PM2 para proceso Next.js
npm install -g pm2
pm2 start npm --name "vacaciones" -- start

# 5. Configurar PostgreSQL
sudo -u postgres createdb vacaciones_cni

# 6. Deploy manual
git clone [repo]
npm install
npm run build
pm2 restart vacaciones
```

#### ⚠️ Desventajas
- **Setup manual complejo**: Requiere DevOps
- **Mantenimiento continuo**: Actualizaciones, seguridad, backups
- **Sin auto-scaling**: Recursos fijos
- **Single point of failure**: Si cae el VPS, cae todo
- **SSL manual**: Certificado Let's Encrypt a renovar
- **No CI/CD**: Deploy manual cada vez
- **Uptime**: Depende de infraestructura punto.hn

---

## 🎯 MATRIZ DE DECISIÓN

| Criterio | Vercel+Neon | Railway | DigitalOcean | AWS | punto.hn VPS |
|----------|-------------|---------|--------------|-----|--------------|
| **Facilidad Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Costo Mensual** | $39 | $20 | $27-84 | $40-65 | $40-56 |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Escalabilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Mantenimiento** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **CI/CD** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ |
| **Monitoreo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **Latencia HN** | ~120ms | ~100ms | ~50ms | ~80ms | ~20ms |
| **Soporte** | EN 24/7 | EN Chat | EN/ES 24/7 | EN Tickets | ES Local |
| **Backups** | Auto | Auto | Auto | Auto | Manual |

---

## 🏆 RECOMENDACIÓN FINAL

### Para CNI Honduras: **Railway.app** 🥇

#### Justificación
1. **Mejor relación costo-beneficio**: $20/mes todo incluido
2. **Setup en 45 minutos**: Deploy listo para producción
3. **Todo en un lugar**: No necesitas coordinar entre proveedores
4. **CI/CD automático**: Push = deploy
5. **Crédito gratis**: Primer mes prácticamente gratis
6. **Fácil de mantener**: No requiere DevOps senior

### Plan de Implementación Railway

#### Fase 1: Setup Inicial (Día 1)
```bash
# 1. Crear cuenta Railway
https://railway.app/new

# 2. Conectar GitHub
Link repo: https://github.com/[tu-org]/gestion-vacaciones

# 3. Crear proyecto
railway init --name vacaciones-cni

# 4. Agregar PostgreSQL
railway add postgresql

# 5. Configurar variables de entorno
railway variables set DATABASE_URL=${{POSTGRES.DATABASE_URL}}
railway variables set NEXTAUTH_SECRET=[generar secret]
railway variables set NEXTAUTH_URL=https://vacaciones.punto.hn
```

#### Fase 2: Configuración DNS (Día 1)
```
1. Railway Dashboard → Settings → Domains
2. Click "Custom Domain"
3. Agregar: vacaciones.punto.hn
4. Railway te da: CNAME target

5. Ir a panel punto.hn → DNS
6. Agregar registro:
   Tipo: CNAME
   Nombre: vacaciones
   Destino: [CNAME de Railway]
   TTL: 3600
```

#### Fase 3: Migración Base de Datos (Día 2)
```bash
# 1. Exportar BD actual (si existe)
pg_dump -h localhost -U postgres vacaciones_cni > backup.sql

# 2. Obtener URL de Railway
railway variables get DATABASE_URL

# 3. Importar a Railway
psql [DATABASE_URL] < backup.sql

# 4. Ejecutar migraciones Drizzle
npm run db:push
```

#### Fase 4: Testing (Día 2)
- [ ] Verificar dominio personalizado funcional
- [ ] Login con usuarios de prueba
- [ ] Crear solicitud de vacaciones
- [ ] Aprobar solicitud
- [ ] Verificar reportes
- [ ] Testing desde móvil

#### Fase 5: Producción (Día 3)
- [ ] Configurar alertas en Railway
- [ ] Documentar proceso de deploy
- [ ] Capacitar equipo CNI
- [ ] Monitorear primeros días

---

## 🔄 PLAN B: Vercel + Neon

Si Railway presenta problemas o CNI prefiere la marca "Vercel":

```bash
# Setup Vercel
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel --prod

# Setup Neon
1. Crear cuenta: https://neon.tech
2. Crear proyecto: vacaciones-cni
3. Copiar connection string
4. Agregar en Vercel env vars
```

**Costo**: $39/mes (vs $20 Railway)  
**Beneficio**: Marca reconocida, mejor monitoreo

---

## 📋 CHECKLIST PRE-DEPLOYMENT

- [ ] Backup completo de BD actual
- [ ] Variables de entorno documentadas
- [ ] NEXTAUTH_SECRET generado (32+ caracteres)
- [ ] Usuarios de prueba creados en BD
- [ ] SSL verificado (HTTPS funcionando)
- [ ] Rollback plan documentado
- [ ] Contactos de soporte guardados
- [ ] Monitoreo configurado
- [ ] Alertas de downtime activas
- [ ] Documentación de deployment para equipo

---

## 💡 RECOMENDACIONES ADICIONALES

### 1. Dominio
```
Actual: *.punto.hn
Considerar: vacaciones.cni.hn (más profesional)
O mantener: vacaciones.punto.hn
```

### 2. Ambientes
```
- Producción: vacaciones.punto.hn
- Staging: staging-vacaciones.punto.hn (Railway preview)
- Desarrollo: localhost:3000
```

### 3. Monitoreo
- **Uptime**: UptimeRobot (gratis, 5 mins checks)
- **Errors**: Sentry (gratis hasta 5k eventos/mes)
- **Analytics**: Vercel Analytics o Railway Observability

### 4. Backups
- **Railway**: Backups automáticos diarios
- **Adicional**: Script semanal a S3/Dropbox
```bash
# Cron job semanal
0 2 * * 0 railway run pg_dump > backup-$(date +%F).sql
```

---

## 🚨 RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Downtime en deploy | Media | Alto | Deploy en horario no laboral + staging test |
| Pérdida de datos | Baja | Crítico | Backups automáticos + script adicional |
| DNS mal configurado | Media | Medio | Verificar 24h antes en staging |
| Exceso de costos | Baja | Medio | Configurar alertas de billing |
| Performance degradado | Baja | Medio | Load testing previo en staging |

---

## 💰 PRESUPUESTO ANUAL ESTIMADO

### Railway (Recomendado)
```
Mensual: $20
Anual: $240 (~L6,000)
+ Buffer 20%: $288 (~L7,200 anual)
```

### Comparativa
```
Railway:      L7,200/año
Vercel+Neon:  L11,700/año
DigitalOcean: L8,100-25,200/año
AWS:          L10,500-19,500/año
punto.hn VPS: L12,000-16,800/año
```

---

## 📞 CONTACTOS ÚTILES

### Railway
- **Soporte**: support@railway.app
- **Docs**: https://docs.railway.app
- **Discord**: https://discord.gg/railway

### Punto.hn (punto.hn)
- **Soporte**: soporte@punto.hn
- **Panel DNS**: https://panel.punto.hn

### Emergencias
- **Rollback Railway**: `railway rollback` (CLI)
- **Backup restore**: Desde Railway Dashboard → Database → Backups

---

## ✅ DECISIÓN RECOMENDADA

**Usar Railway.app por:**
1. ✅ Menor costo ($20/mes vs $39 Vercel)
2. ✅ Setup más rápido (45 min vs 1h+)
3. ✅ Todo integrado (app + BD)
4. ✅ Ideal para equipos pequeños
5. ✅ Suficiente para 100 usuarios CNI

**Próximos pasos inmediatos:**
1. Crear cuenta Railway
2. Conectar repositorio GitHub
3. Configurar variables de entorno
4. Deploy staging para testing
5. Configurar DNS vacaciones.punto.hn
6. Deploy producción

**Tiempo estimado total**: 2 días (16 horas)  
**Costo primer año**: L7,200 (~$288 USD)

---

## 🌐 BONUS: WordPress en Railway

### ¿Se puede hostear WordPress en Railway?

**Respuesta: SÍ** ✅, usando Docker containers.

#### Setup WordPress en Railway

Railway puede correr cualquier container Docker, incluyendo WordPress:

```yaml
# railway.toml (para WordPress)
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "apache2-foreground"
```

#### Opción 1: WordPress desde Template (MÁS FÁCIL)

Railway tiene templates pre-configurados:

```bash
# 1. Desde Railway Dashboard
Templates → Buscar "WordPress"
Click "Deploy WordPress"

# 2. Railway crea automáticamente:
- WordPress container
- MySQL database
- Persistent storage para uploads
- URL pública

# 3. Configurar dominio
Settings → Domains → Add: blog.punto.hn
```

**Costo adicional**: ~$10-15/mes
- WordPress container: ~$5-8/mes
- MySQL: ~$5-7/mes

#### Opción 2: Docker Compose (MÁS CONTROL)

```yaml
# docker-compose.yml
version: '3'
services:
  wordpress:
    image: wordpress:latest
    ports:
      - "80:80"
    environment:
      WORDPRESS_DB_HOST: ${{MYSQL_HOST}}
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: ${{MYSQL_USER}}
      WORDPRESS_DB_PASSWORD: ${{MYSQL_PASSWORD}}
    volumes:
      - wordpress_data:/var/www/html

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${{MYSQL_ROOT_PASSWORD}}
      MYSQL_DATABASE: wordpress
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  wordpress_data:
  mysql_data:
```

Deploy:
```bash
railway up
```

### 💰 Costos Combinados CNI

```
OPCIÓN A: Railway con ambos servicios

1. App Vacaciones (Next.js + PostgreSQL)
   - Next.js: ~$10/mes
   - PostgreSQL: ~$10/mes
   Subtotal: $20/mes

2. WordPress (Docker + MySQL)
   - WordPress container: ~$8/mes
   - MySQL: ~$7/mes
   Subtotal: $15/mes

TOTAL MENSUAL: $35/mes (~L875/mes)
TOTAL ANUAL: $420/año (~L10,500/año)
```

### 🎯 Arquitectura Recomendada CNI

```
Railway Account CNI
│
├── Proyecto 1: Sistema Vacaciones
│   ├── Service: Next.js App
│   ├── Service: PostgreSQL
│   └── Domain: vacaciones.punto.hn
│
└── Proyecto 2: WordPress Institucional
    ├── Service: WordPress (Docker)
    ├── Service: MySQL
    └── Domain: www.punto.hn o blog.punto.hn
```

### 📋 Plan de Implementación Dual

#### Fase 1: Sistema Vacaciones (Prioridad 1)
- Semana 1: Deploy app Next.js
- Configurar: vacaciones.punto.hn
- Testing completo
- Capacitación usuarios

#### Fase 2: WordPress (Prioridad 2)
- Semana 2-3: Deploy WordPress
- Migrar contenido actual de punto.hn
- Configurar: www.punto.hn o blog.punto.hn
- Temas y plugins

### ⚡ Alternativa: WordPress en Hosting Separado

Si quieren optimizar costos:

```
OPCIÓN B: Hosting mixto

1. Sistema Vacaciones en Railway
   - Costo: $20/mes (~L500/mes)
   - Domain: vacaciones.punto.hn

2. WordPress en hosting tradicional hondureño
   - punto.hn Hosting WordPress: ~L200-400/mes
   - O Hostinger: $3-5/mes (L75-125/mes)
   - Domain: www.punto.hn

TOTAL: L575-625/mes (~L7,500/año)
```

### 🏆 Recomendación Final

**Para CNI Honduras:**

1. **Sistema Vacaciones → Railway** ($20/mes)
   - Crítico para operaciones
   - Requiere alta disponibilidad
   - CI/CD automático

2. **WordPress → Hosting tradicional** (L200-400/mes)
   - Contenido estático/institucional
   - Menos crítico
   - Más económico

**TOTAL**: L700-900/mes (~L10,000/año)

**Beneficios de separar:**
- ✅ Menor costo total
- ✅ Hosting WordPress más familiar para equipo
- ✅ No afecta performance de app vacaciones
- ✅ Backups independientes
- ✅ Más fácil encontrar soporte WordPress local

### 🔧 Setup WordPress en Railway (si eligen todo en Railway)

```bash
# 1. Crear nuevo proyecto en Railway
railway init --name wordpress-cni

# 2. Deploy WordPress desde template
railway add wordpress

# 3. Configurar dominio
railway domain www.punto.hn

# 4. Acceder a WordPress
https://www.punto.hn/wp-admin

# 5. Completar instalación
- Idioma: Español
- Título: Consejo Nacional de Inversiones
- Usuario admin: admin@punto.hn
- Contraseña segura
```

### 📊 Comparativa Final

| Aspecto | Todo en Railway | Mixto (Railway + Hosting WP) |
|---------|----------------|------------------------------|
| **Costo mensual** | $35 (L875) | L700-900 |
| **Costo anual** | L10,500 | L8,400-10,800 |
| **Facilidad setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Mantenimiento** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Soporte WP** | EN (Railway) | ES (Local) |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Separación riesgos** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

**Documento creado**: 8 de enero de 2026  
**Actualizado**: 9 de enero de 2026  
**Revisado por**: Equipo DevOps  
**Aprobación pendiente**: Gerencia CNI Honduras  
**Próxima revisión**: Post-deployment (15 días después)
