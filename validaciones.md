# Auditoria y plan de cambios - gestion-vacaciones

Fecha: 2026-06-01

## Resultado ejecutivo

El sistema esta funcionalmente avanzado y compila para produccion con Next.js 16 usando Webpack. Los modulos principales existen: autenticacion, usuarios, departamentos, solicitudes, aprobaciones, balances, dashboard, reportes, auditoria, configuracion SMTP, importacion Excel y despliegue Docker/Nginx.

Antes de cerrar una salida productiva estable, quedan pendientes criticos en seguridad, consistencia de roles, manejo de credenciales, pruebas de integracion, carga masiva y trazabilidad operacional.

## Verificaciones ejecutadas

- `./node_modules/.bin/tsc.cmd --noEmit`: OK.
- `./node_modules/.bin/next.cmd build --webpack`: OK, con advertencia de Next.js 16 sobre migrar `middleware.ts` a `proxy`.
- `corepack pnpm test:run`: falla por import inexistente en pruebas de integracion.
- `corepack pnpm audit --prod`: falla con 29 vulnerabilidades, incluyendo 1 critica.

## Pendientes criticos

1. Rotar y retirar credenciales versionadas.
   - `.env.test` esta trackeado y contiene una URL real de Neon.
   - Accion: rotar credenciales en Neon, eliminar secreto del repositorio, dejar `.env.test.example` sin valores reales y agregar `.env.test` a limpieza de historial si aplica.

2. Actualizar dependencias vulnerables.
   - `pnpm audit --prod` reporta 29 vulnerabilidades.
   - Impacto principal: `jspdf` con vulnerabilidad critica y altas; `exceljs` arrastra vulnerabilidades transitivas en `minimatch`, `jszip`, `tmp`, `uuid`, entre otras.
   - Accion: actualizar `jspdf` a version parcheada, revisar `jspdf-autotable`, evaluar reemplazo o override de transitivas de `exceljs`.

3. Eliminar contrasenas por defecto `1234`.
   - API de usuarios y carga masiva crean usuarios con password por defecto cuando no se envia una.
   - Accion: generar password temporal aleatoria, exigir cambio al primer login, o requerir columna/password temporal administrada.

4. Corregir autorizacion efectiva desde BD.
   - `getSession()` combina flags del token con flags de BD usando OR; si se revoca un rol en BD, el token podria seguir dando privilegios hasta expirar.
   - Accion: usar BD como fuente de verdad para flags/roles/permisos, o invalidar sesiones al cambiar roles.

5. Sincronizar `usuarios_roles` con flags legacy.
   - Editar flags `esAdmin`, `esRrhh`, `esDirector`, `esJefe` no garantiza consistencia con tabla `usuarios_roles`.
   - Accion: crear servicio unico `syncUserRoles()` usado por crear, editar, importar y endpoint `/api/usuarios/roles`.

6. Endurecer adjuntos.
   - Las solicitudes aceptan `documentosAdjuntos[].data` como string sin limite estricto por archivo, MIME real, extension, firma magica ni antivirus.
   - Accion: validar tipo/tamano, guardar archivos fuera de JSON DB si crecen, escanear adjuntos, y agregar validacion especifica para licencia medica.

7. Completar validacion de licencia medica.
   - Pendiente funcional solicitado: verificar si fechas del documento/foto coinciden con fechas ingresadas y si tiene sello medico.
   - Accion: implementar flujo con OCR/manual-review: validacion automatica asistida + estado "requiere revision" cuando no haya confianza.

8. Reparar pruebas de integracion.
   - `tests/integration/solicitudes.service.integration.test.ts` importa `../setup-integration`, pero el archivo real es `tests/integration/setup.ts`.
   - Accion: corregir import/config de Vitest integration y separar BD test de BD real.

## Pendientes altos

1. Crear suite de pruebas E2E/responsivo.
   - La auditoria visual responsive fue manual; falta automatizar con Playwright para desktop/tablet/mobile.

2. Migrar `middleware.ts` a `proxy`.
   - Next.js 16 reporta la convencion `middleware` como deprecada durante build.

3. Agregar CSP.
   - Hay headers basicos, pero falta `Content-Security-Policy` calibrada para Next/Auth/estilos.

4. Normalizar errores API.
   - Algunas rutas usan `withErrorHandler`, otras retornan `error.message` directo.

5. Revisar scopes de jefes.
   - Dashboard y calendario se ajustaron por departamento, pero aprobaciones usan subordinados por `jefeSuperiorId`. Hay que definir si la regla oficial es departamento, jerarquia directa, o ambas.

6. Gobernar scripts destructivos.
   - `database/HARD_RESET.sql`, `database/limpiar-usuarios.sql` y `scripts/limpiar-usuarios.ts` son peligrosos.
   - Accion: mover a carpeta `tools/dev-only`, agregar confirmacion, bloqueo por Neon/dev, y documentar uso.

7. Auditoria real de acciones.
   - Existe API de auditoria, pero los cambios criticos no registran automaticamente eventos.
   - Accion: insertar eventos desde servicios de usuarios, solicitudes, balances, configuracion e importacion.

## Plan de cambios propuesto

### Fase 1 - Seguridad y bloqueo productivo

- Retirar `.env.test` real y rotar credenciales Neon.
- Actualizar dependencias vulnerables y volver a correr `pnpm audit --prod`.
- Eliminar password por defecto `1234`.
- Ajustar `getSession()` para que BD sea fuente de verdad.
- Agregar CSP inicial y revisar headers Nginx/Next duplicados.

### Fase 2 - Consistencia funcional

- Crear servicio unico para roles/flags.
- Corregir carga masiva para:
  - jefe superior opcional para todos;
  - password temporal segura;
  - reporte de filas fallidas;
  - preview con advertencias no bloqueantes.
- Alinear aprobaciones de jefes: departamento vs jerarquia directa.
- Completar reglas de permisos, licencia medica y consumo de balance.

### Fase 3 - Calidad y pruebas

- Reparar pruebas de integracion.
- Agregar pruebas unitarias para:
  - permisos de salida por duracion;
  - licencia medica sin consumo de balance;
  - dashboard empleado vs jefe;
  - importacion Excel con directores y sin correo jefe.
- Agregar Playwright para flujos criticos y responsive.

### Fase 4 - Produccion AWS

- Validar `docker compose --profile setup run --rm db-setup` en entorno limpio.
- Confirmar que `drizzle/` este versionado y disponible para setup.
- Documentar runbook de despliegue EC2:
  - backup;
  - pull;
  - setup DB;
  - restart;
  - verificacion health/login/admin.
- Agregar monitoreo minimo: logs, espacio en disco, backup, expiracion SSL, estado contenedores.

### Fase 5 - ISO/IEC 12207

- Mantener trazabilidad requisito -> cambio -> prueba -> despliegue.
- Formalizar registros de:
  - requerimientos;
  - riesgos;
  - decisiones tecnicas;
  - validaciones;
  - evidencias de pruebas;
  - plan de mantenimiento.
