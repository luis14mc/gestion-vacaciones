# AGENTS.md — Gestión de Vacaciones CNI

## Stack

Next.js 16 (App Router) + React 19 + TypeScript 5.9 + PostgreSQL 16 + Drizzle ORM + Tailwind CSS 4 + shadcn/ui (new-york style). Auth via NextAuth.js v5 (JWT + Credentials). Single-package repo (pnpm).

## Commands

```bash
pnpm dev              # Dev server (webpack) on :3000
pnpm build            # Production build (standalone output)
pnpm lint             # ESLint
pnpm test:run         # Unit tests only (tests/unit/)
pnpm test:integration:run  # Integration tests (tests/integration/) — requires real PostgreSQL
pnpm test:all         # Both unit + integration
pnpm db:push          # Apply Drizzle schema to DB
pnpm db:seed          # Seed base data (roles, departments, config)
pnpm db:create-admin  # Create admin user
pnpm db:studio        # Drizzle Studio (visual DB browser)
```

## Verification

After making changes, run: `pnpm lint && pnpm test:run`

## Project Structure

- `src/app/` — Next.js App Router pages + API routes under `src/app/api/`
- `src/services/` — Business logic layer (called by API routes)
- `src/lib/db/schema/` — Drizzle schema (entry: `schema/index.ts`)
- `src/lib/db/index.ts` — DB client (postgres.js + drizzle)
- `src/lib/domain/` — Domain state machine, rules
- `src/lib/schemas/` — Zod validation schemas
- `src/components/` — React components (shadcn/ui in `components/ui/`)
- `src/middleware.ts` — Auth + route protection (NextAuth middleware)
- `src/auth.ts` — NextAuth configuration
- `drizzle/` — Generated SQL migrations
- `scripts/` — DB setup, seed, deploy, backup scripts
- `tests/unit/` — Unit tests (mocked DB)
- `tests/integration/` — Integration tests (real PostgreSQL)

## Path Aliases

- `@/` → `src/`
- `@/app/` → `src/app/`

## Testing

- Unit tests mock DB, next-auth, and next/navigation globally (see `tests/setup.ts`)
- Integration tests connect to a real PostgreSQL instance. Set `DATABASE_URL_TEST` in `.env.test` (copy from `.env.test.example`)
- Integration tests clean up test data automatically (rows with `metadata->>'test' = 'true'`)
- Unit test timeout: 30s. Integration test timeout: 15s.

## Database

- Schema entry: `src/lib/db/schema/index.ts` (exports auth, organizacion, solicitudes, balances, auditoria)
- Drizzle config: `drizzle.config.ts` — always appends `sslmode=require` to DATABASE_URL
- DB client in `src/lib/db/index.ts` auto-detects local vs remote and toggles SSL accordingly
- After schema changes: `pnpm db:generate` then `pnpm db:push` (or just `pnpm db:push` for dev)

## Environment

- `.env.local` — Local dev secrets (not committed). Copy from `.env.example`
- `.env.test` — Integration test DB (not committed). Copy from `.env.test.example`
- `.env.production` — Docker production. Copy from `.env.production.example`
- Auth secret: generate with `openssl rand -base64 32`

## RBAC Roles

Admin, RRHH, Jefe, Empleado — enforced in API routes via `src/services/rbac.service.ts`. Middleware only checks authentication; API routes enforce permissions.

## Deployment

Primary: Docker on AWS EC2 (`docker-compose.yml`). Standalone Next.js output (~120MB). Nginx reverse proxy. Deploy scripts: `scripts/setup-ec2.sh` (first time), `scripts/deploy-ec2.sh` (updates).

## Key Gotchas

- `pnpm dev` uses `--webpack` flag (not Turbopack)
- `next.config.mjs` uses `output: 'standalone'` — important for Docker builds
- Integration tests require a running PostgreSQL with the CNI schema (`pnpm db:install` or `pnpm db:push`)
- The `pnpm-workspace.yaml` exists but this is a single-package repo, not a monorepo
- shadcn components use `new-york` style with lucide icons — add via `npx shadcn@latest add <component>`
