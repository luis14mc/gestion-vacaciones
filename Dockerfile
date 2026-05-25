# =============================================================
# DOCKERFILE - Vacaciones CNI (Optimizado para EC2 t3.medium)
# =============================================================
# Multi-stage build: deps → builder → runner
# Imagen final: ~150MB | RAM máx: 768MB
# =============================================================

# ─────────────────────────────────────────────────────────────
# STAGE 1: Instalar dependencias
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Instalar libc6-compat para compatibilidad con Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copiar solo archivos de dependencias (cache-friendly)
COPY package.json pnpm-lock.yaml ./

# Instalar SOLO dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# ─────────────────────────────────────────────────────────────
# STAGE 2: Compilar la aplicación
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copiar node_modules de la fase de deps
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Instalar devDependencies necesarias para el build (TypeScript, etc.)
RUN pnpm install --frozen-lockfile

# Variables de entorno para el build (no secretos)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Limitar memoria del build para no reventar la EC2
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Compilar
RUN pnpm build

# ─────────────────────────────────────────────────────────────
# STAGE 3: Runner de producción (imagen final ultraligera)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Seguridad: No correr como root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Variables de entorno de producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# ┌─────────────────────────────────────────────────────────┐
# │ LÍMITE DE MEMORIA V8: 768 MB                           │
# │ En una EC2 compartida con 4 GB, esto deja margen para  │
# │ PostgreSQL (~600MB), Django (~400MB), Nginx (~50MB),    │
# │ la otra app Next.js (~768MB) y el OS (~400MB).          │
# └─────────────────────────────────────────────────────────┘
ENV NODE_OPTIONS="--max-old-space-size=768"

# Copiar archivos estáticos públicos
COPY --from=builder /app/public ./public

# Crear directorio de caché de Next.js con permisos correctos
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar el output standalone (SOLO lo necesario, sin node_modules completo)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Cambiar a usuario sin privilegios
USER nextjs

EXPOSE 3000

# Health check para Docker / balanceador
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/login || exit 1

# Iniciar servidor standalone
CMD ["node", "server.js"]
