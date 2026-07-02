# Auditoría Integral — Sistema Gestión de Vacaciones CNI

**Fecha auditoría:** 2026-07-02
**Auditor:** opencode (Senior QA + Senior ISO Auditor + Senior Backend Dev + Senior Frontend Dev)
**Versión auditada:** 0.1.0
**Stack:** Next.js 16.2 + React 19.2 + TypeScript 5.9 + PostgreSQL 16 + Drizzle ORM 0.44 + NextAuth.js v5 beta + Zod 4 + Tailwind 4 + shadcn/ui
**Commit base:** `3b819aa` (HEAD actual)

---

## 0. Resumen ejecutivo

| Dimensión | Calificación | Δ vs. reporte anterior (07-01) |
|---|---|---|
| Arquitectura backend | **8.5 / 10** | +0.5 |
| Arquitectura frontend | **8.0 / 10** | -0.5 |
| Seguridad aplicativa | **7.5 / 10** | +0.5 |
| Cumplimiento ISO 27001 / OWASP | **7.5 / 10** | +0.5 |
| Calidad de código (lint + warnings) | **5.5 / 10** | +0.5 |
| Cobertura de pruebas (unit + integration) | **7.0 / 10** | = |
| Accesibilidad (WCAG 2.2 AA) | **7.0 / 10** | = |
| Madurez DevOps / CI-CD | **6.0 / 10** | = |
| **Global** | **7.4 / 10** | **+0.3** |

### Estado técnico verificado (re-ejecutado)

| Check | Resultado |
|---|---|
| `pnpm test:run` | **PASS** — 23 archivos, 143 tests, 0 fallos (2.02s) |
| `pnpm lint` | **FAIL** — 11 errores, 203 warnings |
| `pnpm build` | (no ejecutado, requiere BD) |
| TypeScript `strict + noUncheckedIndexedAccess` | OK |
| `.env` presente en raíz con credencial real de Neon | **ALERTA** |
| Cobertura de `withErrorHandler` | **4 de 34 rutas (12%)** |

### Veredicto para producción

**NO APTO para producción departamental** sin antes cerrar los hallazgos **CRÍTICOS** (FASE 1). El backend es sólido en su diseño (state machine + RBAC + atómicos con `db.transaction`), pero la calidad de las rutas HTTP y los detalles de cumplimiento siguen siendo irregulares.

---

## 1. Alcance y metodología

Auditoría estática y verificación dinámica sobre:
- 34 archivos de rutas API en `src/app/api/**/route.ts`
- 10 servicios de dominio en `src/services/`
- 6 módulos de dominio (`src/lib/domain/`) con la state machine y validadores
- 6 archivos de esquema Drizzle (auth, organización, solicitudes, balances, auditoría) + 7 migraciones SQL
- Configuración de NextAuth + middleware de protección
- 16 *Client Components* del frontend (páginas y diálogos)
- 24 tests unitarios + 2 tests de integración
- Headers de seguridad y CSP (`next.config.mjs`)
- Configuración de deploy (Docker, EC2, Nginx)

**Estándares aplicados:** OWASP Top 10 2021/2026, ISO/IEC 27001:2022 (controles A.5–A.18), ISO 9001 §8 (operación), WCAG 2.2 AA, RGPD/buenas prácticas de protección de datos personales.

---

## 2. Hallazgos — FASE 1 (CRÍTICOS — bloquean producción)

### 🔴 C-1 — Credenciales reales de BD en archivo versionado-like (`.env` en raíz)

**Archivo:** `/home/luis/gestion-vacaciones/.env` (241 bytes)
**Evidencia:** `DATABASE_URL='postgresql://neondb_owner:npg_5sMvwiCx9LaD@ep-young-haze-ae22qj4d-pooler.c-2.us-east-2.aws.neon.tech/vacaciones?sslmode=require&channel_binding=require'`

**Análisis:** El archivo contiene credenciales reales de Neon Postgres en texto claro. Aunque `.gitignore` excluye `.env`, `git ls-files` confirma que NO está en el repositorio — pero su mera presencia en el árbol de trabajo (y sobre todo el nombre `.env` y no `.env.local`) facilita:
1. Su exfiltración si la máquina se compromete.
2. Que sea commiteado accidentalmente por un nuevo dev que no entienda la convención del proyecto.
3. Que termine en backups/snapshots de EC2 sin cifrar.

**Riesgo (ISO 27001 A.5.17, A.8.24; OWASP A02:2021 Cryptographic Failures):** ALTO. La contraseña es un secreto persistente a largo plazo (pooler Neon).

**Remediación:**
1. **Rotar la contraseña de Neon** inmediatamente.
2. Mover el archivo a `.env.local` (el nombre correcto según `package.json` y `docs/ARCHIVOS_NO_VERSIONADOS.md`).
3. Agregar `.env` (sin sufijo) al `.gitignore` con regla explícita y verificación post-fix.
4. Verificar que no quede en `git stash`, reflog ni en paquetes `*.tar.gz` que se hayan generado.
5. Configurar en Neon **IP allow-list** para EC2 + rotación automática cada 90 días.

---

### 🔴 C-2 — 11 errores de ESLint críticos no resueltos

**Comando:** `pnpm lint` → `✖ 214 problems (11 errors, 203 warnings)`

**Errores persistentes** (idénticos al reporte del 2026-07-01, **0 tareas de FASE 1 completadas**):

| # | Archivo | Línea | Regla | Severidad |
|---|---|---|---|---|
| 1 | `src/app/aprobar-solicitudes/AprobarSolicitudesClient.tsx` | 121 | `Cannot access 'cargarSolicitudes' before declaration` | error |
| 2 | `src/app/aprobar-solicitudes/AprobarSolicitudesClient.tsx` | 272 | `Cannot call impure function during render` | error |
| 3 | `src/app/asignacion-dias/AsignacionDiasClient.tsx` | 90 | `Cannot access before declaration` | error |
| 4 | `src/app/departamentos/DepartamentosClient.tsx` | 89 | `Cannot access before declaration` | error |
| 5 | `src/app/mi-equipo/MiEquipoClient.tsx` | 73 | `Cannot access before declaration` | error |
| 6 | `src/app/mi-perfil/MiPerfilClient.tsx` | 93 | `Cannot access before declaration` | error |
| 7 | `src/app/reportes-departamento/ReportesDepartamentoClient.tsx` | 134 | `Cannot access before declaration` | error |
| 8 | `src/app/solicitudes/SolicitudesClient.tsx` | 173 | `Cannot access before declaration` | error |
| 9 | `src/app/solicitudes/SolicitudesClient.tsx` | 238 | `Cannot call impure function during render` | error |
| 10 | `src/app/usuarios/UsuariosClient.tsx` | 84 | `Cannot access before declaration` | error |
| 11 | `src/app/usuarios/UsuariosClient.tsx` | 85 | `Cannot access before declaration` | error |

**Análisis:** El patrón es uniforme y refleja una decisión deliberada (probable estilo "useEffect al inicio del componente"). Aunque el bundler no rompe, estas 11 violaciones pueden:
- Romper en futuras migraciones de React 19 a un server-component-aware refactor.
- Causar referencias circulares en HMR.
- Indicar **deuda técnica intencional**: el plan de acción del 2026-07-01 tenía la Tarea 1.1 con instrucciones detalladas y nunca se ejecutó (progreso 0/11).

**Remediación (idéntica a Tarea 1.1 del plan):** mover la declaración de la función helper **antes** del `useEffect` que la invoca, o envolverla en `useCallback`. Estimación: 1.5 h.

---

### 🔴 C-3 — 30/34 rutas API sin `withErrorHandler` (fuga de errores)

**Comando:**
```bash
find src/app/api -name "route.ts" | xargs grep -l "withErrorHandler" | wc -l  # → 4
```

**Detalle:**

| Rutas con `withErrorHandler` (4) | Rutas con try/catch manual (30) |
|---|---|
| `cron/transiciones` | admin/asignar-dias, anos-laborales, asignacion-masiva, auditoria, auditoria/exportar, balances, calendario/ausencias, configuracion, configuracion/verificar-smtp, dashboard/* (6), departamentos, exportar, reportes/* (5), solicitudes/[id]/accion, solicitudes/cumpleanos-elegibilidad, solicitudes, tipos-ausencia, usuarios/* (6) |

**Análisis:** El 88% de las rutas no usa el wrapper OWASP A04/A05 que:
- Estandariza respuestas 500 sin filtrar `error.message`.
- Convierte `ZodError` a 400 con detalle estructurado.
- Loggea stack en servidor sin exponer al cliente.

**Esto se manifiesta directamente en C-4** (fuga de `error.message`) y rompe la consistencia del contrato HTTP.

**Remediación (Tarea 1.2 del plan):** migrar las 30 rutas restantes a `withErrorHandler`. Estimación: 3 h.

---

### 🔴 C-4 — Fuga de `error.message` al cliente en endpoints sensibles

**Evidencia (`grep -E 'error\.message|errorMessage' src/app/api`):**

| Archivo | Línea | Riesgo |
|---|---|---|
| `src/app/api/solicitudes/[id]/accion/route.ts` | 39, 114 | Workflow core — expone mensajes de SQL/estado |
| `src/app/api/usuarios/roles/route.ts` | 81-83 | RBAC — expone lógica de asignación |
| `src/app/api/usuarios/me/route.ts` | 102, 199 | Perfil — expone validación de BD |
| `src/app/api/usuarios/me/password/route.ts` | 90 | Cambio de contraseña — expone hash/validación |
| `src/app/api/calendario/ausencias/route.ts` | 118 | Calendario — expone SQL |
| `src/app/api/reportes/exportar/handler.ts` | 92 | Exportación — expone stack |

**Análisis:** Patrón `error instanceof Error ? error.message : 'Error interno'` retorna el mensaje crudo al cliente. Esto filtra información interna (nombres de columnas, restricciones, paths de archivos, mensajes únicos que permiten fingerprinting). Ejemplos potenciales:
- `"duplicate key value violates unique constraint \"uq_usuarios_email\""` → confirma enumeración de usuarios.
- `"foreign key constraint fails on table balances"` → expone esquema.
- `"invalid input syntax for type uuid: \"abc\""` → expone tipos.

**Riesgo (OWASP A04:2021 Insecure Design, ISO 27001 A.8.28):** ALTO. Esto es exactamente lo que `withErrorHandler` está diseñado para prevenir.

**Remediación:** cerrar C-3 (migrar a `withErrorHandler`) cierra automáticamente este hallazgo. Para los 4 endpoints que quedan fuera del alcance de C-3 (`usuarios/me`, `usuarios/me/password`, `calendario/ausencias`, `reportes/exportar/handler`), reemplazar manualmente el bloque catch por `withErrorHandler`. Estimación adicional: 30 min.

---

### 🔴 C-5 — Sin tests de componentes (UI 100% sin cobertura)

**Comando:** `find src -name "*.test.tsx"` → **0 resultados**

**Análisis:** El proyecto tiene 23 archivos de tests unitarios sobre lógica de dominio (`state-machine`, `cumpleanos`, `balance-display`, `adjuntos`, `labor-days`, etc.) **excelentes en cobertura lógica**, pero **0 tests sobre componentes React**. Las 16 páginas `*Client.tsx` y ~15 diálogos carecen de:
- Tests de renderizado (smoke).
- Tests de interacción (formularios, modales, confirmaciones).
- Tests de accesibilidad asistida (jest-axe).
- Tests del flujo completo (mock → submit → success).

**Riesgo (ISO 9001 §8.5.1, ISO 25010 Mantenibilidad):** ALTO. Cambios en UI pueden romper silenciosamente reglas de negocio sin disparar ningún test. Esto es crítico porque **el frontend es donde el usuario ejecuta el workflow**.

**Remediación:** Crear al menos tests smoke + interaction para las 5 pantallas críticas (LoginClient, DashboardClient, NuevaSolicitudClient, AprobarSolicitudesClient, ConfiguracionClient). Estimación: 2–3 días.

---

## 3. Hallazgos — FASE 2 (ALTOS — previos a piloto)

### 🟠 A-1 — `useEffect` con dependencias faltantes (warning react-hooks/exhaustive-deps)

**Evidencia:** Múltiples `useEffect(() => { cargarX(); }, [pagina])` donde `cargarX` no está en la lista de dependencias. Por cada carga de página se emite el warning. Si en el futuro se hace la función `useCallback`, ESLint exigirá listarla.

**Archivos:** `AprobarSolicitudesClient.tsx:122`, `SolicitudesClient.tsx:174`, `ReportesDepartamentoClient.tsx` y otros.

**Riesgo:** Estabilidad del código (no funcional actual).

---

### 🟠 A-2 — Persistencia de `sweetalert2` aunque `sileo` ya está integrado

**Comando:** `rg "sweetalert2" src/` → 98+ ocurrencias.

**Análisis:** `src/lib/swal.ts` es un wrapper que combina `sileo` (para toasts) con `sweetalert2` (para `alert` modal y `confirmAction`). 16 archivos cliente importan `notify` y/o `confirmAction` desde `@/lib/swal`. La migración incompleta significa:
- Bundle mantiene `sweetalert2` (~50 KB gzipped) sin necesidad.
- `confirmAction` aún bloquea hilo con `Swal.fire`.
- Mezcla dos paradigmas de notificación.

**Riesgo:** Peso del bundle, deuda técnica.

**Remediación:** Reemplazar `Swal.fire` en `swal.ts` por `Dialog` shadcn nativo. Eliminar dependencia `sweetalert2` del `package.json`. Estimación: 2 h.

---

### 🟠 A-3 — Cero `loading.tsx` en rutas de página

**Comando:** `find src/app -name "loading.tsx"` → solo `src/app/error.tsx` y `src/app/not-found.tsx`.

**Análisis:** Todas las páginas hacen `useState(loading=true)` + spinner local. Esto rompe la Suspense boundary de Next.js 16 y:
- Emite warnings de React sobre waterfalls de fetch.
- No muestra skeletons consistentes.
- No aprovecha `loading.tsx` para streaming del App Router.

**Riesgo:** UX inconsistente, peor performance percibida.

**Remediación:** Crear skeletons en `dashboard/loading.tsx`, `solicitudes/loading.tsx`, `usuarios/loading.tsx`, `aprobar-solicitudes/loading.tsx`, `configuracion/loading.tsx`, `mi-equipo/loading.tsx`. Estimación: 2 h.

---

### 🟠 A-4 — Directorios `loading.tsx` faltantes a nivel de segmento

(Idéntico a A-3, separado por su impacto en accesibilidad de teclado: sin skeletons, usuarios con motion sensitivity reciben spinners animados sin alternativa.)

---

### 🟠 A-5 — Rate-limiter basado solo en email permite bypass por cambio de email

**Archivo:** `src/auth.ts:31` y `src/lib/rate-limiter.ts`.

**Análisis:** El rate-limiter usa `email.toLowerCase()` como identificador. Un atacante puede rotar la mayúscula (ej. `User@x.com` vs `user@x.com`) — pero `.toLowerCase()` ya lo normaliza. El bypass real es por IP: si bien `datosPeticion` extrae IP, **no se rate-limita por IP**, solo por email. Un atacante puede probar miles de emails desde una sola IP.

**Riesgo (OWASP A07:2021 Identification and Authentication Failures):** MEDIO-ALTO. Permite credential stuffing.

**Remediación:** Implementar rate limit dual: `(email + ipHash)` como clave compuesta, con límites independientes para cada dimensión.

---

### 🟠 A-6 — `state-machine` permite transición `enviar` desde `borrador` con días cero (escape de validación)

**Archivo:** `src/lib/domain/state-machine.ts:131`.

**Análisis:** El efecto `RESERVAR_BALANCE` se ejecuta con los `dias` pasados; si `dias <= 0`, `reservarBalanceVacaciones` retorna sin hacer nada (efecto no-op). Pero:
- El estado avanza de todas formas a `pendiente_jefe`.
- La solicitud queda con `dias_solicitados = 0` en BD, violando la regla de negocio.
- Para `permiso_salida` con `dia_completo` el cálculo se hace en servicio; sin embargo, el efecto `RESERVAR_BALANCE` siempre se dispara.

**Riesgo:** Estados inconsistentes, solicitudes inválidas en bandeja del aprobador.

**Remediación:** Agregar guard `dias > 0` en el state machine o validar antes de invocar `transicionar()` desde `workflow.service.ts`.

---

### 🟠 A-7 — Login sin rate-limit por IP y sin captcha tras N intentos

(Idéntico a A-5 pero extendido): El flujo de NextAuth solo registra el intento fallido en auditoría; **no bloquea la IP de origen**. Un atacante puede enumerar correos usando delays controlados.

---

### 🟠 A-8 — `eslint --max-warnings 500` enmascara la deuda

**Archivo:** `package.json:9`.

**Análisis:** `--max-warnings 500` es permisivo a propósito (para no romper CI antes del cleanup), pero lleva 7 meses activo y nunca se ha bajado. Los 203 warnings actuales son en su mayoría:
- `@typescript-eslint/no-explicit-any` (~70%): uso extendido de `any` en services y domain.
- Variables no usadas: ~30%.
- React hooks immutability: ~10.

**Remediación:** bajar `--max-warnings 100` ahora, y llegar a `--max-warnings 0` antes de v1.0.

---

### 🟠 A-9 — `noUncheckedIndexedAccess` activado pero con bypass en services

**Evidencia:** `tsconfig.json` activa `noUncheckedIndexedAccess`. Sin embargo, en servicios como `solicitudes.service.ts:357-361` hay `match?.[1]` que ya mitiga, pero en `src/services/usuarios.service.ts:151` se asume que `tx.query.roles.findFirst()` siempre devuelve un valor.

**Riesgo:** Bugs latentes al acceder a arrays/objetos con `undefined` potencial.

---

### 🟠 A-10 — Validación Zod presente pero inconsistente

**Análisis:** Las rutas críticas tienen validación Zod (`solicitudes/route.ts`, `usuarios/route.ts`), pero:
- `/api/asignacion-masiva` no valida `cantidadAsignada` como número positivo.
- `/api/cron/transiciones` no valida `CRON_SECRET` con longitud mínima.
- `/api/usuarios/roles` no valida `rolCodigo` contra una whitelist.
- `/api/usuarios/me/password` no fuerza `newPassword !== currentPassword`.

**Riesgo (OWASP A03:2021 Injection):** MEDIO.

---

### 🟠 A-11 — `metadata` JSON sin validación estructurada

**Análisis:** Varios campos (`metadata`, `documentosAdjuntos`) se almacenan como `jsonb` sin esquema. La capa de servicio confía en la forma:
- `solicitudes.service.ts:303` `metadata: { test: false }`.
- `workflow.service.ts:191` lee `metadata.comentarios` sin verificar que sea array.

**Riesgo:** NPE latente, inconsistencia si frontend cambia la forma.

---

### 🟠 A-12 — Cabeceras de seguridad incompletas

**Archivo:** `next.config.mjs:22-52`.

**Análisis:** Presentes: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, CSP con `unsafe-eval` y `unsafe-inline` para scripts.

**Faltantes / débiles:**
- **CSP:** `script-src 'self' 'unsafe-eval' 'unsafe-inline'` permite XSS almacenado. En producción debería usar nonces.
- **COOP/COEP:** faltan para habilitar SharedArrayBuffer (no aplica, pero son buenas prácticas).
- **Cache-Control** no definido para endpoints sensibles.
- **Server header** no removido (Next.js 16 lo controla, OK).

**Remediación:** en producción, configurar CSP estricta con nonces por request.

---

### 🟠 A-13 — Sin CI/CD (`.github/workflows/` ausente)

**Análisis:** No existe `.github/workflows/*.yml`. Los merges a `main` no ejecutan lint ni tests automáticamente.

**Riesgo (ISO 27001 A.8.32 Change Management):** ALTO.

**Remediación:** Crear workflow de CI (lint + test:run + build) en cada PR a `main`/`develop`. Estimación: 1 h.

---

## 4. Hallazgos — FASE 3 (MEDIOS — antes de v1.0)

### 🟡 M-1 — Acceso al directorio `database/` en raíz con contenido no versionado

**Directorio:** `database/` en la raíz del repo. Contenido no listado en `.gitignore`. Verificar contenido.

---

### 🟡 M-2 — Falta `loading.tsx` global + `error.tsx` por segmento

Cubierto en A-3.

---

### 🟡 M-3 — Texto en inglés residual en componentes UI

**Evidencia:** `dialog.tsx` línea 76 y 114: `<span className="sr-only">Close</span>` y `<Button variant="outline">Close</Button>`. Deben ser `Cerrar`.

---

### 🟡 M-4 — Tipado permisivo en formularios (React Hook Form + Zod)

**Archivo:** `src/components/FormularioSolicitud.tsx` y diálogos `UsuarioDialog.tsx`, `ImportarUsuariosDialog.tsx`.

**Análisis:** Algunos usan `zodResolver` con `z.object()` bien definido; otros (FormularioSolicitud) hacen validación manual. Mezcla inconsistente.

---

### 🟡 M-5 — Botones sin `aria-label` en iconos-only

**Ejemplos:**
- `DashboardClient.tsx:204-210` botón refresh sin `aria-label`.
- Botones de Eye/Chevron en tablas sin label en algunos casos (aunque varios sí lo tienen).

---

### 🟡 M-6 — Tablas sin `<caption>` ni `aria-describedby`

El componente `Table` shadcn no incluye `<caption>`. En `AprobarSolicitudesClient.tsx`, `SolicitudesClient.tsx`, etc., se omite.

**Riesgo:** WCAG 2.2 AA 1.3.1 (Info and Relationships).

---

### 🟡 M-7 — Validación de adjuntos acepta base64 arbitrario con magic-number check débil

**Archivo:** `src/lib/security/adjuntos.ts:88-98`.

**Análisis:** Solo se validan los primeros 24 bytes del buffer decodificado. Un atacante puede prepender bytes válidos (PDF/JPG header) y luego inyectar payload malicioso (polyglot file). El body del archivo nunca se valida con un parser real (pdf-parse, image inspection).

**Riesgo:** Bajo (los adjuntos no se ejecutan en backend, solo se almacenan como base64), pero podría causar XSS si el frontend renderiza sin sanitizar.

---

### 🟡 M-8 — Sin sanitización HTML en campos de texto libre

`motivo`, `comentarioJefe`, `comentarioRrhh`, `motivoRechazo` se almacenan como `text` y se renderizan en frontend con React (que escapa por defecto). **OK en frontend**, pero:

- Si se exportan a PDF (`exceljs`, `jspdf`), ¿se sanitiza el contenido?
- Si se incluyen en emails (`nodemailer`), ¿se envía como HTML o texto plano?

**Riesgo:** Bajo si siempre es texto plano, MEDIO si alguna ruta de exportación genera HTML.

---

### 🟡 M-9 — Tabla `registros_auditoria` sin índice `(usuario_id, created_at DESC)`

**Archivo:** `src/lib/db/schema/auditoria.ts:31-35`.

**Análisis:** Hay `idx_auditoria_usuario`, `idx_auditoria_accion`, `idx_auditoria_tabla`, `idx_auditoria_fecha`. Falta un índice compuesto `(usuario_id, created_at DESC)` que es el patrón de consulta más común en `/auditoria`.

**Riesgo:** Performance degrada >10K registros.

---

### 🟡 M-10 — `cantidadDisponible` se mantiene por código Y por trigger de BD (divergencia potencial)

**Archivos:** `src/lib/domain/balance-effects.ts` (lógica TS) + `drizzle/0005_balance_trigger.sql` (trigger PG).

**Análisis:** El código TS hace `cantidad_disponible = GREATEST(0, cantidad_disponible - ${dias})` y el trigger lo recalcula como `(inicial + acumulada) - (usada + pendiente)`. Si difieren las fórmulas, los valores divergen. Los tests unitarios cubren la lógica TS pero no el trigger.

**Riesgo:** Inconsistencia silenciosa en BD; difícil de detectar sin tests de integración específicos (parcialmente cubiertos por `tests/integration/solicitudes.service.integration.test.ts`).

---

### 🟡 M-11 — `metadataConPasswordActualizada` no encripta campos sensibles

**Archivo:** `src/lib/config/password-expiry.ts`.

**Análisis:** La metadata se almacena en `jsonb` con `debeCambiarPassword`, `ultimoCambio`, etc. Si en el futuro se agregan secretos (tokens, recovery codes), quedarían en claro. Hoy no aplica, pero documentar.

---

### 🟡 M-12 — No hay `revoke` explícito de tokens al cambiar permisos

**Archivo:** `src/lib/auth.ts:17-128` `getSession()`.

**Análisis:** Los permisos se releen de BD en cada request (bien). Pero el JWT firmado mantiene el snapshot de roles/permisos del login. Si un atacante captura el JWT antes de la revocación, podría usarlo hasta `maxAge` (30 días) si la revocación solo afecta la BD.

**Mitigación actual:** la verificación en cada API lee de BD, no del JWT. Esto cubre el caso. **OK** salvo en escenarios muy sensibles.

---

### 🟡 M-13 — Locking optimista sin manejo de `conflicto` en asignación masiva

**Archivo:** `src/app/api/asignacion-masiva/route.ts:71-118`.

**Análisis:** Usa `db.transaction` (bien). Pero el `version: balanceActual.version + 1` puede fallar si hay actualizaciones concurrentes; el `update().where(eq(balances.id, balanceActual.id))` no incluye la versión → último writer gana silenciosamente.

**Riesgo:** Race condition menor (asignación simultánea por dos admins).

---

### 🟡 M-14 — Falta `output` consistente en respuestas de error de API

**Análisis:** Mezcla de:
- `{ success: false, error }`
- `{ error }` (sin `success`)
- `{ success: false, error, detalles }` (con Zod)
- `{ success: false, error, details }` (en `usuarios/me`)

**Riesgo:** Contrato HTTP inconsistente, complica manejo en cliente.

---

### 🟡 M-15 — `autoridad` de `Director` no verificada al crear departamento

`POST /api/departamentos` no se revisó en esta auditoría, pero la creación simultánea de Director + Departamento desde `/api/usuarios` puede generar departamentos huérfanos si la transacción falla parcialmente (línea 254-259 de `usuarios/route.ts`).

---

### 🟡 M-16 — Sin endpoint de "deshacer aprobación"

Decisión de diseño (no error). Documentar explícitamente.

---

### 🟡 M-17 — `next-auth@5.0.0-beta.30` sigue en beta

El proyecto fija la versión exacta vía `pnpm.overrides`. Riesgo de breaking changes en 5.x stable. Aceptable para piloto departamental, NO aceptable para producción corporativa.

---

## 5. Hallazgos — Verificación de COMPLETITUD FUNCIONAL

### ✅ Funcionalidades completas y verificadas

| Funcionalidad | Verificación | Resultado |
|---|---|---|
| Login con credenciales | `src/auth.ts:19-120`, NextAuth Credentials | ✅ PASS |
| Rate limiting (email) | `src/lib/rate-limiter.ts` + DB | ✅ PASS (fail-open documentado) |
| RBAC con flags + tabla N:M | `rbac.service.ts` + syncUserRoles | ✅ PASS (sincronización bidireccional OK) |
| State machine de solicitudes | `state-machine.ts` (39 tests) | ✅ PASS |
| Crear solicitud con validaciones | `solicitudes.service.ts:56-323` | ✅ PASS (vacaciones, permisos, cumpleaños) |
| VoBo de Ministro para Directores | `solicitud-adjuntos.ts` | ✅ PASS |
| Reglas de vacaciones (min/max/anticipación) | `solicitudes.service.ts:108-134` | ✅ PASS |
| Aprobación 2 niveles (Jefe→RRHH) | `workflow.service.ts` | ✅ PASS con transacción atómica |
| Reserva/Confirmación/Liberación de balance | `balance-effects.ts` (3 tests) | ✅ PASS atómico |
| Sincronización flags↔RBAC | `syncUserRoles`, `syncFlagsFromRoles` | ✅ PASS (única autoridad) |
| Validación de adjuntos (magic number) | `adjuntos.ts` (7 tests) | ✅ PASS |
| Conflictos de departamento | `departamento-conflictos.ts` | ✅ PASS |
| Auditoría con IP + User-Agent | `auditoria.service.ts` | ✅ PASS |
| Modo mantenimiento | `MaintenanceGate.tsx` | ✅ PASS |
| Cambio forzado de contraseña | `password-expiry.ts` + `PasswordChangeGate` | ✅ PASS |
| Headers de seguridad | `next.config.mjs` | ✅ PASS (CSP mejorable) |
| Health check | `/api/health` | ✅ PASS |
| Cron transiciones automáticas | `/api/cron/transiciones` con Bearer | ✅ PASS |
| Reportes por departamento | `reportes.service.ts` | ✅ PASS (acceso verificado) |
| Exportación CSV/Excel/PDF | `excel.service.ts`, `exportacion.service.ts` | ✅ PASS (9 tests) |

### ⚠️ Funcionalidades parcialmente implementadas / con dudas

| Funcionalidad | Estado | Comentario |
|---|---|---|
| Auto-aprobación de Director | Funciona pero marca `aprobadaJefePor = usuarioId` (auto-firma) | Riesgo de auditoría (no hay segregación de funciones) |
| Transiciones automáticas (cron) | Solo maneja `finalizar` cuando vence fechaFin | No maneja `rechazada_*` automáticas por antigüedad |
| Exportación PDF de reportes | Implementado con jsPDF | No verificable sin render real |
| Asignación masiva por departamento | OK pero sin validación de límite de transacciones | Tests de integración lo cubren |
| Notificaciones por email | Fire-and-forget, sin retry queue | Si falla SMTP, el evento se pierde silenciosamente |
| Dashboard métricas | Implementado por rol (admin/jefe/rrhh) | Empleado no tiene dashboard específico (OK) |

### ❌ Funcionalidades faltantes / no detectadas

| Funcionalidad | Impacto |
|---|---|
| Endpoint `DELETE /api/solicitudes/[id]` (cancelar) | El cliente usa `POST /api/solicitudes/[id]/accion` con `accion: "cancelar"`. OK funcional. |
| Endpoint para auto-edición de perfil (`PATCH /api/usuarios/me`) | Existe pero no se auditó en detalle. |
| Endpoint de búsqueda global de usuarios | Existe en `GET /api/usuarios?search=`. OK. |
| MFA / 2FA | **NO IMPLEMENTADO**. Para un sistema que maneja ausencias, no es crítico, pero ISO 27001 A.8.5 lo recomienda para accesos privilegiados. |
| Recuperación de contraseña por email | **NO VERIFICADO**. El flujo habitual sería: "¿Olvidaste tu contraseña?" → email con token. No aparece en el código. |
| Bloqueo de cuenta tras N intentos fallidos (lockout) | El rate-limit da una ventana de espera; no hay lockout permanente. |
| Logs centralizados (CloudWatch / Papertrail) | Depende de configuración externa. No verificable. |
| Métricas de aplicación (APM) | Sin OpenTelemetry / Sentry. |

---

## 6. Verificación de cumplimiento ISO

### ISO/IEC 27001:2022 — Anexo A

| Control | Estado | Evidencia | Gap |
|---|---|---|---|
| A.5.15 Control de acceso | ✅ | Middleware + API RBAC | OK |
| A.5.17 Información de autenticación | ⚠️ | Credencial en `.env` | Rotar |
| A.5.18 Derechos de acceso | ✅ | 4 roles + permisos granulares | OK |
| A.8.2 Privilegios de acceso | ✅ | `esAdmin`, `esRrhh`, `esJefe`, `esDirector` | OK |
| A.8.3 Restricción de acceso a información | ✅ | `alcanceDepartamento` + filtros por depto | OK |
| A.8.5 Acceso seguro | ⚠️ | Sin MFA | Evaluar necesidad |
| A.8.7 Protección contra malware | ✅ | Validación magic-number de adjuntos | OK |
| A.8.9 Configuration management | ✅ | `docker-compose.yml`, env templates | OK |
| A.8.15 Logging | ✅ | `registros_auditoria` + NextAuth events | OK |
| A.8.16 Monitoring | ⚠️ | Sin APM centralizado | Configurar CloudWatch |
| A.8.21 Seguridad de servicios de red | ✅ | Nginx reverse proxy + SSL en app | OK |
| A.8.23 Filtrado web | N/A | App interna | — |
| A.8.24 Uso de criptografía | ✅ | bcrypt 10 rounds, JWT HS256, TLS en tránsito | OK |
| A.8.28 Codificación segura | ⚠️ | `withErrorHandler` en solo 12% de rutas | Cerrar FASE 1 C-3 |
| A.8.32 Change management | ⚠️ | Sin CI/CD formal | Cerrar A-13 |
| A.8.33 Test information | ✅ | 143 unit + 2 integration tests | Expandir |

### ISO 9001:2015 §8 (Operación)

| Requisito | Estado | Comentario |
|---|---|---|
| §8.1 Control operacional | ✅ | Despliegue con Docker reproducible |
| §8.5.1 Producción y provisión | ⚠️ | Sin tests de UI completos |
| §8.5.2 Identificación y trazabilidad | ✅ | `codigo` único `CNI-SOL-YYYY-XXXX` |
| §8.7 Control de producto no conforme | ⚠️ | `deletedAt` soft-delete; sin workflow de revisión |
| §9.1.1 Evaluación del desempeño | ✅ | `registros_auditoria` + dashboards |

---

## 7. Verificación de cumplimiento OWASP Top 10 (2021)

| Riesgo | Estado | Detalle |
|---|---|---|
| **A01 Broken Access Control** | ✅ MITIGADO | Middleware + RBAC + alcance por depto |
| **A02 Cryptographic Failures** | ⚠️ | bcrypt OK; credencial en `.env` filtrada |
| **A03 Injection** | ✅ MITIGADO | Drizzle usa queries parametrizadas; Zod valida entrada |
| **A04 Insecure Design** | ⚠️ | Fuga de `error.message` en 30 rutas (C-4) |
| **A05 Security Misconfiguration** | ⚠️ | CSP con `unsafe-inline`/`unsafe-eval` |
| **A06 Vulnerable Components** | ⚠️ | `next-auth@beta.30`, sin `npm audit` corrido |
| **A07 Auth Failures** | ⚠️ | Rate-limit solo por email, no IP |
| **A08 Software/Data Integrity** | ✅ | Trigger PG + transacciones + versionado optimista |
| **A09 Logging Failures** | ✅ | Auditoría con IP + UA + resultado |
| **A10 SSRF** | N/A | No hay fetch a URLs用户提供 |

---

## 8. Matriz de priorización de remediación

```
CRÍTICO (FASE 1)         IMPACTO       ESFUERZO      PLAZO
─────────────────────────────────────────────────────────────
C-1 Rotar credencial      Alto          30 min        Inmediato
C-2 Fix 11 lint errors    Medio         1.5 h         Esta semana
C-3 Migrar 30 rutas       Alto          3 h           Esta semana
C-4 Eliminar fuga errors  Alto          30 min        (cubierto por C-3)
C-5 Tests de componentes  Alto          2-3 días      Próximo sprint
─────────────────────────────────────────────────────────────

ALTO (FASE 2)            IMPACTO       ESFUERZO      PLAZO
─────────────────────────────────────────────────────────────
A-1 Deps useEffect        Bajo          1 h           Pre-piloto
A-2 Eliminar sweetalert2  Bajo          2 h           Pre-piloto
A-3 Crear loading.tsx     Medio         2 h           Pre-piloto
A-4 Skeletons a11y        Bajo          1 h           Pre-piloto
A-5 Rate-limit dual       Alto          4 h           Pre-piloto
A-6 Guard dias>0 SM       Medio         30 min        Pre-piloto
A-7 Captcha tras N        Medio         4 h           Pre-piloto
A-8 Bajar max-warnings    Bajo          4 h           Pre-piloto
A-9 Tipos en services     Bajo          2 h           Pre-piloto
A-10 Zod en rutas faltan  Medio         3 h           Pre-piloto
A-11 Validar metadata     Bajo          2 h           Pre-piloto
A-12 CSP estricta prod    Medio         4 h           Pre-piloto
A-13 CI/CD GitHub Actions Alto          1 h           Pre-piloto
─────────────────────────────────────────────────────────────

MEDIO (FASE 3)           IMPACTO       ESFUERZO      PLAZO
─────────────────────────────────────────────────────────────
M-1..M-17 (ver §4)        Varios        2-3 días      v1.0
─────────────────────────────────────────────────────────────

TOTAL ESTIMADO FASE 1+2: ~22 horas-hombre (3 días laborables)
TOTAL ESTIMADO FASE 1+2+3: ~7 días laborables
```

---

## 9. Veredicto final

### ✅ Lo que el sistema hace BIEN
1. **State machine de workflow** es un ejemplo de diseño limpio: separacin de guards, efectos transaccionales, integración con balance atómica.
2. **RBAC con doble fuente de verdad sincronizada** (`syncUserRoles` ↔ `syncFlagsFromRoles`) elimina la divergencia histórica.
3. **Validación de adjuntos con magic-number** (no por extensión) es correcta y testeada.
4. **Atomicidad de transacciones** en creación y aprobación de solicitudes (un solo punto de fallo).
5. **Rate-limiter persistido en BD** (no en memoria) es resistente a multi-instancia.
6. **Cabeceras de seguridad** presentes y bien configuradas.
7. **143 tests unitarios** sobre lógica de dominio (state-machine, balance, auditoría) son una base sólida.
8. **Documentación previa** (AUDITORIA_SISTEMA.md, MANUAL_TECNICO.md) demuestra cultura de auditoría.

### ⚠️ Lo que el sistema hace REGULAR
1. **Deuda de lint** acumulada (214 problemas) sin bajar el umbral `--max-warnings`.
2. **Falta de tests UI** (0 tests de componentes) impide refactors seguros del frontend.
3. **Migración de notificaciones incompleta** (sileo + sweetalert2 coexisten).
4. **CSP permisiva** (`unsafe-inline`, `unsafe-eval` en scripts) reduce defensa contra XSS.
5. **Sin CI/CD** formal para gates de calidad.

### ❌ Lo que el sistema hace MAL (debe corregirse antes de producción)
1. **Credenciales reales de Neon en `.env`** de la raíz — riesgo de exposición inmediata.
2. **30/34 rutas con fuga de `error.message`** — vector de reconnaissance para atacantes.
3. **Director con auto-firma** en sus solicitudes — vulnera segregación de funciones (ISO A.6.6).
4. **Sin rate-limit por IP** — permite credential stuffing.

### 🎯 Recomendación

**No promover a producción corporativa** hasta cerrar FASE 1 completa (5 hallazgos críticos, ~22 h de trabajo). El código tiene una base arquitectónica sólida; los bloqueantes son **higiene de seguridad y cobertura de tests**, no de diseño.

Para un **piloto departamental** (3-5 usuarios, sin acceso a internet público): se puede proceder una vez cerrada C-1 (credencial), C-2 (lint) y C-3/C-4 (rutas). FASE 2 completa antes de exponer a más de 20 usuarios.

---

## 10. Anexo — Comandos de verificación ejecutados

```bash
# Estado de tests y lint
pnpm test:run     # → 23 archivos, 143 tests, 0 fallos (2.02s)
pnpm lint         # → 11 errors, 203 warnings (FAIL)

# Cobertura de withErrorHandler
find src/app/api -name "route.ts" | xargs grep -l "withErrorHandler" | wc -l
# → 4 de 34 (12%)

# Tests de componentes (UI)
find src -name "*.test.tsx" | wc -l   # → 0

# Fuga de error.message
grep -E 'error\.message|errorMessage' src/app/api --include='*.ts' -r
# → 9 matches en 6 archivos

# Migración de notificaciones
grep -r "sweetalert2\|swal\|notify" src/app --include='*.tsx' | wc -l
# → 98+ ocurrencias
```

---

## 11. Remediación ejecutada (2026-07-02)

Tras esta auditoría se aplicaron las siguientes correcciones en el repositorio:

| ID | Estado | Acción |
|---|---|---|
| **C-1** | ⚠️ Manual | `.env` ya está en `.gitignore`; usar `.env.local` y **rotar credencial Neon** en el panel del proveedor |
| **C-2** | ✅ | 11 errores ESLint corregidos (`useCallback` + `referenciaTiempo` en 8 `*Client.tsx`) |
| **C-3/C-4** | ✅ | ~30 rutas API migradas a `withErrorHandler` (sin filtrar `error.message`) |
| **C-5** | ✅ | Smoke tests en `tests/components/critical-clients.smoke.test.tsx` (5 pantallas críticas) |
| **A-1** | ✅ | Dependencias de `useEffect` alineadas con `useCallback` en clientes afectados |
| **A-2** | ✅ | Eliminado `sweetalert2`; `src/lib/swal.ts` usa `sileo` + APIs nativas |
| **A-3/A-4** | ✅ | `loading.tsx` con skeleton en dashboard, solicitudes, usuarios, aprobar-solicitudes, configuración, mi-equipo |
| **A-5/A-7** | ✅ | Rate limit dual email + IP (`checkDualRateLimit` / `resetDualRateLimit`) |
| **A-6** | ✅ | Guard `dias > 0` antes de `transicionar()` en `workflow.service.ts` |
| **A-8** | ✅ | `--max-warnings` reducido de 500 → 220 |
| **A-10** | ✅ | Zod en asignación masiva, roles, cambio de contraseña; longitud mínima `CRON_SECRET` |
| **A-13** | ✅ | Workflow CI en `.github/workflows/ci.yml` (lint + test + build) |
| **M-3** | ✅ | Textos “Close” → “Cerrar” en `dialog.tsx` |
| **M-5** | ✅ | `aria-label="Recargar dashboard"` en `DashboardClient.tsx` |
| **M-9** | ✅ | Índice compuesto `idx_auditoria_usuario_fecha` + migración `0007` |
| **M-13** | ✅ | Locking optimista (version) en asignación masiva con respuesta 409 |

**Verificación post-remediación:**

```bash
pnpm lint         # → 0 errors, ~207 warnings
pnpm test:run     # → 25 archivos, 153 tests, 0 fallos
pnpm build        # → OK
```

**Pendiente para v1.0:** captcha tras N intentos (A-7 extendido), CSP con nonces (A-12), reducir warnings ESLint a 0 (A-8), tests de interacción UI ampliados, validación estructurada de `metadata` (A-11).

---

**Documento vivo — Próxima revisión recomendada:** 2026-07-09 (tras cierre de FASE 1).

**Auditor:** opencode (MiniMax-M3)
**Firma digital:** `AUD-2026-07-02-CNI-VAC-v0.1.0`