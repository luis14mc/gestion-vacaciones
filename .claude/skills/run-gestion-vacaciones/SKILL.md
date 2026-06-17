---
name: run-gestion-vacaciones
description: Start and drive the vacation management web app (Next.js + React + PostgreSQL) for testing and development
---

# Run: Gestion de Vacaciones

Sistema de Gestión de Vacaciones y Permisos — a Next.js web application for managing vacation, leave, and permission requests at CNI (Honduras). The app is a full-stack system with React frontend, Next.js API routes, PostgreSQL backend, and NextAuth authentication.

This skill launches the dev server via the provided driver script, which offers a REPL for:
- Starting/stopping the server
- Taking HTML snapshots (for verification)
- Checking server status
- Navigating the running app via `http://localhost:3000`

---

## Prerequisites

- **Node.js**: 18+ (already installed; verify: `node --version`)
- **pnpm**: package manager (already installed; verify: `pnpm --version`)
- **PostgreSQL connection**: requires valid `DATABASE_URL` in `.env` (already configured in this project)

No additional OS packages needed on Windows.

---

## Build

The app is pre-built and dependencies installed. Verify:

```powershell
cd C:\Desarrollo\gestion-vacaciones
pnpm install  # Already run; this just verifies
```

No build step needed for dev mode — Next.js compiles on-the-fly.

---

## Run: Agent Path

**Launch the driver REPL** (auto-starts the dev server on port 3000):

```bash
node .claude/skills/run-gestion-vacaciones/driver.mjs
```

The driver outputs an interactive prompt. Available commands:

| Command | Description |
|---------|-------------|
| `launch` | Start the dev server (auto-runs on startup) |
| `ss` | Take an HTML snapshot (stdout shows filename) |
| `url` | Print the base URL (`http://localhost:3000`) |
| `status` | Check server readiness |
| `quit` | Exit and stop the server |
| `help` | Show available commands |

**Flow:**

```
> pnpm dev starts automatically
✓ Ready in 888ms
> ss                          [take a snapshot for verification]
Screenshot saved: ./skill-captures/app-2026-06-17T12-34-56.html
> quit                         [stop the server]
```

The server is ready for API calls and browser navigation at `http://localhost:3000`. See **Gotchas** below for headless browser testing.

---

## Run: Human Path

For manual testing (interactive browser):

```powershell
cd C:\Desarrollo\gestion-vacaciones
pnpm dev
```

Opens in development mode on `http://localhost:3000` — Webpack hot reload enabled. Press `Ctrl-C` to stop.

---

## How to Test the App

The app requires login (NextAuth integration). Default test flows:

1. **Access the login page:** Navigate to `http://localhost:3000`
   - You should see a login form (or redirect to auth page)
   
2. **Create a test user or use existing credentials:**
   - The database is seeded with test data
   - Check `scripts/seed-database.ts` for test credentials
   - Or create an admin user: `pnpm db:create-admin`

3. **Key pages to verify:**
   - `/` — Dashboard (requires auth)
   - `/solicitudes` — Request list
   - `/perfil` — User profile
   - `/reportes` — Reports (admin-only)

4. **API endpoints (for curl/Postman):**
   - `GET /api/auth/session` — Check auth status
   - `GET /api/users` — List users (admin-only)
   - `POST /api/solicitudes` — Create request (authenticated)

---

## Database Setup

The database connection is already configured in `.env`:

```bash
DATABASE_URL='postgresql://...'  # Neon (cloud PostgreSQL)
```

If you need to reinitialize:

```bash
pnpm db:push         # Apply schema migrations
pnpm db:seed         # Populate test data
pnpm db:create-admin # Create an admin user for testing
```

---

## Gotchas

### 1. **Headless screenshot doesn't capture rendered DOM**
   The driver's `ss` command saves the raw HTML response, not a Chromium screenshot. For visual verification:
   - Use a browser (Firefox, Chrome) pointed at `http://localhost:3000`
   - Or integrate Playwright/Puppeteer for pixel screenshots (not in this skill)

### 2. **Authentication required for most pages**
   - Login page is unauthenticated
   - All other routes redirect to `/auth/signin` if not logged in
   - Use credentials from `scripts/seed-database.ts` or create an admin

### 3. **Database must be reachable**
   - The `.env` DATABASE_URL points to Neon (cloud PostgreSQL)
   - If the connection fails, the app boots but API calls error
   - Check connectivity: `pnpm db:studio` to verify (Drizzle Studio)

### 4. **Port 3000 must be free**
   - If port is in use, the dev server fails to start
   - Change port: `PORT=3001 pnpm dev`
   - Update driver script if needed

### 5. **TypeScript/Next.js compiles on first request**
   - Initial request may be slow (20-30s) as webpack bundles
   - Subsequent requests are cached and instant
   - Check Next.js console for build progress

### 6. **Middleware deprecation warning**
   - You'll see a warning about the "middleware" file convention
   - This is non-fatal; the app runs normally
   - Scheduled for deprecation in a future Next.js release

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm: not found` | Install pnpm: `npm install -g pnpm` |
| `Port 3000 already in use` | Kill existing Node: `Get-Process node \| Stop-Process -Force` or use `PORT=3001` |
| `DATABASE_URL is undefined` | Verify `.env` file exists with a valid PostgreSQL connection string |
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not reachable; check `.env` DATABASE_URL or network connectivity |
| `[auth] callback server error` | Verify NextAuth configuration in `src/auth.ts`; check session/callback routes |
| Blank page after login | Browser cache issue; hard refresh (Ctrl-Shift-R) or clear cookies |
| API 500 errors in browser | Check Next.js dev server console for stack trace; rebuild if needed |

---

## Skill Captures

Screenshots and test outputs are saved to `./skill-captures/`. Clean up before committing:

```bash
rm -r skill-captures
```

---

## Code Structure

Paths are relative to `C:\Desarrollo\gestion-vacaciones\`:

- `src/` — Application code (React components, API routes)
  - `app/` — Next.js App Router pages
  - `components/` — Reusable React components
  - `lib/` — Utilities and database
  - `auth.ts` — NextAuth configuration
- `.env` — Environment variables (DATABASE_URL, etc.)
- `next.config.mjs` — Next.js configuration
- `package.json` — Dependencies and scripts
- `.claude/skills/run-gestion-vacaciones/` — This skill and driver

---

## Further Reading

- **Next.js docs:** https://nextjs.org/docs
- **NextAuth.js v5:** https://authjs.dev
- **Drizzle ORM:** https://orm.drizzle.team
- **React Hook Form:** https://react-hook-form.com/
- **PostgreSQL:** https://www.postgresql.org/docs
