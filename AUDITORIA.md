# Auditoría y correcciones — Gestión de Vacaciones CNI

Rama: `fix/autorizacion-rbac` · 22 commits · Fecha: 2026-06

Auditoría integral del sistema (seguridad **y** funcionalidad), con foco
inicial en roles/permisos y extendida a todos los módulos. Cada hallazgo
fue corregido y verificado (`tsc --noEmit` limpio, build de Next OK, 115
pruebas unitarias y validaciones puntuales contra la BD real).

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
- **Regla fija: días laborables.** Sábados y domingos nunca se descuentan.
  Se eliminó el toggle contradictorio `vacaciones.incluir_fines_semana`.
- **Pendiente (sin datos):** feriados nacionales. Hoy un feriado entre
  semana se descuenta. Falta un catálogo de feriados para restarlos en
  `contarDiasHabiles()`.

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
- Eliminado el toggle contradictorio `departamentos.jefe_puede_auto_aprobar`.

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

---

## Checklist de despliegue

1. **Aplicar migraciones** en el entorno destino:
   - `drizzle/0003_rate_limits.sql`
   - `drizzle/0004_registros_auditoria.sql`
   - `drizzle/0005_balance_trigger.sql`
   (En la BD actual de Neon ya se aplicaron de forma idempotente.)
2. **Reconciliar balances** una sola vez tras desplegar el cambio de
   efectos/asignación: `pnpm db:reconciliar-balances --apply`.
3. **Garantizar un Director por departamento.** Con la jerarquía activa, si
   un departamento no tiene Director, las solicitudes de sus Jefes solo las
   podría aprobar un Admin.
4. **Revisar la configuración** (Seguridad, Vacaciones, Notificaciones): los
   valores ahora tienen efecto real.

## Pendientes conocidos (fuera de esta rama)

- **Catálogo de feriados nacionales** (para no descontar feriados como
  vacación).
- Atomicidad total de la asignación masiva/automática (hoy fila por fila).
- Pruebas de integración: corregir import roto (`validaciones.md` #8).
