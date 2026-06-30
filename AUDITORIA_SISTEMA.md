# Auditoría Exhaustiva — Sistema Gestión de Vacaciones CNI

**Fecha:** 2026-06-30  
**Evalúa:** Senior QA + Senior PM  
**Versión:** 0.1.0 | Next.js 16 + React 19 + PostgreSQL 16 + Drizzle ORM

---

## 1. BUILD & LINT — Estado

| Check | Estado | Detalle |
|-------|--------|---------|
| `pnpm test:run` | **PASS** | 23 archivos, 143 tests, 0 fallos (2.07s) |
| `pnpm lint` | **PASS** | 0 errores; warnings legacy en deuda técnica (`--max-warnings 500`) |
| `pnpm build` | **PASS** | Verificado 2026-06-19 (Next.js 16, sin DB en build) |

### Problema Crítico: ESLint roto — **RESUELTO (2026-06-19)**
- **Archivo:** `eslint.config.mjs`
- **Causa original:** Reglas `react/*` sin plugin registrado en flat config.
- **Fix aplicado:** `eslint-plugin-react` + `eslint-plugin-react-hooks` registrados; ignores para `.agents/` y scripts auxiliares.

---

## 2. SEGURIDAD — Análisis

### 2.1 Autenticación

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Provider | Credentials + JWT | `src/auth.ts:14-121` |
| Password hashing | bcryptjs (cost 10) | `src/services/usuarios.service.ts:106` |
| Rate limiting | Postgres-backed, fail-open | `src/lib/rate-limiter.ts` |
| Session expiry | Configurable via `seguridad.sesion_duracion_horas` | `src/auth.ts:128-132` |
| Audit login/logout | Implementado | `src/auth.ts:50-76, 177-189` |
| CSRF | NextAuth v5 (built-in) | Configurado |
| Password policy | Implementada | `src/lib/config/password-policy.ts` |

### 2.2 Autorización (RBAC)

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Modelo RBAC completo | Roles → Permisos (N:M) | `src/lib/db/schema/auth.ts:93-190` |
| Roles base | ADMIN, RRHH, DIRECTOR, JEFE, EMPLEADO | `src/services/rbac.service.ts:312-317` |
| Flags legacy sincronizados | `syncUserRoles` / `syncFlagsFromRoles` | `src/services/rbac.service.ts:339-444` |
| Middleware | Solo autenticación (no RBAC) | `src/middleware.ts` — correcto, RBAC en API |
| Guards por endpoint | State machine con guards | `src/lib/domain/state-machine.ts:78-125` |

### 2.3 Seguridad de Infraestructura

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Security headers | OWASP-completos | CSP, HSTS, X-Frame-Options DENY, etc. |
| Docker | Multi-stage build, ~150MB | `Dockerfile` |
| Services binding | 127.0.0.1 only | `docker-compose.yml` |
| SSL en DB | Auto-detecta local vs remote | `src/lib/db/index.ts:24-26` |
| Cron secret | Configurable | `CRON_SECRET` en `.env` |

### 2.4 Hallazgos de Seguridad

| # | Severidad | Hallazgo | Ubicación |
|---|-----------|----------|-----------|
| S1 | **MEDIA** | ~~`AUTH_SECRET=cambiar-en-desarrollo` en `.env.example`~~ — **Mitigado:** valor vacío + instrucción obligatoria | `.env.example` |
| S2 | **MEDIA** | `rejectUnauthorized: false` en conexión SSL a DB — acepta certificados autofirmados | `src/lib/db/index.ts:33` |
| S3 | **BAJA** | CSP permite `'unsafe-eval'` y `'unsafe-inline'` en scripts — reduce protección XSS | `next.config.mjs:42-43` |
| S4 | **BAJA** | Tabla `sessions` definida en schema pero auth usa JWT (no DB sessions) — tabla huérfana | `src/lib/db/schema/auth.ts:195-214` |
| S5 | **INFO** | Auditoría sanitiza passwords/tokens pero campos como `base64` y `documentos_adjuntos` se enmascaran siempre — puede dificultar debug | `src/lib/domain/auditoria/sanitize.ts:1-15` |

---

## 3. ARQUITECTURA & DISEÑO

### 3.1 Estructura del Código

| Capa | Evaluación |
|------|------------|
| Schema Drizzle | **Excelente** — 5 módulos, relations bien definidos, CHECK constraints, índices compuestos |
| Services | **Buena** — Separación clara: solicitudes, workflow, usuarios, RBAC, email, auditoría |
| Domain Logic | **Excelente** — State machine pura, balance effects aislados, feriados, cumpleanos |
| API Routes | **Buena** — RESTful, auth check, auditoría, error handling consistente |
| Frontend | **Adecuada** — shadcn/ui, componentes client/server separados |

### 3.2 State Machine

- **Implementación:** `src/lib/domain/state-machine.ts` — Máquina de estados finitos pura
- **Estados:** 8 (borrador → pendiente_jefe → aprobada_jefe → aprobada_rrhh → finalizada)
- **Guards:** 4 tipos (propietario, jefe, RRHH, sistema)
- **Efectos:** RESERVAR_BALANCE, CONFIRMAR_BALANCE, LIBERAR_BALANCE — atómicos dentro de transacción
- **Evaluación:** **Sólida** — Separación limpia entre definición de transiciones y persistencia

### 3.3 Balance Management

- **Triggers DB:** `cantidad_disponible` calculado por trigger en PostgreSQL
- **Optimistic locking:** Campo `version` en solicitudes y balances
- **Convención:** pendiente → usada → liberada (flujo correcto)
- **Evaluación:** **Correcto** — Los efectos de balance ahora se ejecutan atómicamente dentro de la transacción del workflow (`workflow.service.ts:231-244`)

### 3.4 Deuda Técnica Identificada

| # | Impacto | Descripción |
|---|---------|-------------|
| D1 | **MEDIO** | ~~Funciones deprecated en `solicitudes.service.ts`~~ — **Eliminadas**; workflow vía `ejecutarAccion` | Resuelto 2026-06-19 |
| D2 | **MEDIO** | RBAC dual: flags booleanos en `usuarios` + tabla `usuarios_roles` — `syncUserRoles`/`syncFlagsFromRoles` mitigan pero aumentan complejidad |
| D3 | **BAJO** | `sessions` table definida pero auth es JWT-only — tabla sin uso |
| D4 | **BAJO** | `rate_limits` es postgres-backed (correcto para multi-instancia) pero el esquema Drizzle no lo exporta — se usa raw SQL |

---

## 4. TESTING

### 4.1 Cobertura

| Tipo | Archivos | Tests | Estado |
|------|----------|-------|--------|
| Unit | 23 | 143 | **Todos pasan** |
| Integration | 1 | — | Requiere DB real |
| **Total** | **24** | **143** | **100% pass** |

### 4.2 Módulos Cubiertos

| Módulo | Tests | Evaluación |
|--------|-------|------------|
| State machine | 39 tests | **Completa** — todos los caminos |
| Balance display/consumo | 12 tests | **Buena** |
| Cumpleaños | 17 tests | **Exhaustiva** |
| Adjuntos | 7 tests | **Buena** |
| Auditoría | 8 tests | **Buena** |
| Reportes | 13 tests | **Buena** |
| Exportación | 7 tests | **Buena** |
| Feriados | 5 tests | **Buena** |
| Password | 4 tests | **Adecuada** |
| Config catalog | 11 tests | **Buena** |
| Services (solicitudes, usuarios) | 6 tests | **Mínima** — solo happy path |

### 4.3 Brechas de Testing

| # | Severidad | Brecha |
|---|-----------|--------|
| T1 | **ALTA** | ~~Sin tests de integración para `workflow.service.ts`~~ — **Parcial:** suite dedicada + tests existentes en `solicitudes.service.integration.test.ts` |
| T2 | **ALTA** | Sin tests para API routes (endpoints) — solo tests unitarios de lógica |
| T3 | **MEDIA** | Sin tests para `email.service.ts` (mockear SMTP) |
| T4 | **MEDIA** | Sin tests para `rbac.service.ts` (asignación/sync de roles) |
| T5 | **BAJA** | Sin tests de componentes React (solo unitarios de lógica pura) |

---

## 5. DEPENDENCIAS & CONFIGURACIÓN

### 5.1 Stack Tecnológico

| Dependencia | Versión | Evaluación |
|-------------|---------|------------|
| Next.js | 16.2.6 | Última stable |
| React | 19.2.0 | Última stable |
| TypeScript | 5.9.3 | Última |
| Drizzle ORM | 0.44.7 | Estable |
| NextAuth | 5.0.0-beta.30 | **BETA** — override en pnpm |
| PostgreSQL | 16 | LTS |
| Tailwind CSS | 4.1.17 | Última |
| Vitest | 4.0.17 | Última |

### 5.2 Alertas de Dependencias

| # | Severidad | Detalle |
|---|-----------|---------|
| P1 | **ALTA** | `next-auth@5.0.0-beta.30` es beta — forzado con `pnpm.overrides`. Riesgo de breaking changes sin fix upstream |
| P2 | **BAJA** | `sileo@0.1.5` — paquete desconocido, verificar si es necesario |
| P3 | **INFO** | `@types/pg` en devDeps pero el proyecto usa `postgres` (postgres.js), no `pg` |

---

## 6. RUTAS & COBERTURA DE FUNCIONALIDADES

### 6.1 Páginas (16 rutas)

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/login` | Auth | OK |
| `/dashboard` | Métricas | OK |
| `/solicitudes` | Bandeja | OK |
| `/solicitudes/nueva` | Crear | OK |
| `/aprobar-solicitudes` | Jefe/RRHH | OK |
| `/mi-balance` | Balance | OK |
| `/mi-equipo` | Equipo | OK |
| `/mi-perfil` | Perfil | OK |
| `/usuarios` | CRUD Admin | OK |
| `/departamentos` | CRUD Admin | OK |
| `/auditoria` | Log Admin | OK |
| `/reportes` | Reportes | OK |
| `/reportes-departamento` | Reportes depto | OK |
| `/exportar` | Exportación | OK |
| `/configuracion` | Config Admin | OK |
| `/asignacion-dias` | Asignación Admin | OK |

### 6.2 APIs (28+ rutas)

Todas las rutas críticas implementadas: auth, CRUD usuarios, solicitudes, balances, dashboard, auditoría, reportes, exportación, configuración, cron.

### 6.3 Rutas no cubiertas por Middleware

| Ruta | Protegida por middleware | Protegida por API auth |
|------|--------------------------|------------------------|
| `/cambiar-password` | **Sí** (matcher) | Sí (API interna) |
| `/mi-balance` | **Sí** (matcher) | Sí |

**Riesgo bajo** — estas rutas usan `getSession()` internamente, pero el middleware no las protege a nivel de redirect.

---

## 7. RENDIMIENTO & OBSERVABILIDAD

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Health check | Implementado | `GET /api/health` — verifica DB |
| DB pooling | Configurado | `max: 10, idle_timeout: 20s` |
| PostgreSQL tuning | Optimizado para t3.medium | shared_buffers=256MB, max_connections=50 |
| Memory limits | Docker limits configurados | App: 896MB, DB: 640MB, Nginx: 64MB |
| Logging | Solo `console.error` | Sin sistema estructurado (winston/pino) |
| Métricas | Dashboard interno | Métricas por rol (admin/rrhh/jefe) |

---

## 8. RESUMEN EJECUTIVO

### Fortalezas

1. **State machine robusta** — Guards granulares, efectos atómicos, transiciones bien definidas
2. **RBAC completo** — Roles, permisos, sincronización flags↔RBAC
3. **Testing unitario sólido** — 143 tests, 100% pass, cobertura de lógica de negocio
4. **Seguridad perimetral** — Headers OWASP, rate limiting, auditoría, sanitización
5. **Arquitectura limpia** — Separación schema/services/domain/API bien ejecutada
6. **Infraestructura Docker** — Multi-stage, optimizada para EC2 t3.medium

### Riesgos Críticos

| # | Área | Riesgo | Impacto |
|---|------|--------|---------|
| 1 | **CI/CD** | ~~ESLint roto~~ | **Mitigado** — lint ejecutable en pipeline |
| 2 | **Testing** | Cobertura integración workflow ampliada; API routes pendientes | Regresiones en endpoints aún posibles |
| 3 | **Dependencia** | next-auth beta — override forzado | Breaking changes sin workaround |

### Recomendaciones Prioritarias (PM)

1. **Fix ESLint** (1 día) — Desbloquea CI/CD
2. **Tests integración workflow** (2-3 días) — Cubrir el camino crítico: crear → enviar → aprobar jefe → aprobar RRHH → finalizar
3. **Evaluar next-auth stable** (1 día) — Verificar si ya hay release stable para v5
4. **Eliminar código deprecated** (1 día) — `aprobarSolicitudJefe/RRHH/rechazar/cancelar` → deletar o mover a test-only
5. **Tests API routes** (3-5 días) — Cubrir endpoints críticos con supertest o similar

### Calificación General

| Dimensión | Nota (1-10) |
|-----------|-------------|
| Arquitectura | **8.5** |
| Seguridad | **7.5** |
| Testing | **7.0** (unit sólido + integración workflow ampliada) |
| Code Quality | **7.5** (ESLint operativo; legacy deprecated eliminado) |
| Documentación | **8.0** (AGENTS.md, AUDITORIA.md, schema docs) |
| Deploy readiness | **7.5** (lint + build + tests verdes) |
| **Global** | **7.6/10** |

---

*Auditoría realizada por opencode (AI Senior QA & PM) — 2026-06-30*

---

## 9. Plan de remediación ejecutado (2026-06-19)

**Equipo:** PM + Backend + Frontend + QA

### Decisión de sprint (priorización PM)

| Prioridad | Ítem | Owner | Estado |
|-----------|------|-------|--------|
| P0 | ESLint roto (bloquea CI) | Frontend | ✅ Resuelto |
| P1 | Middleware sin `/mi-balance` y `/cambiar-password` | Backend | ✅ Resuelto |
| P1 | `AUTH_SECRET` débil en `.env.example` (S1) | Backend | ✅ Resuelto |
| P2 | Eliminar workflow legacy deprecated (D1) | Backend | ✅ Resuelto |
| P2 | Tests integración workflow (T1) | QA | ✅ Ampliado |
| P3 | Tests API routes (T2) | QA | ⏳ Backlog |
| P3 | Evaluar next-auth stable (P1) | Backend | ⏳ Backlog |
| P3 | Logging estructurado | Backend | ⏳ Backlog |

### Cambios aplicados

1. **ESLint (`eslint.config.mjs`)** — Registrados `eslint-plugin-react` y `eslint-plugin-react-hooks`; excluidos `.agents/`, `scripts/`, vendor auxiliar. `pnpm lint` termina con **0 errores** (warnings legacy tolerados con `--max-warnings 500`).
2. **Middleware** — Añadidos `/mi-balance` y `/cambiar-password` al matcher; redirect a login sin sesión.
3. **Seguridad** — `.env.example`: `AUTH_SECRET` vacío con instrucción obligatoria de generación (`openssl rand -base64 32`).
4. **Deuda D1** — Eliminadas `aprobarSolicitudJefe`, `aprobarSolicitudRRHH`, `rechazarSolicitud`, `cancelarSolicitud` de `solicitudes.service.ts`. Vía viva: `workflow.service.ts` → `ejecutarAccion`.
5. **QA** — Nuevo `tests/integration/workflow.service.integration.test.ts`: camino crear → jefe → RRHH → finalizar + cancelación con liberación de balance. Rol `ADMIN` en `test-data` helper.
6. **Build** — `pnpm build` verificado OK (sin DB en runtime de build).

### Verificación post-remediación

| Check | Resultado |
|-------|-----------|
| `pnpm test:run` | 143 tests, 0 fallos |
| `pnpm lint` | 0 errores, warnings legacy |
| `pnpm build` | OK |

### Backlog acordado (próximo sprint)

- Tests de integración/API para rutas críticas (`/api/solicitudes`, `/api/solicitudes/[id]/accion`).
- Revisión de `next-auth@5.0.0-beta.30` cuando exista release stable.
- Documentar/decidir destino de tabla `sessions` (D3) y exportar schema `rate_limits` en Drizzle (D4).
- Endurecer CSP (`unsafe-inline` / `unsafe-eval`) cuando el bundle lo permita (S3).
- Tests `rbac.service` y `email.service` con mocks (T3, T4).

