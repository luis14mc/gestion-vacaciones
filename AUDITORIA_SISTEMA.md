# Auditoría integral del sistema - Gestión de Vacaciones CNI

**Fecha de revisión:** 2026-07-01

**Alcance:** arquitectura, backend, frontend, QA, DevOps, OWASP Top 10 e ISO/IEC 12207

**Stack observado:** Next.js 16.2.6, React 19.2, PostgreSQL 16, Drizzle ORM, pnpm y Docker Compose

## 1. Resumen ejecutivo

El sistema tiene una base funcional sólida: autenticación, RBAC, flujo de solicitudes, balances, importación masiva, auditoría, reportes, SMTP configurable y despliegue Docker. El código separa dominio, servicios, API y UI de forma razonable.

El estado actual es **apto para continuar pruebas controladas**, pero no debe considerarse completamente cerrado para producción hasta completar los puntos P0/P1 de este documento. Los riesgos principales son la activación del cron de cumpleaños en EC2, pruebas de API/E2E insuficientes, CSP permisiva y observabilidad limitada.

### Inventario verificado

| Elemento | Cantidad observada |
|---|---:|
| Páginas `page.tsx` | 18 |
| Rutas API `route.ts` | 35 |
| Archivos de pruebas unitarias | 24 |
| Archivos de pruebas de integración | 3 |
| Migraciones Drizzle | 8 (`0000` a `0007`) |

Estas cantidades describen archivos presentes; el número de tests ejecutados se registra únicamente después de una corrida exitosa.

## 2. Estado de verificación

| Comando | Estado de esta revisión | Observación |
|---|---|---|
| `pnpm test:run` | **PASS** | 24 archivos, 150 tests aprobados, 0 fallos (2026-07-01). |
| `pnpm lint` | **PASS** | 0 errores; 206 warnings legacy dentro del límite temporal configurado. |
| `pnpm build` | **PASS** | Build Next.js 16.2.6 con Webpack, TypeScript y generación de 50 rutas completados. |
| Integración con PostgreSQL | No ejecutada | Requiere una BD de prueba aislada. |
| Pruebas visuales responsive | Pendiente | Requieren recorrido real desktop/móvil. |

## 3. Hallazgos priorizados

| ID | Prioridad | Estado | Hallazgo / acción requerida |
|---|---|---|---|
| OPS-01 | **P0** | Mitigado en instalador; pendiente despliegue | `scripts/setup-ec2.sh` ya programa cumpleaños en EC2. Aplicar/verificar el crontab del servidor existente. |
| DB-01 | **P0** | Pendiente despliegue | Aplicar `drizzle/0007_notificaciones_cumpleanos.sql` mediante `pnpm run db:setup` y verificar la tabla `notificaciones_cumpleanos_mensuales`. |
| DB-02 | **P1** | Corregido en código | `0005_balance_trigger.sql` no figuraba en el journal Drizzle y podía omitirse con `db:migrate`. Se agregó la entrada faltante. |
| DB-03 | **P0** | Corregido en código | `db:install` ejecuta `DROP SCHEMA public CASCADE`. Ahora se bloquea en producción y exige `ALLOW_DATABASE_RESET=YES` en entornos descartables. |
| DB-04 | **P0** | Corregido en código | `limpiar-usuarios.ts` podía borrar usuarios sin confirmación. Ahora se limita a Neon de pruebas, exige confirmación y bloquea producción. |
| QA-01 | **P1** | Pendiente | Faltan pruebas de contrato/API para creación y acción de solicitudes, autorización por rol y respuestas 400/401/403/409. |
| QA-02 | **P1** | Pendiente | Falta E2E del flujo empleado -> jefe/director -> RRHH, incluyendo doble rol, autoaprobación y estados finales. |
| SEC-01 | **P1** | Pendiente | CSP permite `unsafe-inline` y `unsafe-eval` en scripts. Migrar gradualmente a nonce/hash y retirar `X-XSS-Protection`, que es obsoleto. |
| OPS-02 | **P1** | Pendiente | No hay logging estructurado, correlación de requests, métricas ni alertas externas. |
| SEC-02 | **P1** | Mitigado en código | PostgreSQL remoto verificaba certificados con `rejectUnauthorized: false`. Ahora verifica por defecto; la excepción requiere `DATABASE_SSL_REJECT_UNAUTHORIZED=false`. |
| SEC-03 | **P1** | Mitigado en código | `.env.example` contenía contraseñas/secretos de ejemplo utilizables. `ADMIN_PASSWORD` y `CRON_SECRET` quedan vacíos. |
| AUTH-01 | **P2** | Pendiente | `next-auth@5.0.0-beta.30` sigue siendo beta. Mantener versión exacta, revisar avisos de seguridad y planificar actualización probada. |
| QA-03 | **P2** | Pendiente | Faltan tests con SMTP simulado y pruebas de sincronización de roles/flags RBAC. |
| DATA-01 | **P2** | Pendiente | El modelo mantiene flags de rol y tablas RBAC. Documentar fuente de verdad y añadir reconciliación/alerta de divergencias. |
| DATA-02 | **P3** | Pendiente de decisión | La tabla `sessions` existe, pero la estrategia actual usa JWT. Documentar su reserva o retirarla con migración segura. |

## 4. Correcciones realizadas durante esta revisión

1. TLS de PostgreSQL endurecido en runtime y scripts operativos.
2. Compatibilidad preservada con AWS Docker mediante `DATABASE_SSL=false`.
3. Variable documentada: `DATABASE_SSL_REJECT_UNAUTHORIZED=true` por defecto.
4. Secretos de ejemplo de administrador y cron eliminados de `.env.example`.
5. Configuración pnpm obsoleta retirada de `package.json`; `next-auth` continúa fijado directamente.
6. Hallazgo anterior D4 corregido: `rate_limits` **sí** está declarado en `src/lib/db/schema/auth.ts`, exportado por `schema/index.ts` y creado por `drizzle/0003_rate_limits.sql`.
7. Integración de cumpleaños reforzada: un solo día, misma fecha de inicio/fin, solo durante el mes correspondiente y con errores de negocio HTTP 400.
8. Middleware corregido para permitir que `/api/cron/*` llegue a endpoints protegidos por `CRON_SECRET`.
9. Instalador EC2 actualizado con cron mensual de cumpleaños.
10. Journal Drizzle reparado para incluir la migración `0005_balance_trigger`.
11. Reset destructivo `db:install` bloqueado por defecto y prohibido con `NODE_ENV=production`.
12. Limpieza masiva heredada protegida con entorno y confirmación explícita.

## 5. OWASP Top 10

| Categoría | Estado | Evidencia / brecha |
|---|---|---|
| A01 Broken Access Control | Parcialmente cubierto | RBAC, guards y state machine presentes. Faltan pruebas API/E2E sistemáticas por rol. |
| A02 Cryptographic Failures | Mejorado | bcrypt y HTTPS; TLS de BD verifica certificados por defecto. Rotación de secretos debe quedar en runbook. |
| A03 Injection | Cubierto con reservas | Drizzle/Zod reducen riesgo. Revisar usos de `sql.unsafe` en scripts y mantenerlos fuera de entradas web. |
| A04 Insecure Design | Bueno | Reglas de dominio y transacciones existen. Falta trazabilidad formal requisito -> control -> prueba. |
| A05 Security Misconfiguration | Parcial | Headers, contenedores no root y binding local. CSP aún permisiva; secretos deben validarse al iniciar. |
| A06 Vulnerable Components | Pendiente continuo | Automatizar `pnpm audit`, Dependabot/Renovate y revisión de NextAuth beta. |
| A07 Identification/Auth Failures | Bueno con reservas | JWT, expiración, rate limit y política de contraseña. El rate limiter es fail-open ante caída de BD. |
| A08 Software/Data Integrity | Parcial | Lockfile y migraciones versionadas. Falta CI obligatorio, SBOM y firma/escaneo de imagen. |
| A09 Logging/Monitoring Failures | Insuficiente | Hay auditoría funcional, pero no logging estructurado ni alertas operativas. |
| A10 SSRF | Riesgo bajo observado | No se identificó fetch arbitrario controlado por usuario; mantener allowlists si se agregan integraciones. |

Los headers actuales son una **base de hardening**, no deben describirse como “OWASP completos” mientras la CSP incluya directivas inseguras y no haya verificación dinámica.

## 6. ISO/IEC 12207

| Proceso | Madurez | Ajuste requerido |
|---|---|---|
| Requisitos | Media | Mantener criterios de aceptación y matriz de trazabilidad para solicitudes, balances, importación y cumpleaños. |
| Arquitectura/diseño | Media-alta | Las capas están separadas; documentar decisiones (ADR) para RBAC dual, JWT y balances. |
| Construcción | Media-alta | TypeScript, lint y estructura consistentes; reducir warnings tolerados progresivamente. |
| Integración | Media | Automatizar BD efímera y pruebas de migraciones en CI. |
| Verificación | Media-baja | Buena lógica unitaria, cobertura insuficiente en API, UI y E2E. |
| Validación | Media-baja | Falta matriz UAT por rol y evidencia responsive/accesibilidad. |
| Transición | Media | Docker y setup existen; agregar checklist de despliegue, rollback y verificación de cron/migraciones. |
| Operación | Baja-media | Healthcheck disponible; faltan métricas, logs centralizados, alertas, backup y prueba de restauración. |
| Mantenimiento | Media | Git/migraciones presentes; formalizar gestión de cambios, vulnerabilidades y ventanas de actualización. |

## 7. Funcionalidad de cumpleaños

### Implementado en código

- Captura y normalización de fecha de nacimiento.
- Elegibilidad limitada al mes de cumpleaños y una vez por año.
- Solicitud de exactamente un día, sin consumo de vacaciones.
- Exclusión de VoBo ministerial para esta modalidad.
- Auditoría de cambios y validaciones rechazadas.
- Métricas/reportes y tarjeta de dashboard.
- Notificación mensual idempotente mediante tabla con restricción única.
- Ruta protegida por `CRON_SECRET`: `/api/cron/cumpleanos`.

### Pendiente en AWS EC2

1. Ejecutar `docker compose --profile setup run --rm db-setup`.
2. Verificar migración: `SELECT to_regclass('public.notificaciones_cumpleanos_mensuales');`.
3. Programar cron mensual del host. Ejemplo operativo a adaptar al manejo seguro del secreto:

```cron
0 12 1 * * curl --fail --silent --show-error -X POST https://vacaciones.cni.hn/api/cron/cumpleanos -H "Authorization: Bearer <CRON_SECRET>"
```

4. Ejecutar una prueba controlada y verificar envío SMTP, fila idempotente y registro de error sin exponer credenciales.

## 8. Frontend y accesibilidad

La UI usa componentes reutilizables y breakpoints responsive, pero el cumplimiento no está demostrado solo por inspección estática. Debe ejecutarse una matriz visual mínima en 360x800, 768x1024, 1366x768 y 1920x1080 sobre páginas, tablas, formularios y modales.

Pendientes concretos:

- Validar navegación por teclado, foco visible, cierre de modales y mensajes de error asociados al campo.
- Evitar tablas desbordadas sin estrategia de scroll/columnas responsivas.
- Verificar textos largos, nombres compuestos y zoom del navegador al 200%.
- Añadir pruebas de componentes para estados loading, vacío, error y permisos insuficientes.

## 9. DevOps y producción

Fortalezas observadas:

- Docker multi-stage y proceso Node no root.
- PostgreSQL y app publicados solo en `127.0.0.1`; Nginx expone 80/443.
- Healthchecks y límites de recursos presentes.
- Setup de BD versionado e idempotente por intención.

Validaciones obligatorias antes de declarar producción lista:

- Backup automático y restauración probada de PostgreSQL.
- Renovación automática de Let's Encrypt y alerta previa a expiración.
- `docker compose config` sin secretos impresos en logs compartidos.
- Escaneo de imagen y dependencias en CI.
- Rollback documentado de aplicación y migraciones compatibles hacia atrás.
- Cron de transiciones y cumpleaños instalado y monitorizado en EC2.
- Medición real del tamaño de imagen; no conservar estimaciones como evidencia.

## 10. Plan de acción

### Fase 1 - Bloqueos de producción

1. Aplicar y verificar migración `0007`.
2. Configurar y probar cron mensual de cumpleaños en EC2.
3. ~~Completar `pnpm test:run`, `pnpm lint` y `pnpm build`~~ - **Completado 2026-07-01**.
4. Ejecutar smoke test por cada rol contra una BD de staging.

### Fase 2 - Seguridad y calidad

1. Añadir tests API/E2E del workflow y autorización.
2. Endurecer CSP con nonce/hash.
3. Añadir validación de secretos obligatorios al arranque.
4. Automatizar auditoría de dependencias, SBOM y escaneo de contenedor.

### Fase 3 - Operación y mantenibilidad

1. Implementar logging JSON con request/correlation ID.
2. Centralizar logs y configurar alertas de health, cron, SMTP y errores 5xx.
3. Formalizar UAT, trazabilidad ISO/IEC 12207 y registro de decisiones técnicas.
4. Resolver la estrategia definitiva de RBAC dual y tabla `sessions`.

## 11. Criterio de cierre

El release puede marcarse listo cuando no existan P0 abiertos, lint/tests/build estén verdes en CI, las migraciones se hayan probado sobre copia de staging, el flujo completo por rol tenga evidencia y exista rollback/backup verificado.

---

**Documento vivo:** actualizar fecha, evidencia y estado en cada release. No mantener como “PASS” resultados que no se hayan ejecutado sobre el commit auditado.
