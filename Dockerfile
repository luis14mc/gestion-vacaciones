# =============================================================
# DOCKERFILE - Vacaciones CNI (Railway)
# =============================================================
# Multi-stage build: deps -> builder -> runner
# Railway usa este Dockerfile desde la rama production-railway.
# =============================================================

# STAGE 1: Dependencias
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# STAGE 2: Build
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Railway no expone variables de servicio dentro de un Docker build
# a menos que se declaren como ARG en la etapa donde se necesitan.
# La app importa el cliente PostgreSQL durante `next build`, por lo que
# DATABASE_URL debe existir aunque el build no ejecute consultas reales.
ARG DATABASE_URL
ARG DATABASE_SSL=false
ARG DATABASE_SSL_REJECT_UNAUTHORIZED=true
ARG AUTH_URL
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_SITE_URL

ENV DATABASE_URL=${DATABASE_URL}
ENV DATABASE_SSL=${DATABASE_SSL}
ENV DATABASE_SSL_REJECT_UNAUTHORIZED=${DATABASE_SSL_REJECT_UNAUTHORIZED}
ENV AUTH_URL=${AUTH_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN pnpm build

# STAGE 3: Runtime
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=768"

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/api/health || exit 1

CMD ["node", "server.js"]
