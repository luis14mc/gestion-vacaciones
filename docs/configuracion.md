# Configuración del Sistema — Auditoría integral

> Documento vivo. Última revisión: 2026-07-02.
>
> Alinea `src/app/configuracion/ConfiguracionClient.tsx` con el catálogo
> `src/lib/config/catalog.ts`, los schemas `src/lib/schemas/configuracion.schema.ts`
> y los consumidores reales en backend.

## 1. Fuente de verdad

| Capa | Archivo | Rol |
|---|---|---|
| UI | `src/app/configuracion/ConfiguracionClient.tsx` | Lee vía `GET /api/configuracion`, edita vía `PATCH /api/configuracion`. Solo renderiza claves presentes en `CONFIG_KEYS` (el backend ya filtra con `filtrarConfigCatalogo`). |
| Catálogo | `src/lib/config/catalog.ts` | `CONFIG_KEYS`, `CONFIG_FIELD_SCHEMAS`, `CONFIG_DEFAULT_VALUES`, `LEGACY_CONFIG_KEYS`, `validarConfig`, `getConfigMeta`, `filtrarConfigCatalogo`. |
| Schema | `src/lib/schemas/configuracion.schema.ts` | Zod por categoría: `general`, `vacaciones`, `notificaciones`, `departamentos`, `seguridad`. |
| Lector BD | `src/lib/config/service.ts` | `obtenerConfig` / `obtenerConfigs` con caché 30 s y fallback a `CONFIG_DEFAULT_VALUES`. |
| Política contraseñas | `src/lib/config/password-policy.ts`, `src/lib/config/password-expiry.ts` | Validador + expiración por antigüedad. |

## 2. Claves activas (consumidas por backend)

### 2.1 General
| Clave | Default | Consumidor | Efecto |
|---|---|---|---|
| `app.mantenimiento` | `false` | `src/components/MaintenanceGate.tsx` | Bloquea UI para no-admin cuando es `true`. |

> Las claves `app.nombre`, `app.version`, `app.empresa`, `app.siglas`, `app.pais`,
> `app.timezone`, `app.idioma` están en el catálogo y se exponen en la UI, pero
> **no son consumidas por backend**; se aceptan como **UI-only** (etiquetas
> informativas). Se permiten en la UI solo a efectos de identificación.

### 2.2 Vacaciones
| Clave | Default | Consumidor | Efecto |
|---|---|---|---|
| `vacaciones.dias_minimos_solicitud` | `1` | `src/services/solicitudes.service.ts:120` | Rechaza la solicitud si los días hábiles < N (error 400). |
| `vacaciones.dias_maximos_consecutivos` | `30` | `src/services/solicitudes.service.ts:121` | Rechaza la solicitud si los días hábiles > N (error 400). |
| `vacaciones.dias_anticipacion` | `0` | `src/services/solicitudes.service.ts:122` | Si > 0, exige que `fechaInicio` esté al menos N días en el futuro. |
| `vacaciones.permitir_medio_dia` | `false` | **Sin consumidor** | Clave retirada de la UI. Permanece en el catálogo por compatibilidad con la BD. |

> **Asignación automática por antigüedad** (no es una clave de configuración,
> sino una regla de dominio). Tabla en `src/lib/domain/asignacion-antiguedad.ts`
> + endpoint `POST /api/admin/asignar-dias`. La fuente es `usuarios.fechaIngreso`.
>
> | Antigüedad | Días asignados |
> |---|---|
> | Menos de 1 año | 0 |
> | 1 año cumplido | 10 |
> | 2 años cumplidos | 12 |
> | 3 años cumplidos | 15 |
> | 4 años o más | 20 |

### 2.3 Notificaciones
| Clave | Default | Consumidor | Efecto |
|---|---|---|---|
| `notificaciones.email_habilitado` | (vacío) | `src/services/email.service.ts:65` | Cortocircuita `enviarEmail` cuando es `false` (no se envía nada). |
| `notificaciones.email_remitente` | (vacío) | `src/services/email.service.ts:73` | Cabecera `from` del correo. |
| `notificaciones.smtp_host` | (vacío) | `src/services/email.service.ts:66` | Host del transporter. |
| `notificaciones.smtp_port` | (vacío) | `src/services/email.service.ts:62` | Puerto del transporter. |
| `notificaciones.smtp_user` | (vacío) | `src/services/email.service.ts:68` | Usuario autenticado SMTP. |
| `notificaciones.smtp_password` | (vacío) | `src/services/email.service.ts:69` | Contraseña SMTP. |
| `notificaciones.smtp_secure` | (vacío) | `src/services/email.service.ts:70` | `secure` del transporter. |
| `notificaciones.smtp_require_tls` | (vacío) | `src/services/email.service.ts:71` | `requireTLS` del transporter. |
| `notificaciones.smtp_reject_unauthorized` | (vacío) | `src/services/email.service.ts:72` | `tls.rejectUnauthorized` del transporter. |
| `notificaciones.notificar_jefe_nueva_solicitud` | `true` | `src/app/api/solicitudes/route.ts:400` | Activa el envío al jefe al crear una solicitud. |
| `notificaciones.notificar_empleado_aprobacion` | `true` | `src/services/workflow.service.ts:288` | Email al empleado en `aprobar_rrhh`. |
| `notificaciones.notificar_empleado_rechazo` | `true` | `src/services/workflow.service.ts:292` | Email al empleado en `rechazar_*`. |
| `notificaciones.notificar_rrhh_aprobacion_jefe` | `true` | `src/services/workflow.service.ts:273` | Email a todos los usuarios con rol RRHH en `aprobar_jefe`. |
| `notificaciones.recordatorio_dias_antes` | (sin default) | **Sin job ni cron** | Marcada como **"Próximamente"** en la UI; el valor se conserva pero no tiene efecto. |

> El SMTP **sí** se resuelve desde la BD (tabla `configuracion`) a través de
> `getConfiguracionEmail()` en `src/services/email.service.ts`. Los fallbacks
> `SMTP_HOST`, `SMTP_PORT`, etc. (variables en MAYÚSCULAS) solo se conservan por
> compatibilidad con instalaciones que aún los tuvieran en BD; la UI canónica
> usa los nombres `notificaciones.*`.

### 2.4 Departamentos
| Clave | Default | Consumidor | Efecto |
|---|---|---|---|
| `departamentos.max_ausencias_simultaneas` | `0` | `src/lib/domain/departamento-conflictos.ts:38` | Si > 0, rechaza la solicitud cuando el departamento ya tiene N ausencias simultáneas en esas fechas. |
| `departamentos.validar_conflictos` | `true` | `src/lib/domain/departamento-conflictos.ts:37` | Si es `true`, rechaza cuando el solicitante tiene otra solicitud que se superpone. |
| `departamentos.porcentaje_max_ausentes` | (sin default) | **Sin consumidor** | Retirada de la UI. Permanece en el catálogo por compatibilidad. |
| `departamentos.mostrar_calendario_equipo` | (sin default) | **Sin consumidor** | Retirada de la UI. Permanece en el catálogo por compatibilidad. |

### 2.5 Seguridad
| Clave | Default | Consumidor | Efecto |
|---|---|---|---|
| `seguridad.sesion_duracion_horas` | `24` | `src/auth.ts:132` (JWT) + `src/middleware.ts:35` + `src/lib/auth.ts:26` | Expiración absoluta del JWT; el middleware y `getSession` invalidan sesiones vencidas. |
| `seguridad.password_min_length` | `8` | `src/lib/config/password-policy.ts:20` | Longitud mínima al crear/importar/cambiar contraseña. |
| `seguridad.password_requiere_mayuscula` | `false` | `src/lib/config/password-policy.ts:21` | Exige A–Z. |
| `seguridad.password_requiere_numero` | `false` | `src/lib/config/password-policy.ts:22` | Exige 0–9. |
| `seguridad.password_requiere_especial` | `false` | `src/lib/config/password-policy.ts:23` | Exige carácter no alfanumérico. |
| `seguridad.intentos_login_max` | `5` | `src/lib/rate-limiter.ts:73` | Tras N fallos, bloquea el intento. |
| `seguridad.bloqueo_duracion_minutos` | `15` | `src/lib/rate-limiter.ts:74` | Duración de la ventana de bloqueo. |
| `seguridad.forzar_cambio_password_dias` | `0` | `src/lib/auth.ts:75` + `src/lib/config/password-expiry.ts` | Si > 0, fuerza el cambio cuando han pasado N días desde el último (`passwordChangedAt` en `usuarios.metadata`). |

## 3. Claves retiradas del catálogo (`LEGACY_CONFIG_KEYS`)

Estas claves **no** se sirven en `/api/configuracion` (las filtra
`filtrarConfigCatalogo`) y **no** aparecen en la UI. Se listan aquí
solo para limpieza idempotente en seed/SQL.

| Clave | Motivo de retirada |
|---|---|
| `departamentos.jefe_auto_aprobar` | Reemplazado por máquina de estados en `src/lib/domain/state-machine.ts`. |
| `departamentos.jefe_puede_auto_aprobar` | Idem. |
| `flujo.jefe_auto_aprobar` | Duplicado legacy. |
| `jefe_auto_aprobar` | Duplicado legacy. |
| `jefe_puede_auto_aprobar` | Duplicado legacy. |
| `vacaciones.acumulacion_habilitada` | Sin lógica de acumulación implementada. |
| `vacaciones.max_acumulacion` | Sin lógica de acumulación implementada. |

Limpieza segura: `database/limpiar-config-legacy.sql` (idempotente, no toca
usuarios/solicitudes/balances). El seed `scripts/seed-database.ts` ya no las crea.

## 4. Claves pendientes (visibles pero sin efecto real)

| Clave | Estado | Acción |
|---|---|---|
| `notificaciones.recordatorio_dias_antes` | **No implementado** | Marcada con badge **"Próximamente"** y deshabilitada en `ConfiguracionClient`. Hasta que exista un cron o job que la lea, su valor no se aplica. |

## 5. Verificación

- Test unitario: `pnpm test:run -- tests/unit/configuracion-auditoria.test.ts`
  - Catálogo: ninguna clave visible en `ConfiguracionClient` está fuera de `CONFIG_KEYS`.
  - Impacto: cada clave de negocio se referencia en al menos uno de sus archivos consumidores.
  - Vacaciones: `vacaciones.dias_anticipacion` devuelve 400 (no 500) cuando se viola.
  - Legacy: ninguna clave de `LEGACY_CONFIG_KEYS` aparece como clave visible; el seed no las siembra; el SQL de limpieza las borra.
- Test de catálogo existente: `tests/unit/config-catalog.test.ts`.
- Test de 400 (general): `tests/unit/api/solicitudes-post-errors.test.ts`.
- Tests de integración con BD real: `tests/integration/solicitudes.service.integration.test.ts`.

## 6. Cómo añadir una clave nueva

1. **Schema** → agregar en `src/lib/schemas/configuracion.schema.ts` con el
   validador Zod correspondiente (rango, regex, etc.).
2. **Catálogo** → el `Set` `CONFIG_KEYS` se deriva de los schemas, así que basta
   con tocar el schema. Si necesita un default distinto, añadirlo a
   `CONFIG_DEFAULT_VALUES`.
3. **Consumidor** → usar `obtenerConfig('clave.x')` /
   `obtenerConfigs(['clave.x', ...])` desde el servicio o dominio. **No**
   leer de la BD directamente.
4. **UI** → añadir la clave al array `claves` del grupo correspondiente en
   `GRUPOS` y, si quiere una etiqueta legible, a `LABELS`. Si no tiene consumidor
   real, marcarla en `CLAVES_NO_IMPLEMENTADAS` (badge "Próximamente") o
   `UI_ONLY_ACEPTADAS` (en el test de impacto).
5. **Seed** → añadir fila a `CONFIGURACION_DATA` en `scripts/seed-database.ts`
   con `esPublico` adecuado (regla: pública si es de `general` o `vacaciones`).
6. **Tests** → el test de impacto exige que la clave esté en el mapa
   `CLAVES_CONSUMIDAS` o marcada como UI-only.
