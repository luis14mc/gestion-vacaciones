# Auditoría y plan de cambios — gestion-vacaciones

**Última actualización:** 2026-06-19

## Resultado ejecutivo

El sistema compila para producción (Next.js 16 + Webpack), con módulos principales operativos: autenticación, usuarios, departamentos, solicitudes, aprobaciones, balances, dashboard, reportes, auditoría, configuración SMTP, importación Excel y despliegue Docker/Nginx.

La auditoría del 24-jun-2026 (sección 12 de `AUDITORIA.md`) quedó implementada en código local. Quedan pendientes operativos de despliegue, QA manual, dependencias vulnerables y migración `middleware` → `proxy`.

---

## Archivos que no van a Git (Neon y secretos)

Documentación completa: [docs/ARCHIVOS_NO_VERSIONADOS.md](./docs/ARCHIVOS_NO_VERSIONADOS.md)

| Archivo | En Git | Notas |
|---------|--------|-------|
| `.env.example`, `.env.test.example` | Sí | Solo placeholders |
| `.env.local`, `.env.test`, `.env.production` | **No** | Secretos y URLs reales |
| Neon (`*.neon.tech`) | **No** | Solo desarrollo local en `.env.local` / `.env.test` |

`.env.test` está en `.gitignore`. Si alguna URL de Neon estuvo en el historial, rotar credenciales en Neon.

---

## Estado de pendientes críticos (jun 2026)

| # | Tema | Estado |
|---|------|--------|
| 1 | Credenciales versionadas / Neon | **Mitigado** — `.env.test` ignorado; doc en repo |
| 2 | Dependencias vulnerables (`pnpm audit`) | **Pendiente** — actualizar jspdf, revisar exceljs |
| 3 | Password por defecto `1234` | **Resuelto** — política en `crearUsuario` / importación |
| 4 | `getSession()` flags desde BD | **Parcial** — RBAC fresco; flags legacy aún OR con token |
| 5 | Sync `usuarios_roles` ↔ flags | **Resuelto** — `syncFlagsFromRoles()` |
| 6 | Adjuntos sin validación estricta | **Pendiente** — tamaño/MIME/antivirus |
| 7 | Licencia médica (OCR/revisión) | **Pendiente** — flujo manual asistido |
| 8 | Tests integración | **Resuelto** — setup + `DATABASE_URL_TEST` |
| 9 | CSP | **Resuelto** — `next.config.mjs` |
| 10 | Optimistic locking solicitudes | **Resuelto** — workflow + solicitudes |
| 11 | FKs Drizzle | **Resuelto** — migraciones 0003–0006 (aplicar en destino) |
| 12 | XSS en emails | **Resuelto** — `escapeHtml` |
| 13 | Config decorativa departamentos/seguridad | **Resuelto** — conflictos de fechas + expiración password |
| 14 | Botón probar SMTP | **Resuelto** — `/api/configuracion/verificar-smtp` |

---

## Configuración admin ahora conectada a lógica

- **`departamentos.validar_conflictos`** — impide solicitudes superpuestas del mismo usuario.
- **`departamentos.max_ausencias_simultaneas`** — limita colaboradores ausentes a la vez en el departamento (0 = sin límite).
- **`seguridad.forzar_cambio_password_dias`** — fuerza cambio si pasaron N días desde `metadata.passwordChangedAt` (0 = desactivado).

Implementación: `src/lib/domain/departamento-conflictos.ts`, `src/lib/config/password-expiry.ts`.

---

## Pendientes altos restantes

1. **Suite E2E** — Playwright desktop/tablet/mobile.
2. **Migrar `middleware.ts` → `proxy`** — advertencia Next.js 16 en build.
3. **Normalizar errores API** — unificar `withErrorHandler`.
4. **Scopes de jefes** — definir regla oficial departamento vs jerarquía.
5. **Scripts destructivos** — mover a `tools/dev-only` con confirmación.
6. **Auditoría automática** — ampliar eventos en más servicios.
7. **SMTP producción** — configurar y probar con botón en UI.
8. **Go-live** — `pnpm db:push`, `pnpm db:reconciliar-balances --apply`, checklist en `docs/ESTADO_PRODUCCION.md`.

---

## Verificaciones recomendadas

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test:run
# Con .env.test local (Neon o Postgres):
pnpm test:integration:run
pnpm audit --prod
```

---

## Referencias

- [AUDITORIA.md](./AUDITORIA.md) — hallazgos y sección 12
- [docs/ESTADO_PRODUCCION.md](./docs/ESTADO_PRODUCCION.md) — checklist piloto
- [docs/ARCHIVOS_NO_VERSIONADOS.md](./docs/ARCHIVOS_NO_VERSIONADOS.md) — qué no subir a Git
