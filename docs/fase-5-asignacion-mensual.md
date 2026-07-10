# Fase 5 — Asignación Mensual Automática de Vacaciones

> Documento de operación: cómo se asignan los días mes a mes, qué endpoints
> están disponibles, cómo se ejecuta automáticamente y cómo se audita.
>
> Última actualización: 2026-07-10.

## 1. Regla institucional

La asignación de vacaciones **NO** se hace como un único evento anual. Se
realiza **mes a mes, de forma proporcional**, según la antigüedad del
colaborador (Código de Trabajo).

| Antigüedad cumplida | Días anuales | Días mensuales (anual/12) |
|---|---|---|
| < 1 año | 0 | 0 |
| 1 año | 10 | 0.8333 |
| 2 años | 12 | 1.0000 |
| 3 años | 15 | 1.2500 |
| ≥ 4 años | 20 | 1.6667 |

Precisión:
- **BD**: `numeric(6,4)` para `dias_asignados` y `numeric(8,4)` para balances.
- **UI**: máximo 2 decimales (`formatDias` en `balance-display.ts`).
- **Cálculo**: 4 decimales (precisión para acumular 12 meses sin pérdida).

## 2. Modelo de datos

### `historial_asignaciones_mensuales`

Una fila por `(usuarioId, anio, mes)`. Restricción `UNIQUE` impide duplicados
al re-ejecutar el mismo mes.

```sql
usuario_id      bigint   → FK usuarios(id) ON DELETE CASCADE
anio            integer  -- rango 2000-2100 (CHECK)
mes             integer  -- rango 1-12 (CHECK)
dias_asignados  numeric(6,4)
balance_anterior numeric(8,4)
balance_nuevo    numeric(8,4)
dias_anuales_aplicados numeric(6,2)
anios_antiguedad integer
origen          varchar(20)  -- automatico | manual | sistema
ejecutado_por   bigint       → FK usuarios(id) ON DELETE SET NULL
ejecutado_en    timestamptz  DEFAULT now()
observacion     text
created_at / updated_at  timestamptz DEFAULT now()

UNIQUE (usuario_id, anio, mes)
INDEX (usuario_id, anio DESC)
INDEX (anio, mes)
```

### `notificaciones`

Una fila por aviso in-app generado. Usada por la asignación mensual:

```sql
usuario_id   bigint     → FK usuarios(id) ON DELETE CASCADE
tipo         varchar(50) -- asignacion_vacaciones | sistema | ...
titulo       varchar(200)
mensaje      text
referencia   varchar(200) -- "asignacion:<id>" | "solicitud:<id>" | ...
leida        boolean DEFAULT false
created_at   timestamptz DEFAULT now()
```

### `balances` (regla institucional)

La asignación mensual **solo** modifica `cantidad_acumulada`. El trigger de BD
(`drizzle/0005_balance_trigger.sql`) recalcula `cantidad_disponible`:

```
disponible = (inicial + acumulada) - (usada + pendiente)
```

| Campo | Significado |
|---|---|
| `cantidad_inicial` | Días vencidos del año |
| `cantidad_acumulada` | Días proporcionales acreditados mes a mes |
| `cantidad_usada` | Días consumidos en solicitudes finalizadas |
| `cantidad_pendiente` | Días reservados por solicitudes en curso |
| `cantidad_disponible` | Generado por trigger |

**No** se modifica `cantidad_inicial`, `cantidad_usada` ni `cantidad_pendiente`.

## 3. Servicio de dominio

- **Helper** (funciones puras): `src/lib/domain/vacaciones-asignacion.ts`
  - `calcularDiasAnualesPorAntiguedad(fechaIngreso, ref)`
  - `calcularDiasMensualesPorAntiguedad(fechaIngreso, ref)`
  - `calcularAntiguedadLaboral(fechaIngreso, ref)`
  - `resolverMesAsignacion({ fechaIngreso, anio, mes })`
  - `REGLAS_ASIGNACION_MENSUAL_VACACIONES` (catálogo UI)

- **Servicio** (orquestación): `src/services/asignacion-vacaciones.service.ts`
  - `asignarVacacionesMensuales({ anio, mes, origen, ejecutadoPor })`
  - `asignarVacacionesMensualesAUsuario({ usuarioId, anio, mes, origen, ejecutadoPor })`
  - `obtenerHistorialAsignacionesUsuario(usuarioId, { anio?, limite? })`
  - `obtenerResumenAsignacionesMensuales({ anio, mes })`

Reglas de orquestación:
- Solo empleados activos (`activo = true AND deletedAt IS NULL`).
- Usuarios sin `fechaIngreso` → omitidos.
- Antigüedad < 1 año → omitidos.
- Una sola asignación por `(usuarioId, anio, mes)` (DB UNIQUE + check en código).
- Ejecución transaccional (todo-o-nada).
- Auditoría: evento batch + un evento individual por asignación.
- Notificación: una fila in-app por asignación exitosa.

## 4. Endpoints HTTP

### `POST /api/admin/asignacion-mensual-vacaciones` (canónico)

- **Auth**: sesión activa + rol RRHH o Admin.
- **Body**: `{ anio: number, mes: 1-12, modo: "automatico" | "manual" }`
- **Respuesta**:
  ```json
  {
    "success": true,
    "data": {
      "anio": 2026, "mes": 7,
      "usuariosProcesados": 50,
      "asignacionesCreadas": 42,
      "usuariosOmitidos": 8,
      "totalDiasAsignados": 70.0
    }
  }
  ```
- **Errores**:
  - 401 sin sesión
  - 403 sin rol RRHH/Admin (jefe/empleado rechazados)
  - 400 mes/año fuera de rango
  - 500 sin año laboral activo

> Alias compat: `/api/admin/ejecutar-asignacion-mensual` re-exporta el
> mismo handler para compatibilidad con integraciones previas.

### `POST /api/cron/asignacion-mensual` (protegido por `CRON_SECRET`)

- **Auth**: `Authorization: Bearer <CRON_SECRET>`.
- **Body**: opcional `{ anio, mes, modo: "sistema" }`. Si se omite, usa mes/año actual.
- **Uso**: jobs externos (cron del SO, GitHub Action, etc.).

### `GET /api/vacaciones/asignaciones-mensuales`

- **Auth**: sesión activa.
- **Query params**:
  - `usuarioId=<id>` → historial individual (empleado solo ve el suyo;
    RRHH/Admin cualquiera; Jefe 403).
  - `anio=<YYYY>&mes=<M>` (RRHH/Admin, sin `usuarioId`) → resumen batch.

## 5. Ejecución manual

### A) Desde la UI

**Configuración → Vacaciones → Asignación mensual de vacaciones → Ejecutar**

- Selecciona Año y Mes.
- Pulsa **Ejecutar asignación mensual**.
- Toast muestra: `X asignaciones creadas · Y omitidos · Z días`.

### B) Desde la línea de comandos (con pnpm/node locales)

```bash
# Predeterminado: mes/año actual, modo=sistema
pnpm tsx scripts/asignar-vacaciones-mensuales.ts

# Explícito
pnpm tsx scripts/asignar-vacaciones-mensuales.ts --anio=2026 --mes=7
pnpm tsx scripts/asignar-vacaciones-mensuales.ts --anio=2026 --mes=7 --modo=automatico
```

### C) Desde EC2 (sin pnpm/node en el host)

**Opción 1 — Dentro del contenedor de la app:**
```bash
docker exec -it <contenedor_app> \
  node --import tsx scripts/asignar-vacaciones-mensuales.ts --anio=2026 --mes=7
```

**Opción 2 — Vía endpoint cron (recomendado):**
```bash
curl -X POST "https://<host>/api/cron/asignacion-mensual" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"anio":2026,"mes":7}'
```

## 6. Programación automática (cron)

### Recomendación: cron del SO llamando al endpoint protegido

```cron
# Ejecutar a las 03:00 hora HN del primer día de cada mes
0 3 1 * * curl -fsS -X POST \
  "https://<host>/api/cron/asignacion-mensual" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

El endpoint, si recibe body vacío, usa el mes/año actual (fallback automático).

### Alternativa: cron dentro del contenedor

Configurar crontab del usuario `nextjs` (o el definido en el Dockerfile):
```cron
0 3 1 * * cd /app && node --import tsx scripts/asignar-vacaciones-mensuales.ts >> /var/log/asignacion-mensual.log 2>&1
```

## 7. Verificación y auditoría

### Verificar que se ejecutó

```sql
-- Último batch procesado
SELECT anio, mes, COUNT(*) AS usuarios, SUM(dias_asignados) AS total
FROM historial_asignaciones_mensuales
GROUP BY anio, mes
ORDER BY anio DESC, mes DESC
LIMIT 6;

-- Detalle por empleado de un mes
SELECT u.email, h.anio, h.mes, h.dias_asignados, h.balance_anterior, h.balance_nuevo,
       h.anios_antiguedad, h.origen
FROM historial_asignaciones_mensuales h
JOIN usuarios u ON u.id = h.usuario_id
WHERE h.anio = 2026 AND h.mes = 7
ORDER BY u.email;
```

### Auditoría

Cada ejecución registra eventos en `registros_auditoria`:
- `accion=asignacion_vacaciones_mensual_batch` (1 por ejecución).
- `accion=asignacion_vacaciones_mensual` (1 por usuario exitoso).

```sql
SELECT created_at, accion, detalles
FROM registros_auditoria
WHERE accion LIKE 'asignacion_vacaciones_mensual%'
ORDER BY created_at DESC
LIMIT 20;
```

### Notificaciones

```sql
SELECT n.created_at, u.email, n.titulo, n.mensaje, n.leida
FROM notificaciones n
JOIN usuarios u ON u.id = n.usuario_id
WHERE n.tipo = 'asignacion_vacaciones'
ORDER BY n.created_at DESC
LIMIT 20;
```

## 8. Anti-duplicados

La protección es **defensa en profundidad**:

1. **`UNIQUE (usuario_id, anio, mes)`** en la tabla de historial:
   PostgreSQL rechaza el segundo INSERT con `23505 unique_violation`.
2. **Chequeo en código** antes de INSERT: la transacción primero hace
   `SELECT ... LIMIT 1` para devolver estado `omitido_duplicado` sin error
   HTTP.
3. **Trigger de balance**: aunque se ejecutara dos veces, el trigger
   `actualizar_cantidad_disponible_balance` solo se dispara en
   `INSERT/UPDATE`; un duplicado directo no se inserta.

Para re-ejecutar un mes ya procesado (p. ej. corrección administrativa):
```sql
DELETE FROM historial_asignaciones_mensuales
WHERE usuario_id = $1 AND anio = $2 AND mes = $3;
-- Revertir el efecto en balances (recomendado: ajustar manualmente con
-- /api/admin/asignar-dias u otro endpoint de ajuste).
```

## 9. Tests

Suite unitaria (mock BD):
- Cálculo puro: `tests/unit/vacaciones-asignacion.test.ts` (cubrir todas las
  antigüedades y casos borde).
- Servicio (orquestación): `tests/unit/asignacion-vacaciones.service.test.ts`
  (omitidos por inactivo/eliminado/duplicado, notificación, decimales).
- Endpoints: `tests/unit/api/asignacion-mensual-admin.test.ts` y
  `tests/unit/api/asignacion-mensual-history.test.ts` (RBAC).

```bash
pnpm test:run -- tests/unit/asignacion-vacaciones.service.test.ts \
               tests/unit/vacaciones-asignacion.test.ts \
               tests/unit/api/asignacion-mensual-admin.test.ts \
               tests/unit/api/asignacion-mensual-history.test.ts
```

## 10. Migración a producción

Tras el primer despliegue de Fase 5:

1. `pnpm db:push` aplica `drizzle/0009_asignacion_mensual.sql` (crea
   `historial_asignaciones_mensuales` y `notificaciones`).
2. `pnpm db:install` (si no está) aplica el trigger de BD si aún no se cargó.
3. La primera ejecución del mes siguiente generará asignaciones proporcionales
   para todos los colaboradores con ≥ 1 año de antigüedad.

> Si tenías balances antiguos en `cantidad_inicial` (asignación anual legacy),
> el trigger los respeta — esos importes siguen formando parte del disponible
> del empleado. La nueva asignación mensual **suma** a `cantidad_acumulada`.

## 11. Roles y permisos

| Acción | Admin | RRHH | Jefe | Empleado |
|---|---|---|---|---|
| Ejecutar asignación mensual | ✅ | ✅ | ❌ (403) | ❌ (403) |
| Ver historial propio | ✅ | ✅ | ✅ (el suyo) | ✅ (solo el suyo) |
| Ver historial de otro | ✅ | ✅ | ❌ (403) | ❌ (403) |
| Ver resumen batch (anio+mes) | ✅ | ✅ | ❌ | ❌ |
| Disparar cron | vía Bearer CRON_SECRET | n/a | n/a | n/a |

La regla está reforzada tanto en `middleware` como en cada endpoint
(`withErrorHandler` + chequeos explícitos de `session.esRrhh`/`esAdmin`).
