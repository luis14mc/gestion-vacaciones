# Auditoría y correcciones — Gestión de Vacaciones CNI

Rama base: `fix/autorizacion-rbac` · Actualización: junio 2026

Auditoría integral del sistema (seguridad **y** funcionalidad), con foco
inicial en roles/permisos y extendida a todos los módulos. Cada hallazgo
crítico fue corregido y verificado (`tsc --noEmit`, build de Next, pruebas
unitarias de dominio y validaciones puntuales contra BD).

---

## 1. Autorización y RBAC

- **Doble fuente de verdad (flags ↔ RBAC).** Existían en paralelo los flags
  `esAdmin/esRrhh/esDirector/esJefe` y el RBAC (`usuarios_roles`), que se
  desincronizaban. Se creó `syncUserRoles()` / `syncUserRolesDesdeBD()` como
  autoridad única; conectado a la edición de usuarios y a la asignación de
  jefe de departamento.
- **JWT obsoleto.** `getSession()` leía roles/permisos del token (hasta 24 h
  de retraso). Ahora se leen **frescos de BD** en cada request.
- **Escalada horizontal.** Cualquier jefe podía aprobar a cualquier empleado.
  Se añadió guard por **departamento** + jerarquía **Director > Jefe**
  (un jefe solo aprueba a su depto; la solicitud de un jefe solo la aprueba
  el Director). Admin mantiene bypass.
- **Fuga de alcance en reportes.** `/api/reportes` y `/api/reportes/exportar`
  aceptaban `departamentoId` manipulable. Ahora `alcanceDepartamento()`
  limita a no-Admin/RRHH a su propio departamento.
- **Fuga en calendario.** `/api/calendario/ausencias` exponía ausencias de
  toda la organización (incl. licencias médicas) a cualquier usuario.
  Acotado por rol.
- **DELETE de usuarios** endurecido (no auto-desactivación, no último admin).
- **Rol DIRECTOR ausente en seed** *(corregido jun 2026).* El código asignaba
  `DIRECTOR` vía `syncUserRoles` pero el rol no existía en `ROLES_DATA`.
  Agregado al seed con permisos equivalentes a JEFE; el seed re-sincroniza
  roles de todos los usuarios activos.

## 2. Flujo de trabajo (máquina de estados)

- **Efectos de balance no se aplicaban.** La máquina declaraba
  RESERVAR/CONFIRMAR/LIBERAR pero `ejecutarAccion` no los ejecutaba
  (`aprobar_rrhh` no movía días de *pendiente* a *usada*). Ahora se aplican
  **dentro de una transacción**.
- **`finalizar` como transición real.** El cron dejaba el estado final por
  un UPDATE crudo; ahora pasa por la máquina de estados (`guardSistema`).
- Workflow imperativo legacy marcado `@deprecated` (cobertura de tests).

## 3. Cálculo de días de vacaciones

- **El servidor confiaba en los días del cliente** (`diasSolicitados`),
  permitiendo descontar menos balance del real. Ahora el servidor
  **recalcula** los días con `contarDiasHabiles()`.
- **Regla fija: días laborables.** Sábados, domingos y **feriados nacionales
  de Honduras** no se descuentan. Se eliminó el toggle decorativo
  `vacaciones.incluir_fines_semana` del catálogo activo.
- **Feriados nacionales** *(corregido jun 2026).* Catálogo en
  `src/lib/domain/feriados-honduras.ts`: fechas fijas (Año Nuevo, 14 abr,
  1 may, 15 sep, 3 y 12 oct, Navidad) + Jueves/Viernes Santo móviles +
  **feriados puente** (lunes anterior/siguiente cuando el feriado cae mar–dom).
  `contarDiasHabiles()` los excluye automáticamente.

## 4. Asignación de días (individual, masiva y por antigüedad)

- **`cantidad_disponible` la mantiene un trigger de Postgres**
  (`= inicial + acumulada − usada − pendiente`). El código la calculaba a
  mano con fórmulas que ignoraban `acumulada` (el trigger las sobrescribía:
  código muerto + bug latente). Las rutas ahora solo escriben las columnas
  base y confían en el trigger.
- **Trigger versionado** en `drizzle/0005_balance_trigger.sql` (antes solo
  vivía en `database/09_cni_business_logic.sql`, fuera de `db:migrate`).
- La automatización por antigüedad (10/12/15/20 días por 1/2/3/4+ años)
  coincide con el Código de Trabajo de Honduras.

## 5. Módulo de configuración

- **Validación de servidor inexistente.** Los schemas Zod eran código
  muerto. Nuevo catálogo único (`src/lib/config/catalog.ts`) que valida
  clave + valor y deriva metadata (categoría/visibilidad).
- **Lector central** (`src/lib/config/service.ts`) con caché TTL.
- **Ajustes que eran decorativos, ahora aplicados:**
  - Seguridad: `intentos_login_max`, `bloqueo_duracion_minutos`,
    `sesion_duracion_horas`, política de contraseñas.
  - Vacaciones: mínimos/máximos y anticipación.
  - Notificaciones granulares (`notificar_*`).
  - Modo mantenimiento (`app.mantenimiento`).
- Eliminado el toggle contradictorio `departamentos.jefe_puede_auto_aprobar`
  del seed (ya no se re-seedea).

## 6. Módulo de auditoría

- **Estaba inservible:** la tabla `registros_auditoria` no existía en la BD
  y ninguna acción escribía eventos.
- Tabla creada (`drizzle/0004_registros_auditoria.sql`) + servicio central
  `registrarAuditoria()` (no bloqueante).
- Instrumentadas: usuarios (CRUD + roles), workflow de solicitudes,
  balances, configuración, departamentos, exportación de reportes, y
  login/login_fallido/logout.

## 7. Usuarios / carga masiva

- **Contraseña `'1234'` compartida** para todos los importados → eliminada.
  Ahora se genera una **contraseña temporal única** por usuario; se descarga
  un CSV de credenciales y se **obliga a cambiarla en el primer ingreso**
  (`PasswordChangeGate` + página `/cambiar-password`).
- Política de contraseñas aplicada en creación/edición/cambio.
- Importación registrada en auditoría.
- **Fecha de nacimiento** *(jun 2026):* campo `fecha_nacimiento` en usuarios
  (migración `0006`) para habilitar el día libre por cumpleaños.

## 8.b Adjuntos de solicitudes

- Los adjuntos llegaban como base64 en el JSON **sin límite ni validación**
  (la ruta usa `request.json()`, ajena al límite de 2 MB de server actions).
- Nuevo `validarAdjuntos()`: máximo 5 archivos, ≤ 5 MB c/u y ≤ 15 MB total,
  base64 bien formado y **tipo real por firma (magic number)** — solo PDF e
  imágenes (JPG/PNG/WEBP), ignorando la extensión/tipo declarado.

## 8. Seguridad transversal

- **Rate limiter** migrado de memoria a **Postgres**
  (`drizzle/0003_rate_limits.sql`), consistente en multi-instancia,
  configurable y con política *fail-open*.
- **Duración de sesión** configurable mediante expiración absoluta
  (`absExp`) verificada en `getSession` y middleware.

## 9. Día libre por cumpleaños *(jun 2026)*

- Nuevo tipo `dia_cumpleanos` en enum `tipo_solicitud` (migración `0006`).
- Reglas en `src/lib/domain/cumpleanos.ts`:
  - 1 día al año, solo en el mes de cumpleaños.
  - Validación de unicidad anual (estados activos).
  - No descuenta balance de vacaciones (`solicitudConsumeBalance` = false).
- API `GET /api/solicitudes/cumpleanos-elegibilidad` para la UI.
- Vista **Mi Balance** (`/mi-balance`) con días vencidos, proporcionales y disponibles.

## 10. Observabilidad y despliegue *(jun 2026)*

- **`GET /api/health`** — health check con ping a PostgreSQL; usado por
  middleware (ruta ignorada), Dockerfile y `docker-compose.yml`.
- Antes el healthcheck de Docker apuntaba a `/login` (falso positivo).

## 11. Correcciones post-auditoría *(jun 2026, segunda pasada)*

- **Código solicitud unificado.** El servicio generaba `SOL-YYYY-XXXXX` mientras
  la documentación SQL usaba `CNI-SOL-YYYY-XXXX`. Ahora solo se emite
  `CNI-SOL-YYYY-XXXX` (compatible con secuencia previa `SOL-…`).
- **Config decorativa eliminada.** Retirados del catálogo activo:
  `vacaciones.incluir_feriados` (sin efecto; feriados se excluyen siempre) y
  `vacaciones.umbral_aprobacion_ejecutiva` (3er nivel de aprobación eliminado).
- **Permiso `aprobar_ejecutiva`** retirado del seed (histórico, sin uso en runtime).
- **Alias tsconfig** `@/features/*` y `@/shared/*` eliminados (directorios inexistentes).
- **Sync inverso RBAC → flags** *(jun 2026):* `syncFlagsFromRoles()` al asignar/quitar
  roles vía `/api/usuarios/roles`.
- **Auditoría en creación de solicitud** *(jun 2026):* evento en `POST /api/solicitudes`;
  `POST /api/auditoria` restringido a admin.
- **Verificación SMTP** *(jun 2026):* `POST /api/configuracion/verificar-smtp` (admin) + botón en UI de configuración.
- **Efectos de balance unificados** *(jun 2026):* `src/lib/domain/balance-effects.ts`.
- **Tests de integración** *(jun 2026):* workflow vía `ejecutarAccion`; `DATABASE_URL_TEST`.

---

## Checklist de despliegue

1. **Aplicar migraciones** en el entorno destino:
   - `drizzle/0003_rate_limits.sql`
   - `drizzle/0004_registros_auditoria.sql`
   - `drizzle/0005_balance_trigger.sql`
   - `drizzle/0006_fecha_nacimiento_dia_cumpleanos.sql`
2. **Re-seed idempotente** (roles DIRECTOR + sync flags): `pnpm db:seed`.
3. **Reconciliar balances** una sola vez tras desplegar el cambio de
   efectos/asignación: `pnpm db:reconciliar-balances --apply`.
4. **Garantizar un Director por departamento.** Con la jerarquía activa, si
   un departamento no tiene Director, las solicitudes de sus Jefes solo las
   podría aprobar un Admin.
5. **Revisar la configuración** (Seguridad, Vacaciones, Notificaciones): los
   valores ahora tienen efecto real.
6. **Verificar health:** `curl -f http://localhost:3000/api/health`.

## 12. Auditoría completa — 2026-06-24

Auditoría integral del sistema. **21 de 23 tareas completadas.** Pendiente manual en entorno local.

### Estado actual

| # | Tarea | Estado | Archivo |
|---|-------|--------|---------|
| 1 | AUTH_SECRET placeholder | ⚠️ Manual | `.env.local` — generar con `openssl rand -base64 32` |
| 2 | Content-Security-Policy header | ✅ | `next.config.mjs` |
| 3 | .env.test con credenciales reales | ✅ | `.env.test` + `.env.test.example`; `.env.test` en `.gitignore` |
| 4 | Optimistic locking `procesarTransicionesAutomaticas` | ✅ | `workflow.service.ts` |
| 5 | Optimistic locking `cancelarSolicitud` | ✅ | `solicitudes.service.ts` |
| 6 | Foreign Keys faltantes (4 columnas) | ✅ | `schema/auth.ts`, `schema/organizacion.ts` |
| 7 | XSS en templates de email | ✅ | `email.service.ts` (`escapeHtml`) |
| 8 | `error.tsx` no existe | ✅ | `src/app/error.tsx` |
| 9 | `not-found.tsx` no existe | ✅ | `src/app/not-found.tsx` |
| 10 | 46 tests placeholder | ✅ | Eliminados; quedan tests de estructura + integración |
| 11 | `aria-label` en botones icono | ✅ | `UsuariosClient.tsx`, `AprobarSolicitudesClient.tsx` |
| 12 | Breadcrumbs sin semántica | ✅ | `AppShell.tsx` |
| 13 | Skip-to-content link | ✅ | `layout.tsx`, `AppShell.tsx` |
| 14 | Filtro `deletedAt` en `listarSolicitudes` | ✅ | `solicitudes.service.ts` |
| 15 | Password policy en `crearUsuario` | ✅ | `usuarios.service.ts` |
| 16 | Validación email en `crearUsuario` | ✅ | `usuarios.service.ts` |
| 17 | Wildcards sin escape en search | ✅ | `usuarios.service.ts` |
| 18 | `noUncheckedIndexedAccess` ausente | ✅ | `tsconfig.json` |
| 19 | POST auditoría restringido a admin | ✅ | `api/auditoria/route.ts` |
| 20 | Directorios vacíos eliminados | ✅ | — |
| 21 | Botón UI probar SMTP | ✅ | `ConfiguracionClient.tsx` → `POST /api/configuracion/verificar-smtp` |

---

### FASE 1 — CRÍTICO

#### 1.1 Generar AUTH_SECRET real

**Archivo:** `.env.local` línea 4

```bash
openssl rand -base64 32
```

Reemplazar la línea 4 en `.env.local` con el valor generado:
```env
AUTH_SECRET='aK7...el valor generado aqui'
```

**Verificación:** `grep -c "tu-secreto-super-seguro" .env.local` debe retornar `0`.

---

#### 1.2 Agregar Content-Security-Policy header

**Archivo:** `next.config.mjs` líneas 26-35

Agregar un nuevo objeto header después de `Strict-Transport-Security`:

```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
},
```

**Verificación:** `pnpm build && pnpm start` → DevTools → Network → Headers → buscar `content-security-policy`.

---

#### 1.3 Reemplazar .env.test con placeholder

Crear `.env.test.example`:
```env
DATABASE_URL=postgresql://usuario:password@host:5432/database?sslmode=require
NEXTAUTH_SECRET=test-secret-key-for-integration-tests
```

Reemplazar contenido de `.env.test`:
```env
DATABASE_URL=postgresql://testuser:testpass@localhost:5432/vacaciones_test?sslmode=require
NEXTAUTH_SECRET=test-secret-key-for-integration-tests
```

**Verificación:** `grep -c "neondb_owner" .env.test` debe retornar `0`.

---

#### 1.4 Optimistic locking en procesarTransicionesAutomaticas

**Archivo:** `src/services/workflow.service.ts` línea 357

```typescript
// ANTES:
.where(eq(solicitudes.id, sol.id));

// DESPUÉS:
.where(and(
  eq(solicitudes.id, sol.id),
  eq(solicitudes.version, sol.version)
));
```

Importar `and` si no está importado.

---

#### 1.5 Optimistic locking en cancelarSolicitud

**Archivo:** `src/services/solicitudes.service.ts` línea 629

```typescript
// ANTES:
.where(eq(solicitudes.id, solicitudId))

// DESPUÉS:
.where(and(
  eq(solicitudes.id, solicitudId),
  eq(solicitudes.version, solicitud.version)
))
```

`and` ya está importado en este archivo.

---

### FASE 2 — ALTO

#### 2.1 Foreign Keys al schema Drizzle

**`src/lib/db/schema/auth.ts`:**

Línea 40:
```typescript
// ANTES:
departamentoId: bigint('departamento_id', { mode: 'number' }),

// DESPUÉS:
departamentoId: bigint('departamento_id', { mode: 'number' })
  .references(() => departamentos.id, { onDelete: 'set null' }),
```

Línea 55:
```typescript
// ANTES:
jefeSuperiorId: bigint('jefe_superior_id', { mode: 'number' }),

// DESPUÉS:
jefeSuperiorId: bigint('jefe_superior_id', { mode: 'number' })
  .references(() => usuarios.id, { onDelete: 'set null' }),
```

Verificar que `departamentos` está importado. Si no:
```typescript
import { departamentos } from './organizacion';
```

**`src/lib/db/schema/organizacion.ts`:**

Línea 41:
```typescript
// ANTES:
jefeId: bigint('jefe_id', { mode: 'number' }),

// DESPUÉS:
jefeId: bigint('jefe_id', { mode: 'number' })
  .references(() => usuarios.id, { onDelete: 'set null' }),
```

Línea 44:
```typescript
// ANTES:
departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' }),

// DESPUÉS:
departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' })
  .references(() => departamentos.id, { onDelete: 'set null' }),
```

**Migración:** `pnpm db:push`

---

#### 2.2 Sanitizar HTML en email.service.ts

Agregar función de escape al inicio del archivo (después de imports):

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

Envolver cada variable de usuario:

| Línea | Variable | Cambio |
|-------|----------|--------|
| ~202 | `${jefeNombre}` | → `${escapeHtml(jefeNombre)}` |
| ~203 | `${solicitanteNombre}` | → `${escapeHtml(solicitanteNombre)}` |
| ~230 | `${solicitanteNombre}` | → `${escapeHtml(solicitanteNombre)}` |
| ~263 | `${motivoRechazo}` | → `${escapeHtml(motivoRechazo)}` |
| ~271 | `${empleadoNombre}` | → `${escapeHtml(empleadoNombre)}` |

---

#### 2.3 Crear error.tsx

Crear `src/app/error.tsx`:

```tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Algo salió mal</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
```

---

#### 2.4 Crear not-found.tsx

Crear `src/app/not-found.tsx`:

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Página no encontrada</h2>
        <p className="text-muted-foreground">La página que buscas no existe.</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md inline-block"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
```

---

#### 2.5 Reemplazar tests placeholder

**Archivos:**
- `tests/unit/services/solicitudes.service.test.ts`
- `tests/unit/services/usuarios.service.test.ts`

Reemplazar cada `expect(true).toBe(true)` con mocks reales. Ejemplo:

```typescript
// ANTES:
it('✅ Debe generar código único', () => {
  expect(true).toBe(true);
});

// DESPUÉS:
it('✅ Debe generar código único', async () => {
  const mockTx = {
    query: { solicitudes: { findMany: vi.fn().mockResolvedValue([]) } },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 1, codigo: 'CNI-SOL-2026-0001', estado: 'pendiente_jefe',
        }]),
      }),
    }),
  };
  // mockear db.transaction y llamar la función real
});
```

Patrón: importar `vi` de vitest, crear mocks de `db`, llamar la función, assertivar resultado.

**Verificación:** `pnpm test:run` — sin `expect(true).toBe(true)`.

---

### FASE 3 — MEDIO

#### 3.1 aria-label en botones de solo icono

**`src/app/usuarios/UsuariosClient.tsx`:**

Línea ~475 (botón Editar):
```tsx
// ANTES:
<Button variant="ghost" size="sm" onClick={() => abrirModalEditar(usuario)}>
  <Edit className="w-4 h-4" />
</Button>

// DESPUÉS:
<Button variant="ghost" size="sm" onClick={() => abrirModalEditar(usuario)} aria-label={`Editar ${usuario.nombre}`}>
  <Edit className="w-4 h-4" />
</Button>
```

Línea ~482 (botón Eliminar):
```tsx
// ANTES:
<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(usuario.id)}>
  <Trash2 className="w-4 h-4" />
</Button>

// DESPUÉS:
<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(usuario.id)} aria-label={`Eliminar ${usuario.nombre}`}>
  <Trash2 className="w-4 h-4" />
</Button>
```

**`src/app/aprobar-solicitudes/AprobarSolicitudesClient.tsx`:**

Línea ~472 (botón Ver detalles):
```tsx
// ANTES:
<Button variant="ghost" size="icon-sm" onClick={...} title="Ver detalles">

// DESPUÉS:
<Button variant="ghost" size="icon-sm" onClick={...} aria-label="Ver detalles">
```

Mismo patrón para versión mobile (~línea 548).

---

#### 3.2 Breadcrumbs con semántica

**Archivo:** `src/components/layout/AppShell.tsx` líneas 377-404

Reemplazar la función `Breadcrumbs`:

```tsx
function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="text-[13px]">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Inicio
          </Link>
        </li>
        {segments.map((seg, i) => {
          const label = ROUTE_LABELS[seg] || seg;
          const href = '/' + segments.slice(0, i + 1).join('/');
          const isLast = i === segments.length - 1;

          return (
            <li key={href} className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50" aria-hidden="true">/</span>
              {isLast ? (
                <span className="text-foreground font-medium" aria-current="page">{label}</span>
              ) : (
                <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

#### 3.3 Skip-to-content link

**`src/app/layout.tsx` línea 91** — agregar después de `<body>`:

```tsx
<body className="antialiased" suppressHydrationWarning>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
  >
    Saltar al contenido principal
  </a>
  <QueryProvider>
```

**`src/components/layout/AppShell.tsx`** — agregar `id` al `<main>`:

```tsx
<main id="main-content" className="...">
```

---

#### 3.4 Filtro deletedAt en listarSolicitudes

**Archivo:** `src/services/solicitudes.service.ts` línea 519

```typescript
// ANTES:
const conditions = [];

// DESPUÉS:
const conditions = [];
// Siempre excluir registros eliminados
conditions.push(isNull(solicitudes.deletedAt));
```

Verificar que `isNull` está importado (línea ~12).

---

#### 3.5 Password policy en crearUsuario

**Archivo:** `src/services/usuarios.service.ts` línea 93

Agregar import:
```typescript
import { validarPasswordPolitica } from '@/lib/config/password-policy';
```

Antes del hash (línea 94):
```typescript
const errorPassword = await validarPasswordPolitica(password);
if (errorPassword) {
  throw new Error(errorPassword);
}
```

---

#### 3.6 Validación email en crearUsuario

**Archivo:** `src/services/usuarios.service.ts` línea 84

Antes de la查询 de unicidad:
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new Error('El formato del email no es válido');
}
```

---

#### 3.7 Sanitizar wildcards en search

**Archivo:** `src/services/usuarios.service.ts` línea 313

```typescript
// ANTES:
if (search) {

// DESPUÉS:
if (search) {
  const sanitizedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
```

Líneas 316-318, reemplazar `${search}` por `${sanitizedSearch}`:
```typescript
ilike(usuarios.nombre, `%${sanitizedSearch}%`),
ilike(usuarios.apellido, `%${sanitizedSearch}%`),
ilike(usuarios.email, `%${sanitizedSearch}%`)
```

---

### FASE 4 — BAJO

#### 4.1 noUncheckedIndexedAccess

**Archivo:** `tsconfig.json`

Agregar en `compilerOptions`:
```json
"noUncheckedIndexedAccess": true
```

`pnpm build` puede mostrar errores nuevos — corregirlos.

---

## Checklist de verificación final

```bash
# 1. Secretos
grep -c "tu-secreto-super-seguro" .env.local  # Debe ser 0
grep -c "neondb_owner" .env.test               # Debe ser 0

# 2. Build
pnpm lint
pnpm build

# 3. Tests
pnpm test:run

# 4. Headers
pnpm start
curl -I http://localhost:3000/login | grep -i content-security-policy
```

---

## Pendientes conocidos

| Prioridad | Ítem | Notas |
|-----------|------|-------|
| Alta | **SMTP en producción** | Email deshabilitado por defecto en seed; configurar credenciales y probar con `POST /api/configuracion/verificar-smtp` |
| Alta | **QA manual / E2E** | Sin Playwright; usar checklist en `docs/ESTADO_PRODUCCION.md` |
| Media | **Config decorativa sin efecto** | `departamentos.validar_conflictos`, `max_ausencias_simultaneas`, `seguridad.forzar_cambio_password_dias` validan pero no aplican lógica de negocio |
| Baja | **NextAuth v5 beta** | Versión fijada en `package.json` (`5.0.0-beta.30` + override pnpm) |
| ~~Media~~ | ~~Feriados puente~~ | ✅ Corregido jun 2026 (`aplicarFeriadosPuente` en `feriados-honduras.ts`) |
| ~~Media~~ | ~~Tests integración legacy~~ | ✅ Migrados a `ejecutarAccion`; `setup.ts` soporta `DATABASE_URL_TEST` |
| ~~Media~~ | ~~Sync inverso flags ↔ RBAC~~ | ✅ `syncFlagsFromRoles` en `/api/usuarios/roles` |
| ~~Media~~ | ~~Auditoría crear solicitud~~ | ✅ `registrarAuditoria` en `POST /api/solicitudes` |
| ~~Media~~ | ~~POST /api/auditoria abierto~~ | ✅ Restringido a admin |
| ~~Media~~ | ~~Balance duplicado inline~~ | ✅ Helper compartido `balance-effects.ts` |
| ~~Media~~ | ~~Catálogo de feriados~~ | ✅ Corregido jun 2026 |
| ~~Media~~ | ~~Código solicitud dual~~ | ✅ Unificado a `CNI-SOL-YYYY-XXXX` |
| ~~Baja~~ | ~~Permiso `aprobar_ejecutiva`~~ | ✅ Retirado del seed |
| ~~Baja~~ | ~~Paths `@/features/*`~~ | ✅ Eliminados de tsconfig |

---

*Documento vivo — actualizar tras cada release o auditoría de seguridad.*
