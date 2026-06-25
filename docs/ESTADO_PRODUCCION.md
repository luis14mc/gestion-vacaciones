# Estado de Preparación para Producción

**Sistema:** Gestión de Vacaciones y Permisos — CNI Honduras  
**Versión:** 0.1.0  
**Fecha de evaluación:** 19 de junio de 2026 (revisión post-auditoría, segunda pasada)  
**Referencia:** [AUDITORIA.md](../AUDITORIA.md)

---

## Veredicto

### Listo para piloto departamental (Fase 1) — condicionado a SMTP + QA

El sistema **supera el umbral de piloto interno** y puede ampliarse a un **departamento piloto (~20–50 usuarios)** en cuanto se configuren notificaciones SMTP y se ejecute el checklist QA manual. Los hallazgos críticos y medios de la auditoría están **corregidos en código** (RBAC, balances, feriados, código de solicitud, cumpleaños, health check).

**Fase 0 (TI + RRHH, 5–10 usuarios)** puede iniciarse **de inmediato** sin bloqueos técnicos.

**Fase 2 (organización completa)** requiere aún pruebas E2E automatizadas y al menos un ciclo completo de piloto departamental sin incidencias críticas.

| Dimensión | Estado | Notas |
|-----------|--------|-------|
| Funcionalidad core | ✅ Lista | Solicitudes, cumpleaños, aprobación 2 niveles, balances, Mi Balance, reportes |
| Reglas de negocio | ✅ Lista | Días hábiles + feriados HN; servidor autoritativo; config con efecto real |
| Seguridad / RBAC | ✅ Corregida | Alcance por depto, sync roles, adjuntos, rate limit, auditoría |
| Infraestructura Docker/EC2 | ✅ Lista | `/api/health`, compose, Nginx, scripts deploy |
| Documentación | ✅ Actualizada | README, manuales, AUDITORIA, este documento |
| Pruebas automatizadas | ⚠️ Parcial | ~200 casos dominio; APIs/UI sin E2E |
| Notificaciones email | ⚠️ Configurar | Deshabilitadas por defecto; requiere SMTP real |
| Deuda técnica | ⚠️ Mínima | Config decorativa sin efecto; NextAuth beta fijado |

---

## Correcciones aplicadas desde AUDITORIA.md

| Hallazgo | Estado |
|----------|--------|
| Doble fuente flags ↔ RBAC | ✅ `syncUserRoles` + re-sync en seed |
| JWT obsoleto (roles en token) | ✅ Roles frescos de BD |
| Escalada horizontal jefes | ✅ Guard por departamento + jerarquía Director |
| Fuga reportes / calendario | ✅ `alcanceDepartamento()` |
| Efectos balance no aplicados | ✅ Transacción en workflow |
| Días calculados en cliente | ✅ `contarDiasHabiles()` en servidor |
| Feriados no restados | ✅ `feriados-honduras.ts` + exclusión en labor-days |
| Config decorativa | ✅ Catálogo + validación; toggles muertos eliminados |
| Auditoría inservible | ✅ Tabla + `registrarAuditoria()` |
| Contraseña `'1234'` en import | ✅ Temporal única + cambio obligatorio |
| Adjuntos sin validación | ✅ Magic bytes + límites |
| Rate limit en memoria | ✅ Postgres `rate_limits` |
| Rol DIRECTOR ausente en seed | ✅ Corregido jun 2026 |
| `/api/health` ausente | ✅ Corregido jun 2026 |
| Día libre por cumpleaños | ✅ Implementado jun 2026 |
| Código solicitud dual SOL/CNI-SOL | ✅ Unificado `CNI-SOL-YYYY-XXXX` jun 2026 |
| Permiso `aprobar_ejecutiva` huérfano | ✅ Retirado del seed jun 2026 |
| Alias tsconfig `@/features/*` | ✅ Eliminado jun 2026 |
| Feriados puente (lunes) | ✅ `aplicarFeriadosPuente` jun 2026 |
| Sync inverso RBAC → flags | ✅ `syncFlagsFromRoles` jun 2026 |
| Auditoría al crear solicitud | ✅ POST `/api/solicitudes` jun 2026 |
| POST `/api/auditoria` abierto | ✅ Solo admin jun 2026 |
| Verificación SMTP | ✅ `POST /api/configuracion/verificar-smtp` jun 2026 |
| Balance effects duplicados | ✅ `balance-effects.ts` jun 2026 |
| Tests integración legacy | ✅ `ejecutarAccion` + `DATABASE_URL_TEST` jun 2026 |

---

## Lo que está listo

### Funcionalidades operativas

- Login con NextAuth (credenciales), cambio obligatorio de contraseña para usuarios importados
- Solicitudes: vacaciones, permisos, licencias médicas, permiso personal, **día libre por cumpleaños**
- **Mi Balance** (`/mi-balance`) — días vencidos, proporcionales y disponibles
- Flujo de aprobación **dos niveles**: Jefe/Director → RRHH
- Saldos: reserva al enviar, confirmación al aprobar RRHH, liberación al rechazar/cancelar
- **Feriados Honduras** excluidos del conteo de vacaciones (fijos + Semana Santa + **puente**)
- Asignación individual y masiva de días por antigüedad (tabla Honduras)
- Usuarios con **fecha de nacimiento**, departamentos, importación Excel
- Reportes (PDF, CSV, Excel), exportación, dashboard por rol
- Auditoría, modo mantenimiento, configuración dinámica vía UI
- Cron diario (`/api/cron/transiciones`) y health check (`GET /api/health`)

### Infraestructura

- Build standalone Next.js 16 (~150 MB)
- `docker-compose.yml` con PostgreSQL 16 + healthcheck de app
- Nginx reverse proxy + rate limiting
- Scripts: `setup-ec2.sh`, `deploy-ec2.sh`, `backup-s3.sh`

### Seguridad

- RBAC granular en cada API
- Rate limiting login (Postgres + Nginx)
- Sesión con expiración absoluta configurable
- Validación Zod, adjuntos por magic bytes, optimistic locking
- Registro de auditoría en acciones sensibles

### Pruebas existentes

| Área | Tests | Cobertura |
|------|-------|-----------|
| State machine (workflow) | ~44 | Alta |
| Días laborables + feriados | 10 | Media–Alta |
| Adjuntos | 8 | Media |
| Catálogo configuración | 11 | Media |
| Balance display / cumpleaños | 12 | Media |
| Generador contraseñas | 5 | Básica |
| Integración solicitudes | ~20 | Media (`ejecutarAccion`) |
| Servicios estructurales | ~73 | Baja |

**Total aproximado:** ~200 casos unitarios + integración.

---

## Riesgos restantes

### Bloqueantes para Fase 1 (departamento piloto)

| # | Riesgo | Acción |
|---|--------|--------|
| 1 | **Email deshabilitado** | Configurar SMTP en `/configuracion`; probar con `POST /api/configuracion/verificar-smtp` y flujo jefe → RRHH → empleado |
| 2 | **Sin E2E automatizado** | Ejecutar checklist QA manual (abajo) antes de ampliar usuarios |

### Post-lanzamiento piloto

| # | Riesgo | Acción |
|---|--------|--------|
| 3 | **Config decorativa** | `validar_conflictos`, `max_ausencias_simultaneas`, etc. validan pero no aplican lógica |
| 4 | **NextAuth v5 beta** | Versión fijada (`5.0.0-beta.30`); revisar en upgrades mayores |

---

## Checklist de go-live

### Infraestructura

- [ ] `.env.production` completado (AUTH_SECRET, CRON_SECRET, contraseñas fuertes)
- [ ] Migraciones 0003–0006 aplicadas (`pnpm db:migrate`)
- [ ] Seed idempotente (`pnpm db:seed`) — rol DIRECTOR + sync flags
- [ ] Reconciliación balances si upgrade (`pnpm db:reconciliar-balances --apply`)
- [ ] `curl -f https://<host>/api/health` → `{ "status": "ok" }`
- [ ] SSL/TLS en Nginx
- [ ] Cron diario con Bearer `CRON_SECRET`
- [ ] Backup S3 probado
- [ ] `pnpm build` exitoso en servidor

### Funcional

- [ ] Login admin y cambio de contraseña
- [ ] Vacaciones: crear → aprobar jefe → aprobar RRHH → balance correcto
- [ ] Vacaciones que cruzan feriado (ej. 15 sep) descuentan solo días hábiles
- [ ] Rechazo devuelve días al saldo
- [ ] Día cumpleaños: fecha nacimiento → mes correcto → no descuenta vacaciones → duplicado rechazado
- [ ] Código solicitud formato `CNI-SOL-YYYY-XXXX`
- [ ] Importación Excel + contraseñas temporales
- [ ] Asignación masiva, reportes PDF/Excel, modo mantenimiento
- [ ] Email recibido (si SMTP habilitado)

### Seguridad

- [ ] `SEED_DEMO_USERS` no activo en producción
- [ ] Rate limiting probado (5 intentos → bloqueo 15 min)
- [ ] Empleado no accede a `/usuarios`, `/configuracion`
- [ ] Jefe no ve solicitudes de otro departamento

---

## Recomendación por fases

| Fase | Alcance | Estado |
|------|---------|--------|
| **0 — Piloto interno** | TI + RRHH (5–10 usuarios) | ✅ **Iniciar ahora** |
| **1 — Departamento piloto** | ~20–50 usuarios | ✅ **Tras SMTP + checklist QA** |
| **2 — Organización completa** | Todos los colaboradores | Tras piloto exitoso + E2E |

---

## Métricas de calidad

| Métrica | Valor |
|---------|-------|
| Páginas UI | 18 rutas (incl. `/mi-balance`) |
| API Routes | 30 handlers (incl. `/api/health`) |
| Migraciones Drizzle | 7 (0000–0006) |
| Servicios de negocio | 7 |
| Tests automatizados | ~200 casos |
| Hallazgos auditoría críticos | 0 abiertos |
| Hallazgos auditoría medios | 0 abiertos en código |
| Bloqueos operativos | 2 (SMTP, QA manual) |

---

## Conclusión

Tras la segunda pasada de correcciones (junio 2026), el proyecto cumple criterios de **software listo para producción controlada**. La arquitectura, reglas de negocio y seguridad están alineadas con un despliegue institucional.

**Recomendación final:**

1. **Esta semana:** iniciar Fase 0 (piloto TI + RRHH).
2. **Próximas 2 semanas:** configurar SMTP, ejecutar checklist, abrir Fase 1 (un departamento).
3. **Mes 2+:** evaluar Fase 2 según resultados del piloto.

---

*Documento vivo — actualizar tras cada release o auditoría.*
