# 🏗️ Plan de Refactorización - Arquitectura Database Senior

**Fecha:** 5 de febrero de 2026  
**Autor:** Senior Fullstack Developer & Database Architect  
**Objetivo:** Re-estructuración atómica de persistencia para escalabilidad y alto rendimiento

---

## 📊 AUDITORÍA INICIAL

### Estado Actual del Proyecto

#### ✅ Estructura Clean Architecture (Correcta)
```
src/
├── app/api/              # Presentation Layer (25 endpoints)
├── core/
│   ├── application/
│   │   └── services/     # Business Logic (4 servicios - 2,300 líneas)
│   ├── domain/
│   │   └── entities/     # Types e Interfaces
│   └── infrastructure/
│       └── database/     # Schema y DB connection (450 líneas)
├── lib/                  # Utilidades y helpers
└── services/             # ⚠️ DEPRECADO - Solo balance.service.ts
```

#### ⚠️ Problemas Identificados

**1. Archivo Monolítico de Schema**
- `src/core/infrastructure/database/schema.ts`: 450 líneas mezclando:
  - RBAC (Roles, Permisos, RolesPermisos)
  - Estructura Organizacional (Departamentos, Usuarios)
  - Configuración de Ausencias (TiposAusencia, Balances)
  - Solicitudes Core (Solicitudes, Historial)
  - Auditoría y Sistema

**2. Archivos SQL No Atómicos**
```
database/
├── 01_tipos_enums.sql                    # ✅ OK
├── 02_tablas_principales.sql             # ⚠️ Mezcla usuarios, departamentos, config
├── 03_balances_solicitudes.sql           # ⚠️ Mezcla balances, solicitudes, triggers
├── 04_vistas_funciones.sql               # ⚠️ Poco específico
├── 05_datos_iniciales.sql                # ⚠️ Mix de seeds
├── 06_migracion_soft_delete.sql          # ✅ OK (hotfix)
├── 07_seed_rbac_completo.sql             # ⚠️ Debería estar con definición RBAC
└── hotfix_jefe_exportar.sql              # ⚠️ Temporal/obsoleto
```

**3. Scripts Folder - 14 archivos temporales**
```
scripts/
├── add-rechazar-jefe.sql                 # ❌ Hotfix temporal
├── check-balances-testing.sql            # ❌ Testing ad-hoc
├── check-jefe-permisos.sql               # ❌ Debug query
├── check-permisos-2.3.sql                # ❌ Debug query
├── drop-all-tables.ts                    # ⚠️ Útil pero sin mantenimiento
├── fix-permisos-jefe.sql                 # ❌ Hotfix temporal
├── migrate.js                            # ❌ Reemplazado por Drizzle
├── reinstall-db.ps1                      # ⚠️ Puede ser útil
├── seed-balances-testing.sql             # ❌ Testing data
├── seed-configuraciones.ts               # ⚠️ Duplicado de 05_datos_iniciales
├── seed-departamentos.ts                 # ⚠️ Duplicado
├── seed-usuarios.js                      # ⚠️ Duplicado
├── seed.ts                               # ⚠️ Duplicado
└── test-login.ts                         # ❌ Testing temporal
```

**4. Código Legacy**
- `src/lib/db/schema.ts`: 6 líneas deprecadas (solo re-exporta)
- `src/services/balance.service.ts`: 246 líneas duplicando lógica de `core/application/services/balance.service.ts`

**5. Falta de Optimizaciones SQL**
- Sin CHECK constraints en fechas críticas
- Sin Generated Columns para cálculos frecuentes (balance disponible)
- Índices compuestos subóptimos para queries complejas
- Sin estrategia de particionamiento explícita documentada

---

## 🎯 PLAN DE LIMPIEZA

### 🗑️ Archivos a ELIMINAR (con justificación)

#### Código Legacy
```
✗ src/lib/db/schema.ts               # Deprecado, solo re-exporta
✗ src/services/balance.service.ts    # Duplicado de core/application/services/
```
**Razón:** Código previo a Clean Architecture, reemplazado por servicios en `core/application/services/`.

#### Scripts Temporales (11 archivos)
```
✗ scripts/add-rechazar-jefe.sql
✗ scripts/check-balances-testing.sql
✗ scripts/check-jefe-permisos.sql
✗ scripts/check-permisos-2.3.sql
✗ scripts/fix-permisos-jefe.sql
✗ scripts/migrate.js
✗ scripts/seed-balances-testing.sql
✗ scripts/seed-configuraciones.ts
✗ scripts/seed-departamentos.ts
✗ scripts/seed-usuarios.js
✗ scripts/test-login.ts
```
**Razón:** Scripts de testing/debugging ad-hoc, hotfixes aplicados, o duplicados de seeds oficiales en `database/`. No siguen versionado formal.

#### Archivos SQL Temporales
```
✗ database/hotfix_jefe_exportar.sql
```
**Razón:** Hotfix ya aplicado en versión anterior, no debe existir en producción.

#### ⚠️ A CONSERVAR (pero reestructurar)
```
✓ scripts/drop-all-tables.ts         # Útil para dev, necesita actualización
✓ scripts/reinstall-db.ps1           # Script de reinstalación completa
✓ scripts/seed.ts                    # Master seed (consolidar duplicados aquí)
```

---

## 🏛️ ARQUITECTURA ATÓMICA - NUEVA ESTRUCTURA

### Principios de Diseño Senior

#### 🔹 Separación por Bounded Context (DDD)
```
database/
├── 01_auth_rbac.sql               # Autenticación y autorización
├── 02_estructura_org.sql          # Estructura organizacional
├── 03_config_ausencias.sql        # Configuración de tipos de ausencia
├── 04_solicitudes_core.sql        # Core business: solicitudes y balances
├── 05_auditoria_logs.sql          # Logging y trazabilidad
└── 99_seeds/
    ├── seed_rbac.sql              # Roles y permisos iniciales
    ├── seed_departamentos.sql     # Departamentos base
    └── seed_config.sql            # Configuración del sistema
```

#### 🔹 Schema TypeScript Modular
```
src/core/infrastructure/database/
├── index.ts                       # Exports principales
├── db.ts                          # Conexión Drizzle
├── schemas/
│   ├── auth-rbac.schema.ts        # Roles, Permisos, RolesPermisos, UsuariosRoles
│   ├── estructura-org.schema.ts   # Departamentos, Usuarios
│   ├── ausencias.schema.ts        # TiposAusenciaConfig, Balances
│   ├── solicitudes.schema.ts      # Solicitudes, HistorialBalances
│   └── sistema.schema.ts          # Auditoria, ConfiguracionSistema
├── relations/
│   └── index.ts                   # Relaciones completas Drizzle
└── types/
    └── index.ts                   # Export de tipos inferidos
```

---

## 📐 DISEÑO DETALLADO - SQL ATÓMICO

### 01_auth_rbac.sql

**Propósito:** Sistema RBAC completo (Role-Based Access Control)

**Tablas:**
- `roles` - Roles del sistema
- `permisos` - Permisos granulares
- `roles_permisos` - Relación N:M
- `usuarios_roles` - Asignación usuario-rol-departamento

**Optimizaciones:**
```sql
-- Índices compuestos para búsqueda de permisos
CREATE INDEX idx_roles_permisos_lookup 
  ON roles_permisos(rol_id, permiso_id) 
  INCLUDE (created_at);

-- Índice para queries de autorización (más frecuente)
CREATE INDEX idx_usuarios_roles_auth 
  ON usuarios_roles(usuario_id, activo, fecha_expiracion) 
  WHERE activo = true AND (fecha_expiracion IS NULL OR fecha_expiracion > NOW());

-- Check constraint para fechas
ALTER TABLE usuarios_roles
  ADD CONSTRAINT chk_fecha_expiracion 
  CHECK (fecha_expiracion IS NULL OR fecha_expiracion > fecha_asignacion);
```

**Foreign Keys Strategy:**
- `ON DELETE CASCADE`: roles_permisos (si eliminas rol, eliminas permisos)
- `ON DELETE RESTRICT`: No permitido eliminar rol con usuarios asignados (integridad)

---

### 02_estructura_org.sql

**Propósito:** Jerarquía organizacional y usuarios

**Tablas:**
- `departamentos` - Estructura jerárquica con self-reference
- `usuarios` - Datos core de usuarios

**Optimizaciones:**
```sql
-- Generated Column para jerarquía (Materialized Path)
ALTER TABLE departamentos
  ADD COLUMN path TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN departamento_padre_id IS NULL THEN '/' || id::TEXT || '/'
      ELSE (SELECT path FROM departamentos p WHERE p.id = departamento_padre_id) || id::TEXT || '/'
    END
  ) STORED;

CREATE INDEX idx_departamentos_path ON departamentos USING GiST(path); -- Para búsquedas jerárquicas

-- Generated Column para nombre completo
ALTER TABLE usuarios
  ADD COLUMN nombre_completo VARCHAR(202) 
  GENERATED ALWAYS AS (nombre || ' ' || apellido) STORED;

CREATE INDEX idx_usuarios_nombre_completo 
  ON usuarios USING GIN(to_tsvector('spanish', nombre_completo)); -- Full-text search

-- Índice compuesto para listados filtrados (muy común)
CREATE INDEX idx_usuarios_depto_activo_apellido 
  ON usuarios(departamento_id, activo, apellido, nombre) 
  WHERE deleted_at IS NULL;

-- Check constraint para validación de email
ALTER TABLE usuarios
  ADD CONSTRAINT chk_email_valido 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

**Soft Delete Strategy:**
- `deleted_at TIMESTAMP`: Soft delete en usuarios y departamentos
- Índices con `WHERE deleted_at IS NULL` para performance

---

### 03_config_ausencias.sql

**Propósito:** Reglas de negocio para tipos de ausencia

**Tablas:**
- `tipos_ausencia_config` - Configuración dinámica de tipos
- `balances_ausencias` - Balances anuales por usuario/tipo

**Optimizaciones:**
```sql
-- Generated Column para balance disponible (CRÍTICO para performance)
ALTER TABLE balances_ausencias
  ADD COLUMN cantidad_disponible DECIMAL(10,2) 
  GENERATED ALWAYS AS (
    cantidad_asignada - cantidad_utilizada - cantidad_pendiente
  ) STORED;

-- Índice parcial solo para balances activos
CREATE INDEX idx_balances_activos 
  ON balances_ausencias(usuario_id, anio, estado, cantidad_disponible)
  WHERE estado = 'activo' AND deleted_at IS NULL;

-- Check Constraints para integridad de negocio
ALTER TABLE balances_ausencias
  ADD CONSTRAINT chk_cantidades_no_negativas 
  CHECK (
    cantidad_asignada >= 0 AND 
    cantidad_utilizada >= 0 AND 
    cantidad_pendiente >= 0
  ),
  ADD CONSTRAINT chk_utilizada_no_excede 
  CHECK (cantidad_utilizada <= cantidad_asignada),
  ADD CONSTRAINT chk_anio_razonable 
  CHECK (anio >= 2020 AND anio <= 2100);

-- Índice para reportes por año
CREATE INDEX idx_balances_anio_tipo 
  ON balances_ausencias(anio, tipo_ausencia_id, estado)
  INCLUDE (cantidad_asignada, cantidad_utilizada);
```

**Patrón de Versioning (Optimistic Locking):**
```sql
-- Trigger para version control
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_balances_version 
  BEFORE UPDATE ON balances_ausencias
  FOR EACH ROW EXECUTE FUNCTION increment_version();
```

---

### 04_solicitudes_core.sql

**Propósito:** Core del negocio - solicitudes y su historial

**Tablas:**
- `solicitudes` - Particionada por `created_at` (RANGE)
- `historial_balances` - Auditoría de cambios en balances

**Optimizaciones:**
```sql
-- Particionamiento por año (mejora queries por rango de fechas)
CREATE TABLE solicitudes (
  -- ... columnas ...
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Particiones existentes + crear automáticamente
CREATE TABLE solicitudes_2025 PARTITION OF solicitudes 
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE solicitudes_2026 PARTITION OF solicitudes 
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Función para crear particiones automáticamente
CREATE OR REPLACE FUNCTION crear_particion_solicitudes(anio INT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS solicitudes_%s PARTITION OF solicitudes 
     FOR VALUES FROM (%L) TO (%L)',
    anio,
    anio || '-01-01',
    (anio + 1) || '-01-01'
  );
END;
$$ LANGUAGE plpgsql;

-- Índices especializados por query pattern
-- Patrón 1: Usuario busca sus solicitudes filtradas por estado
CREATE INDEX idx_solicitudes_usuario_estado_fecha 
  ON solicitudes(usuario_id, estado, fecha_inicio DESC)
  INCLUDE (codigo, tipo_ausencia_id, cantidad)
  WHERE deleted_at IS NULL;

-- Patrón 2: Jefe busca solicitudes pendientes de su departamento
CREATE INDEX idx_solicitudes_pendientes_aprobacion
  ON solicitudes(estado, created_at DESC)
  INCLUDE (usuario_id, tipo_ausencia_id, fecha_inicio)
  WHERE estado IN ('pendiente', 'aprobada_jefe') AND deleted_at IS NULL;

-- Patrón 3: Búsqueda por código (único + lookup rápido)
CREATE UNIQUE INDEX idx_solicitudes_codigo_unique 
  ON solicitudes(codigo, created_at)
  WHERE deleted_at IS NULL;

-- Check Constraints para validación de fechas
ALTER TABLE solicitudes
  ADD CONSTRAINT chk_fecha_fin_mayor_inicio 
  CHECK (fecha_fin >= fecha_inicio),
  ADD CONSTRAINT chk_cantidad_positiva 
  CHECK (cantidad > 0),
  ADD CONSTRAINT chk_fechas_aprobacion_logicas
  CHECK (
    fecha_aprobacion_jefe IS NULL OR fecha_aprobacion_jefe >= fecha_solicitud
  ),
  ADD CONSTRAINT chk_fechas_rrhh_despues_jefe
  CHECK (
    fecha_aprobacion_rrhh IS NULL OR 
    fecha_aprobacion_jefe IS NULL OR 
    fecha_aprobacion_rrhh >= fecha_aprobacion_jefe
  );

-- Trigger para auto-generar código
CREATE OR REPLACE FUNCTION generar_codigo_solicitud()
RETURNS TRIGGER AS $$
DECLARE
  contador INTEGER;
  anio INT;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN 
    RETURN NEW; 
  END IF;
  
  anio := EXTRACT(YEAR FROM NEW.created_at);
  
  SELECT COUNT(*) + 1 INTO contador 
  FROM solicitudes 
  WHERE EXTRACT(YEAR FROM created_at) = anio;
  
  NEW.codigo := 'SOL-' || anio || '-' || LPAD(contador::TEXT, 6, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitud_codigo 
  BEFORE INSERT ON solicitudes 
  FOR EACH ROW EXECUTE FUNCTION generar_codigo_solicitud();
```

**Gestión de Estado y Transiciones:**
```sql
-- Check constraint para transiciones válidas de estado
ALTER TABLE solicitudes
  ADD CONSTRAINT chk_estado_valido_con_fechas
  CHECK (
    CASE 
      WHEN estado = 'aprobada_jefe' THEN fecha_aprobacion_jefe IS NOT NULL
      WHEN estado = 'aprobada' THEN fecha_aprobacion_rrhh IS NOT NULL
      WHEN estado = 'rechazada' THEN fecha_rechazo IS NOT NULL AND motivo_rechazo IS NOT NULL
      ELSE TRUE
    END
  );
```

---

### 05_auditoria_logs.sql

**Propósito:** Trazabilidad completa del sistema

**Tablas:**
- `auditoria` - Log de acciones (particionada por `fecha_creacion`)
- `configuracion_sistema` - Settings dinámicos

**Optimizaciones:**
```sql
-- Particionamiento mensual para auditoria (alto volumen)
CREATE TABLE auditoria (
  -- ... columnas ...
  PRIMARY KEY (id, fecha_creacion)
) PARTITION BY RANGE (fecha_creacion);

-- Particiones mensuales (3 meses retention en hot storage)
CREATE TABLE auditoria_2026_01 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Trigger para purga automática (data retention policy)
CREATE OR REPLACE FUNCTION purgar_auditoria_antigua()
RETURNS VOID AS $$
BEGIN
  -- Eliminar particiones mayores a 12 meses
  EXECUTE (
    SELECT string_agg('DROP TABLE IF EXISTS ' || tablename || ' CASCADE;', ' ')
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename LIKE 'auditoria_%'
      AND tablename::TEXT < 'auditoria_' || TO_CHAR(NOW() - INTERVAL '12 months', 'YYYY_MM')
  );
END;
$$ LANGUAGE plpgsql;

-- Índices para búsqueda de auditoría
CREATE INDEX idx_auditoria_usuario_fecha 
  ON auditoria(usuario_id, fecha_creacion DESC)
  INCLUDE (accion, tabla_afectada);

CREATE INDEX idx_auditoria_tabla_registro 
  ON auditoria(tabla_afectada, registro_id, fecha_creacion DESC)
  WHERE registro_id IS NOT NULL;

-- GIN index para búsqueda en detalles JSON
CREATE INDEX idx_auditoria_detalles 
  ON auditoria USING GIN(detalles jsonb_path_ops);
```

---

## 🔧 REFACTORIZACIÓN SCHEMA.TS MODULAR

### Nueva Estructura TypeScript

#### **schemas/auth-rbac.schema.ts**
```typescript
import { pgTable, bigserial, varchar, text, boolean, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';

// Roles
export const roles = pgTable('roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  nivel: integer('nivel').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  esRolSistema: boolean('es_rol_sistema').notNull().default(false),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  codigoIdx: index('idx_roles_codigo').on(table.codigo),
  nivelIdx: index('idx_roles_nivel').on(table.nivel)
}));

// Permisos
export const permisos = pgTable('permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 100 }).notNull().unique(),
  modulo: varchar('modulo', { length: 50 }).notNull(),
  accion: varchar('accion', { length: 50 }).notNull(),
  descripcion: text('descripcion'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  moduloAccionIdx: index('idx_permisos_modulo_accion').on(table.modulo, table.accion),
  codigoIdx: index('idx_permisos_codigo').on(table.codigo)
}));

// Roles-Permisos (N:M)
export const rolesPermisos = pgTable('roles_permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  permisoId: bigint('permiso_id', { mode: 'number' }).notNull()
    .references(() => permisos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueRolPermiso: uniqueIndex('uq_rol_permiso').on(table.rolId, table.permisoId),
  rolIdx: index('idx_roles_permisos_rol').on(table.rolId),
  permisoIdx: index('idx_roles_permisos_permiso').on(table.permisoId)
}));

// Usuarios-Roles (N:M con scope de departamento)
export const usuariosRoles = pgTable('usuarios_roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' }).notNull()
    .references(() => usuarios.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  departamentoId: bigint('departamento_id', { mode: 'number' })
    .references(() => departamentos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true }).defaultNow(),
  fechaExpiracion: timestamp('fecha_expiracion', { withTimezone: true }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueUsuarioRolDepto: uniqueIndex('uq_usuario_rol_depto').on(
    table.usuarioId, 
    table.rolId, 
    table.departamentoId
  ),
  usuarioIdx: index('idx_usuarios_roles_usuario').on(table.usuarioId),
  rolIdx: index('idx_usuarios_roles_rol').on(table.rolId),
  usuarioActivoIdx: index('idx_usuarios_roles_usuario_activo').on(table.usuarioId, table.activo)
}));

// Export types
export type Rol = typeof roles.$inferSelect;
export type NuevoRol = typeof roles.$inferInsert;
export type Permiso = typeof permisos.$inferSelect;
export type UsuarioRol = typeof usuariosRoles.$inferSelect;
```

#### **index.ts (Central Export)**
```typescript
// Re-export all schemas
export * from './schemas/auth-rbac.schema';
export * from './schemas/estructura-org.schema';
export * from './schemas/ausencias.schema';
export * from './schemas/solicitudes.schema';
export * from './schemas/sistema.schema';

// Re-export relations
export * from './relations';

// Re-export db connection
export { db } from './db';
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Preparación (Sin downtime)
- [ ] Crear backup completo de BD actual
- [ ] Crear rama Git: `refactor/atomic-database-architecture`
- [ ] Validar que todos los tests pasen en estado actual
- [ ] Documentar queries más lentos con `EXPLAIN ANALYZE`

### Fase 2: Limpieza de Código
- [ ] Eliminar `src/lib/db/schema.ts` (deprecado)
- [ ] Eliminar `src/services/balance.service.ts` (duplicado)
- [ ] Actualizar imports en archivos que usen paths obsoletos
- [ ] Eliminar 11 archivos temporales en `scripts/`
- [ ] Eliminar `database/hotfix_jefe_exportar.sql`

### Fase 3: Estructura SQL Atómica
- [ ] Crear `database/01_auth_rbac.sql` con optimizaciones
- [ ] Crear `database/02_estructura_org.sql` con generated columns
- [ ] Crear `database/03_config_ausencias.sql` con check constraints
- [ ] Crear `database/04_solicitudes_core.sql` con particiones
- [ ] Crear `database/05_auditoria_logs.sql` con retention policy
- [ ] Mover seeds a `database/99_seeds/`

### Fase 4: Schema TypeScript Modular
- [ ] Crear `src/core/infrastructure/database/schemas/auth-rbac.schema.ts`
- [ ] Crear `src/core/infrastructure/database/schemas/estructura-org.schema.ts`
- [ ] Crear `src/core/infrastructure/database/schemas/ausencias.schema.ts`
- [ ] Crear `src/core/infrastructure/database/schemas/solicitudes.schema.ts`
- [ ] Crear `src/core/infrastructure/database/schemas/sistema.schema.ts`
- [ ] Configurar `index.ts` con re-exports
- [ ] Mover relaciones a `relations/index.ts`

### Fase 5: Validación y Testing
- [ ] Ejecutar scripts SQL en ambiente local de testing
- [ ] Verificar integridad con queries de validación
- [ ] Ejecutar `EXPLAIN ANALYZE` en queries críticos (antes/después)
- [ ] Ejecutar suite de tests completa
- [ ] Validar performance con dataset de 10K+ solicitudes

### Fase 6: Documentación
- [ ] Actualizar `ARQUITECTURA.md` con nueva estructura
- [ ] Actualizar `CHANGELOG.md` con breaking changes y mejoras
- [ ] Crear `DATABASE_OPTIMIZATION.md` con benchmarks
- [ ] Actualizar `SERVICES.md` si hay cambios en interfaces

---

## 📊 MÉTRICAS DE ÉXITO

### Performance Targets
| Métrica | Antes | Target | Validación |
|---------|-------|--------|------------|
| Query "obtener solicitudes usuario" | ~45ms | <20ms | `EXPLAIN ANALYZE` |
| Query "balance disponible" | ~30ms | <10ms | Generated column |
| Insert solicitud con balance update | ~120ms | <80ms | Transaction optimizada |
| Búsqueda full-text usuarios | N/A | <50ms | GiST index |
| Tamaño tabla auditoria (12 meses) | ~500MB | <300MB | Particiones + purga |

### Code Quality
- Reducción de líneas en schema.ts: 450 → ~80 por módulo (5 módulos)
- Eliminación de archivos temporales: 14 → 3 archivos de utilidad
- Cobertura de check constraints: 0 → 15+ constraints
- Índices optimizados: +8 índices compuestos especializados

---

## ⚠️ CONSIDERACIONES DE PRODUCCIÓN

### Breaking Changes
1. **Imports de Schema**
   - Cambiar de: `import { usuarios } from '@/lib/db/schema'`
   - A: `import { usuarios } from '@/core/infrastructure/database'`
   - **Solución:** Los servicios ya usan paths correctos, solo validar

2. **Generated Columns**
   - `cantidad_disponible` en balances ahora es STORED
   - **Solución:** Eliminar cálculos en código, confiar en DB

3. **Check Constraints**
   - Validaciones más estrictas pueden fallar con data corrupta
   - **Solución:** Script de limpieza pre-migración

### Data Migration Strategy
```sql
-- 1. Verificar data inconsistente ANTES de agregar constraints
SELECT * FROM balances_ausencias 
WHERE cantidad_utilizada > cantidad_asignada;

SELECT * FROM solicitudes 
WHERE fecha_fin < fecha_inicio;

-- 2. Corregir data antes de migración
UPDATE balances_ausencias 
SET cantidad_utilizada = cantidad_asignada 
WHERE cantidad_utilizada > cantidad_asignada;

-- 3. Aplicar constraints gradualmente
-- Primero agregar sin validar data existente
ALTER TABLE balances_ausencias 
  ADD CONSTRAINT chk_utilizada_no_excede 
  CHECK (cantidad_utilizada <= cantidad_asignada) 
  NOT VALID;

-- Luego validar en background (no bloquea)
ALTER TABLE balances_ausencias 
  VALIDATE CONSTRAINT chk_utilizada_no_excede;
```

### Rollback Plan
1. **Git:** Mantener rama anterior hasta 1 semana de validación
2. **Database:** Backup antes de cada cambio de schema
3. **Código:** Mantener compatibilidad con rutas antiguas por 1 release

---

## 🚀 PRÓXIMOS PASOS

### Después de esta Refactorización
1. **Semana 3:** Implementación de Features avanzados sobre base sólida
2. **Optimización de Queries:** Usar índices compuestos en API routes
3. **Caching Layer:** Implementar Redis para balances y configuraciones
4. **Read Replicas:** Configurar Supabase read replicas para reportes
5. **Monitoring:** Implementar pg_stat_statements para query analysis

---

**Fecha de Implementación Propuesta:** 5-6 de febrero de 2026 (1-2 días)  
**Riesgo:** 🟡 Medio (Testing exhaustivo requerido)  
**ROI Esperado:** 40-60% mejora en queries complejos, base de código 50% más mantenible

