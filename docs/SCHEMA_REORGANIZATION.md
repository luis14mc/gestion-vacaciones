# 🏗️ Reorganización de Esquema - CNI Vacaciones

## 📋 Resumen

Reorganización atómica completa del esquema de base de datos según especificaciones CNI, separando responsabilidades en 5 módulos independientes con lógica de negocio implementada mediante triggers PostgreSQL.

## 📁 Estructura de Archivos

### Esquemas Drizzle (TypeScript)
```
src/lib/db/schema/atomic/
├── auth_rbac.ts              # Autenticación y RBAC
├── organizacion.ts           # Departamentos y jerarquías
├── config_solicitudes.ts     # Configuración de tipos de ausencias
├── core_solicitudes.ts       # Solicitudes y balances (CORE)
├── auditoria.ts              # Historial y auditoría
└── index.ts                  # Exportación centralizada
```

### Scripts SQL
```
database/
├── RESET_DATABASE.sql        # Reset completo con DROP SCHEMA CASCADE
└── 09_cni_business_logic.sql # Triggers y funciones de negocio
```

## 🎯 Cambios Principales

### 1. Nuevo Formato de Código CNI
**Antes:** `SOL-2026-XXXXXX`  
**Ahora:** `CNI-SOL-YYYY-XXXX`

**Implementación:**
- Función SQL: `generar_codigo_cni_solicitud(ano_laboral)`
- Auto-genera secuencialmente por año laboral
- Ejemplo: `CNI-SOL-2026-0001`, `CNI-SOL-2026-0002`

### 2. Campos de Control de Tiempo (CNI)

**Tabla `solicitudes`:**
```sql
hora_salida   TIME          -- Hora de salida (ausencias parciales)
hora_regreso  TIME          -- Hora de regreso (ausencias parciales)
```

**Validación:**
- Check constraint: Si `hora_salida` existe, `hora_regreso` también debe existir
- Índice compuesto: `idx_solicitudes_horas`

### 3. Aprobación Ejecutiva (CNI)

**Nuevos campos en `solicitudes`:**
```sql
autorizada_ejecutiva_por     BIGINT       -- Usuario que autoriza (FK a usuarios)
autorizada_ejecutiva_fecha   TIMESTAMP    -- Cuándo fue autorizada
comentario_ejecutiva         TEXT         -- Comentarios del ejecutivo
```

**Configuración en `tipos_ausencia_config`:**
```sql
requiere_aprobacion_ejecutiva  BOOLEAN  -- Indica si requiere nivel ejecutivo
```

### 4. Campo Calculado: `cantidad_disponible`

**Tabla `balances`:**
```sql
cantidad_disponible  DECIMAL(10,2)  -- Calculado automáticamente
```

**Fórmula:**
```
disponible = (inicial + acumulada) - (usada + pendiente)
```

**Implementación:**
- Trigger `trg_actualizar_cantidad_disponible`
- Se ejecuta en INSERT/UPDATE automáticamente
- Nunca puede ser negativo (validación adicional)

## 🔧 Nueva Arquitectura

### Auth & RBAC (`auth_rbac.ts`)
- **Tablas:** `usuarios`, `roles`, `permisos`, `roles_permisos`, `usuarios_roles`, `sessions`
- **Relaciones:** N:M con manejo de permisos granulares
- **Índices:** 18 índices optimizados para consultas de autenticación y autorización

### Organización (`organizacion.ts`)
- **Tablas:** `departamentos`, `usuarios_departamentos`
- **Jerarquía:** Soporte para departamentos padre-hijo (árbol organizacional)
- **Historial:** Tracking de asignaciones de departamentos con fechas

### Configuración (`config_solicitudes.ts`)
- **Tablas:** `anos_laborales`, `tipos_ausencia_config`
- **Políticas:** 12+ configuraciones por tipo de ausencia
- **Métodos de crédito:** `inicio_periodo`, `mensual`, `proporcional`, `manual`
- **Validaciones:** 2 check constraints para integridad de datos

### Core Solicitudes (`core_solicitudes.ts`)
- **Tablas:** `solicitudes`, `balances`
- **Estados:** 12 estados posibles en workflow de aprobación
- **Validaciones:** 4 check constraints incluyendo fechas y horas
- **Índices:** 25 índices para optimización de queries

### Auditoría (`auditoria.ts`)
- **Tablas:** `historial_balances`, `auditoria_operaciones`
- **Tracking:** Todos los movimientos de balance con contexto completo
- **Operaciones:** 11 tipos de operaciones auditadas

## 🚀 Flujo de Despliegue

### 1️⃣ Reset de Base de Datos (OPCIONAL)
```powershell
# Ejecuta RESET_DATABASE.sql en Neon Dashboard SQL Editor
# O usa psql:
psql $env:DATABASE_URL -f database/RESET_DATABASE.sql
```

### 2️⃣ Push de Esquemas con Drizzle
```powershell
pnpm drizzle-kit push
```
- Lee: `src/lib/db/schema/atomic/**/*.ts`
- Genera y aplica migraciones
- Sincroniza con PostgreSQL

### 3️⃣ Aplicar Lógica de Negocio
```powershell
psql $env:DATABASE_URL -f database/09_cni_business_logic.sql
```
- Crea función `generar_codigo_cni_solicitud()`
- Crea trigger `trg_actualizar_cantidad_disponible`
- Crea triggers `actualizar_updated_at` en 7 tablas

### 4️⃣ Seed Data
```powershell
pnpm tsx scripts/seed-database.ts
```

## 📊 Estadísticas del Schema

| Módulo | Tablas | Relaciones | Índices | Constraints |
|--------|--------|------------|---------|-------------|
| Auth & RBAC | 6 | 8 | 18 | 4 unique |
| Organización | 2 | 3 | 8 | 1 unique |
| Configuración | 2 | 2 | 12 | 4 (2 check) |
| Core | 2 | 8 | 25 | 8 (4 check) |
| Auditoría | 2 | 4 | 14 | 0 |
| **TOTAL** | **14** | **25** | **77** | **17** |

## 🔍 Funciones SQL Importantes

### 1. Generar Código CNI
```sql
SELECT generar_codigo_cni_solicitud(2026);
-- Retorna: 'CNI-SOL-2026-0001'
```

### 2. Trigger Cantidad Disponible
```sql
-- Se ejecuta automáticamente en:
UPDATE balances SET cantidad_usada = cantidad_usada + 5 WHERE id = 1;
-- cantidad_disponible se actualiza sin código adicional
```

### 3. Check Horas Completas
```sql
-- VÁLIDO:
INSERT INTO solicitudes (..., hora_salida, hora_regreso) 
VALUES (..., '09:00', '17:00');

-- VÁLIDO:
INSERT INTO solicitudes (..., hora_salida, hora_regreso) 
VALUES (..., NULL, NULL);

-- INVÁLIDO (trigger rechazará):
INSERT INTO solicitudes (..., hora_salida, hora_regreso) 
VALUES (..., '09:00', NULL);
```

## 📝 Checklist de Migración

- [x] ✅ Crear 5 esquemas atómicos en TypeScript
- [x] ✅ Implementar campos CNI (hora_salida, hora_regreso)
- [x] ✅ Agregar aprobación ejecutiva
- [x] ✅ Implementar cantidad_disponible con trigger
- [x] ✅ Crear función generar_codigo_cni_solicitud()
- [x] ✅ Escribir script RESET_DATABASE.sql
- [x] ✅ Documentar arquitectura completa
- [ ] ⏳ Ejecutar drizzle-kit push
- [ ] ⏳ Aplicar 09_cni_business_logic.sql
- [ ] ⏳ Actualizar seed script con nuevos campos
- [ ] ⏳ Ejecutar seed
- [ ] ⏳ Validar con integration tests

## 🎯 Próximos Pasos

1. **Ejecutar workflow de despliegue** (pasos 1-4 arriba)
2. **Actualizar servicios** para usar nuevo formato de código CNI
3. **Actualizar formularios** para incluir campos de hora
4. **Implementar workflow ejecutivo** en la UI
5. **Actualizar tests** para reflejar nueva estructura

## 📞 Información Técnica

- **Drizzle ORM:** 0.44.7
- **PostgreSQL:** 15+ (Neon Serverless)
- **Node:** 20+
- **TypeScript:** 5.8.3

## ⚠️ Notas Importantes

1. **RESET_DATABASE.sql** usa `DROP SCHEMA CASCADE` - **DESTRUCTIVO**
2. **Triggers automáticos** - No calcular `cantidad_disponible` manualmente
3. **Código CNI** - Usar función SQL, no generar en aplicación
4. **Aprobación ejecutiva** - Opcional, configurar por tipo de ausencia
5. **Índices** - Monitorear rendimiento con EXPLAIN ANALYZE

---

**Versión:** 4.0  
**Fecha:** 2026-02-05  
**Autor:** Arquitecto de Datos Senior
