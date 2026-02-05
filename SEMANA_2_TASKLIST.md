# 📋 SEMANA 2 - Servicios de Negocio y Clean Architecture ✅ COMPLETADA

**Sistema de Gestión de Vacaciones - CNI Honduras**  
**Fecha**: 14-18 de enero de 2026 (Miércoles-Viernes)  
**Estado**: ✅ **COMPLETADA** (5 de febrero de 2026)  
**Prioridad**: 🟠 ALTA  
**Duración real**: 16 días (incluyendo refactorización BD)

---

## 🎉 RESUMEN EJECUTIVO - SEMANA 2 COMPLETADA

### ✅ Logros Principales

**Servicios de Negocio** (4 servicios, ~2,300 líneas):
- ✅ `solicitudes.service.ts` (~800 líneas) - 7 funciones
- ✅ `usuarios.service.ts` (~540 líneas) - 6 funciones
- ✅ `reportes.service.ts` (~430 líneas) - 4 funciones
- ✅ `balance.service.ts` (~180 líneas) - Documentado

**Refactorización Base de Datos**:
- ✅ 5 archivos SQL atómicos con optimizaciones Senior
- ✅ 7 módulos TypeScript schema independientes
- ✅ Índices B-tree + GIN para performance
- ✅ Particionado por rango en tabla auditoría
- ✅ Política de retención automática (30 días)

**API Routes Refactorizados** (8 endpoints, -526 líneas):
- ✅ POST /api/solicitudes (-41%)
- ✅ PATCH /api/solicitudes (-43%)
- ✅ GET /api/usuarios (-53%)
- ✅ POST /api/usuarios (-40%)
- ✅ PATCH /api/usuarios (-50%)
- ✅ DELETE /api/usuarios (-50%)
- ✅ POST /api/usuarios/roles (-56%)
- ✅ GET /api/reportes/departamento (refactorizado)

**Testing**:
- ✅ 60 tests unitarios passing
- ✅ 3 test files (solicitudes, usuarios, reportes)
- ✅ Framework Vitest configurado

**Validaciones**:
- ✅ Build: Successful (8.0s con Turbopack)
- ✅ Tests: 60/60 passing
- ✅ Import paths: 29 archivos corregidos

**Documentación** (~5,000 líneas):
- ✅ SERVICES.md (1,194 líneas)
- ✅ ARQUITECTURA.md v2.1.0 (455 líneas)
- ✅ CHANGELOG.md con métricas detalladas
- ✅ REFACTORING_PLAN.md (2,500+ líneas)

**Commits**:
- ✅ 20+ commits en rama `feature/semana-2-services`
- ✅ Pusheado a remote exitosamente
- ✅ 3 commits finales: 60b6d73, da929e4, 07c64e4

### 📊 Métricas Alcanzadas

| Métrica | Antes | Después | Resultado |
|---------|-------|---------|-----------|
| Líneas por API route | 150-200 | 30-80 | ✅ -60% promedio |
| Test coverage backend | <20% | 48% | ✅ +240% |
| Servicios de negocio | 1 | 4 | ✅ +300% |
| Tiempo de tests | N/A | <3seg | ✅ Excelente |
| Código duplicado | Alto | Bajo | ✅ -526 líneas |
| Progreso proyecto | 30% | 45% | ✅ +50% avance |

---

## 🎯 Objetivo Principal

Extraer la lógica de negocio de los API routes hacia **servicios reutilizables** siguiendo Clean Architecture, mejorando la testabilidad, mantenibilidad y reduciendo el acoplamiento con Next.js.

**Problema actual**: API routes con 150-200 líneas mezclando validaciones, lógica de negocio, queries SQL y manejo de errores.

**Solución**: Servicios puros de 300-450 líneas con funciones especializadas, testeables y reutilizables.

---

## 📊 Métricas de Éxito

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas por API route | 150-200 | 30-50 | -70% |
| Test coverage backend | <20% | >80% | +400% |
| Servicios de negocio | 1 | 4 | +300% |
| Tiempo de tests | N/A | <5seg | ✅ |
| Código duplicado | Alto | Bajo | ✅ |

---

## 📅 DÍA 1 (Miércoles 14/01) - Servicio de Solicitudes (Parte 1)

### ✅ Tareas

- [ ] **1.1 Crear estructura base del servicio** (1h)
  - Crear archivo: `src/core/application/services/solicitudes.service.ts`
  - Definir interfaces TypeScript:
    ```typescript
    export interface NuevaSolicitud {
      usuarioId: number;
      tipoAusenciaId: number;
      fechaInicio: Date;
      fechaFin: Date;
      cantidad: number;
      motivo: string;
      esPermiso: boolean;
      direccionDuranteAusencia?: string;
      telefonoDuranteAusencia?: string;
    }
    
    export interface FiltrosSolicitudes {
      usuarioId?: number;
      departamentoId?: number;
      estado?: string;
      fechaInicio?: Date;
      fechaFin?: Date;
      page?: number;
      pageSize?: number;
    }
    ```
  - Importar dependencias necesarias (db, schema, rbac)
  - Commit: `feat(services): Estructura base de solicitudes.service.ts`

- [ ] **1.2 Implementar crearSolicitud()** (3h)
  - **Funcionalidad**:
    * Validar usuario activo
    * Validar balance disponible
    * Generar código `SOL-2026-XXXXX` auto-incremental
    * Crear solicitud en transacción
    * Actualizar `balance.cantidadPendiente`
  - **Validaciones**:
    * Usuario existe y está activo
    * Balance existe para el año
    * Días disponibles >= días solicitados
    * Fechas válidas (inicio < fin)
  - **Manejo de errores**:
    * Lanzar excepciones descriptivas
    * Rollback automático en transacción
  - Testing manual: Crear solicitud con usuario válido
  - Commit: `feat(services): Implementar crearSolicitud() con validaciones`

- [ ] **1.3 Implementar aprobarSolicitudJefe()** (2.5h)
  - **Funcionalidad**:
    * Verificar permiso RBAC `vacaciones.solicitudes.aprobar_jefe`
    * Validar estado = `pendiente`
    * Verificar scope departamental (jefe del mismo depto)
    * Actualizar solicitud a `aprobada_jefe`
    * Control optimista con `version`
  - **Validaciones**:
    * Solicitud existe
    * Estado permite aprobación
    * Jefe pertenece al departamento del solicitante
    * No hay lost updates (version match)
  - Testing manual: Jefe aprobando solicitud de su depto
  - Commit: `feat(services): Implementar aprobarSolicitudJefe() con scope`

- [ ] **1.4 Implementar aprobarSolicitudRRHH()** (1.5h)
  - **Funcionalidad**:
    * Verificar permiso RBAC `vacaciones.solicitudes.aprobar_rrhh`
    * Validar estado = `aprobada_jefe`
    * Actualizar solicitud a `aprobada` (final)
    * Mover días: `cantidadPendiente` → `cantidadUtilizada`
    * Registrar fecha de aprobación
  - **Validaciones**:
    * Solicitud existe
    * Estado = aprobada_jefe
    * Balance tiene suficiente pendiente
  - Testing manual: RRHH aprobando solicitud válida
  - Commit: `feat(services): Implementar aprobarSolicitudRRHH() con balance`

**Total Día 1**: 8 horas  
**Entregables**: solicitudes.service.ts con 4 funciones core

---

## 📅 DÍA 2 (Jueves 15/01) - Servicio de Solicitudes (Parte 2)

### ✅ Tareas

- [ ] **2.1 Implementar rechazarSolicitud()** (2h)
  - **Funcionalidad**:
    * Verificar permiso RBAC `vacaciones.solicitudes.rechazar`
    * Validar estado no sea `rechazada` ni `aprobada` (final)
    * Actualizar solicitud a `rechazada`
    * Devolver días al balance (pendiente → disponible)
    * Registrar rechazador y motivo
  - **Validaciones**:
    * Estado válido para rechazo
    * Motivo obligatorio
    * Lost update control
  - Testing manual: Jefe y RRHH rechazando solicitudes
  - Commit: `feat(services): Implementar rechazarSolicitud() con devolución`

- [ ] **2.2 Implementar obtenerSolicitudes()** (2h)
  - **Funcionalidad**:
    * Query con filtros opcionales (usuario, depto, estado, fechas)
    * Paginación (page, pageSize)
    * Aplicar RBAC automáticamente:
      - Admin/RRHH: todas las solicitudes
      - Jefe: solo de su departamento
      - Empleado: solo propias
    * Incluir datos relacionados (usuario, tipo ausencia, aprobadores)
    * Ordenar por fecha creación DESC
  - Testing manual: Consultar con diferentes roles
  - Commit: `feat(services): Implementar obtenerSolicitudes() con RBAC`

- [ ] **2.3 Implementar obtenerSolicitudPorId()** (1h)
  - **Funcionalidad**:
    * Query por ID con todas las relaciones
    * Validar permisos RBAC:
      - Puede ver si es suya
      - Puede ver si es jefe del depto
      - Puede ver si es Admin/RRHH
    * Lanzar 404 si no existe
    * Lanzar 403 si no tiene permiso
  - Testing manual: Ver solicitud propia y ajena
  - Commit: `feat(services): Implementar obtenerSolicitudPorId()`

- [ ] **2.4 Refactorizar API route POST /api/solicitudes** (1.5h)
  - Abrir: `src/app/api/solicitudes/route.ts`
  - Reemplazar lógica por llamada a servicio:
    ```typescript
    export async function POST(request: NextRequest) {
      const session = await getSession();
      if (!session) return unauthorized();
      
      const body = await request.json();
      
      try {
        const solicitud = await crearSolicitud({
          usuarioId: session.user.id,
          ...body
        });
        
        return NextResponse.json({ 
          success: true, 
          data: solicitud 
        });
      } catch (error) {
        return handleServiceError(error);
      }
    }
    ```
  - Reducir de ~100 líneas → ~25 líneas
  - Testing E2E: Crear solicitud desde UI
  - Commit: `refactor(api): Simplificar POST /api/solicitudes con servicio`

- [ ] **2.5 Refactorizar API route PATCH /api/solicitudes** (1.5h)
  - Reemplazar lógica de aprobación/rechazo por servicios
  - Reducir de ~150 líneas → ~40 líneas
  - Mantener validaciones de entrada
  - Testing E2E: Aprobar/rechazar desde UI
  - Commit: `refactor(api): Simplificar PATCH /api/solicitudes con servicios`

**Total Día 2**: 8 horas  
**Entregables**: solicitudes.service.ts completo (7 funciones), 2 API routes refactorizados

---

## 📅 DÍA 3 (Viernes 16/01) - Servicio de Usuarios

### ✅ Tareas

- [ ] **3.1 Crear estructura del servicio** (0.5h)
  - Crear archivo: `src/core/application/services/usuarios.service.ts`
  - Definir interfaces:
    ```typescript
    export interface NuevoUsuario {
      email: string;
      password: string;
      nombre: string;
      apellido: string;
      cedula: string;
      departamentoId: number;
      fechaIngreso: Date;
      cargo?: string;
    }
    
    export interface ActualizarUsuario {
      nombre?: string;
      apellido?: string;
      departamentoId?: number;
      cargo?: string;
      activo?: boolean;
    }
    ```
  - Commit: `feat(services): Estructura base de usuarios.service.ts`

- [ ] **3.2 Implementar crearUsuario()** (3h)
  - **Funcionalidad**:
    * Validar email único
    * Hash de contraseña con bcrypt (10 rounds)
    * Crear usuario en transacción
    * Asignar rol EMPLEADO por defecto
    * Crear balances iniciales para tipos de ausencia activos
    * Registrar en auditoría
  - **Validaciones**:
    * Email formato válido
    * Email no existe
    * Contraseña mínimo 8 caracteres
    * Departamento existe
  - Testing manual: Crear usuario con Admin
  - Commit: `feat(services): Implementar crearUsuario() con roles y balances`

- [ ] **3.3 Implementar actualizarUsuario()** (1.5h)
  - **Funcionalidad**:
    * Validar usuario existe
    * Validar email único si se cambia
    * Actualizar solo campos proporcionados
    * Registrar en auditoría
    * Control optimista con version
  - **Validaciones**:
    * Usuario existe
    * Email único (si cambia)
    * Departamento existe (si cambia)
  - Testing manual: RRHH editando empleado
  - Commit: `feat(services): Implementar actualizarUsuario()`

- [ ] **3.4 Implementar desactivarUsuario()** (1h)
  - **Funcionalidad**:
    * Soft delete (activo = false)
    * Desactivar todos los roles del usuario
    * NO eliminar datos históricos
    * Registrar quien desactivó
    * Auditoría completa
  - **Validaciones**:
    * Usuario existe
    * Usuario no está ya desactivado
    * No puede desactivarse a sí mismo
  - Testing manual: Admin desactivando usuario
  - Commit: `feat(services): Implementar desactivarUsuario() soft delete`

- [ ] **3.5 Implementar asignarRolConValidacion()** (1.5h)
  - **Funcionalidad**:
    * Validar rol existe en tabla `roles`
    * Validar permisos del ejecutor
    * Verificar si usuario ya tiene el rol
    * Asignar rol con departamento opcional
    * Registrar en auditoría
  - **Validaciones**:
    * Rol válido
    * Usuario activo
    * No duplicar rol existente
    * DepartamentoId requerido si es JEFE
  - Testing manual: Admin asignando rol JEFE
  - Commit: `feat(services): Implementar asignarRolConValidacion()`

- [ ] **3.6 Implementar cambiarContraseña()** (1h)
  - **Funcionalidad**:
    * Verificar contraseña actual con bcrypt.compare()
    * Validar nueva contraseña (min 8 chars, complejidad)
    * Hash nueva contraseña
    * Actualizar en BD
    * Registrar en auditoría
  - **Validaciones**:
    * Contraseña actual correcta
    * Nueva contraseña diferente a actual
    * Nueva contraseña cumple requisitos
  - Testing manual: Usuario cambiando su password
  - Commit: `feat(services): Implementar cambiarContraseña() con validaciones`

**Total Día 3**: 8.5 horas  
**Entregables**: usuarios.service.ts completo (6 funciones)

---

## 📅 DÍA 4 (Lunes 19/01) - Refactorización API Usuarios y Servicio Reportes

### ✅ Tareas

- [ ] **4.1 Refactorizar GET /api/usuarios** (1h)
  - Simplificar query usando lógica de servicio
  - Mantener solo validación de sesión y respuesta
  - Reducir de ~80 líneas → ~30 líneas
  - Testing E2E: Listar usuarios con diferentes roles
  - Commit: `refactor(api): Simplificar GET /api/usuarios`

- [ ] **4.2 Refactorizar POST /api/usuarios** (1h)
  - Usar `crearUsuario()` del servicio
  - Reducir de ~100 líneas → ~25 líneas
  - Testing E2E: Crear usuario desde UI
  - Commit: `refactor(api): Simplificar POST /api/usuarios con servicio`

- [ ] **4.3 Refactorizar PATCH y DELETE /api/usuarios** (1h)
  - Usar `actualizarUsuario()` y `desactivarUsuario()`
  - Simplificar manejo de errores
  - Testing E2E: Editar y desactivar usuarios
  - Commit: `refactor(api): Simplificar PATCH/DELETE /api/usuarios`

- [ ] **4.4 Refactorizar /api/usuarios/roles** (1h)
  - Usar `asignarRolConValidacion()` del servicio
  - Reducir lógica de validación
  - Testing E2E: Asignar/remover roles
  - Commit: `refactor(api): Simplificar /api/usuarios/roles con servicio`

- [ ] **4.5 Crear reportes.service.ts** (2h)
  - Crear archivo: `src/core/application/services/reportes.service.ts`
  - Implementar `generarReporteGeneral()`:
    * Métricas del sistema (usuarios, solicitudes, balances)
    * Top departamentos por uso
    * Tendencias mensuales
    * Queries optimizados con agregaciones
  - Implementar `generarReporteDepartamento()`:
    * Métricas específicas del departamento
    * Lista de colaboradores con balances
    * Próximas vacaciones
    * Validar RBAC (Jefe solo su depto)
  - Commit: `feat(services): Crear reportes.service.ts con 2 funciones`

- [ ] **4.6 Implementar funciones de exportación** (2h)
  - Implementar `exportarReporteExcel()`:
    * Usar librería ExcelJS
    * Generar archivo con estilos profesionales
    * Múltiples hojas (resumen, detalle, gráficos)
    * Retornar Buffer
  - Implementar `exportarReporteCSV()`:
    * Formato RFC 4180 compliant
    * Encoding UTF-8 con BOM
    * Headers descriptivos
    * Retornar string
  - Commit: `feat(services): Implementar exportación Excel/CSV`

**Total Día 4**: 8 horas  
**Entregables**: 4 API routes refactorizados, reportes.service.ts completo

---

## 📅 DÍA 5 (Martes 20/01) - Testing, Documentación y Cierre

### ✅ Tareas

- [ ] **5.1 Setup de testing con Vitest** (1.5h)
  - Instalar dependencias:
    ```bash
    pnpm add -D vitest @vitest/ui @testing-library/react jsdom
    ```
  - Crear `vitest.config.ts`:
    ```typescript
    import { defineConfig } from 'vitest/config'
    import react from '@vitejs/plugin-react'
    import path from 'path'
    
    export default defineConfig({
      plugins: [react()],
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './tests/setup.ts'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src')
        }
      }
    })
    ```
  - Crear `tests/setup.ts` con mocks de BD
  - Commit: `test: Setup Vitest para unit testing`

- [ ] **5.2 Unit tests de solicitudes.service** (2.5h)
  - Crear: `tests/unit/services/solicitudes.service.test.ts`
  - Tests de `crearSolicitud()`:
    * ✅ Debe crear solicitud con código generado
    * ✅ Debe validar balance disponible
    * ❌ Debe rechazar si saldo insuficiente
    * ❌ Debe rechazar si usuario inactivo
    * ✅ Debe actualizar balance.cantidadPendiente
  - Tests de `aprobarSolicitudJefe()`:
    * ✅ Debe aprobar si jefe del mismo depto
    * ❌ Debe rechazar si jefe de otro depto
    * ❌ Debe rechazar si estado no es pendiente
    * ✅ Debe actualizar estado a aprobada_jefe
  - Tests de `aprobarSolicitudRRHH()`:
    * ✅ Debe aprobar si estado es aprobada_jefe
    * ❌ Debe rechazar si estado no es aprobada_jefe
    * ✅ Debe mover días a cantidadUtilizada
  - Tests de `rechazarSolicitud()`:
    * ✅ Debe rechazar y devolver días al balance
    * ❌ Debe rechazar si ya está rechazada
  - Target: 15+ tests con coverage >80%
  - Commit: `test: Unit tests para solicitudes.service.ts`

- [ ] **5.3 Unit tests de usuarios.service** (1.5h)
  - Crear: `tests/unit/services/usuarios.service.test.ts`
  - Tests de `crearUsuario()`:
    * ✅ Debe crear usuario con hash de password
    * ✅ Debe asignar rol EMPLEADO por defecto
    * ❌ Debe rechazar email duplicado
    * ✅ Debe crear balances iniciales
  - Tests de `actualizarUsuario()`:
    * ✅ Debe actualizar solo campos proporcionados
    * ❌ Debe rechazar email duplicado
  - Tests de `cambiarContraseña()`:
    * ✅ Debe cambiar si password actual correcto
    * ❌ Debe rechazar si password actual incorrecto
  - Target: 10+ tests con coverage >75%
  - Commit: `test: Unit tests para usuarios.service.ts`

- [ ] **5.4 Crear SERVICES.md** (1h)
  - Documentar cada servicio con:
    * Propósito y responsabilidad
    * Funciones públicas con firma completa
    * Ejemplos de uso
    * Errores que puede lanzar
    * Validaciones que realiza
  - Sección para cada servicio:
    * solicitudes.service.ts
    * usuarios.service.ts
    * reportes.service.ts
    * balance.service.ts (actualizar doc existente)
  - Commit: `docs: Crear SERVICES.md con documentación completa`

- [ ] **5.5 Actualizar ARQUITECTURA.md** (0.5h)
  - Actualizar sección de servicios implementados
  - Marcar como ✅ los servicios completados:
    * ✅ balance.service.ts
    * ✅ solicitudes.service.ts
    * ✅ usuarios.service.ts
    * ✅ reportes.service.ts
  - Agregar ejemplos de uso de servicios
  - Commit: `docs: Actualizar ARQUITECTURA.md con servicios completados`

- [ ] **5.6 Actualizar CHANGELOG.md** (0.5h)
  - Agregar sección "Semana 2 - Servicios de Negocio"
  - Listar refactorizaciones realizadas
  - Métricas de mejora (coverage, líneas reducidas)
  - Breaking changes: Ninguno (cambios internos)
  - Commit: `docs: CHANGELOG.md - Semana 2 completada`

- [ ] **5.7 Code review y limpieza final** (1h)
  - Revisar todos los commits de la semana
  - Eliminar console.logs innecesarios
  - Verificar imports sin usar
  - Linter pass en todos los archivos
  - Verificar que tests pasan: `pnpm test`
  - Commit: `chore: Code cleanup y optimizaciones finales`

- [ ] **5.8 Build final y validación** (0.5h)
  - Ejecutar `pnpm build`
  - Verificar 0 errores TypeScript
  - Verificar 0 errores de tests
  - Verificar coverage >75% en servicios
  - Testing E2E manual de flujos críticos
  - Commit: `test: Validación Semana 2 - Servicios de negocio`

**Total Día 5**: 9 horas  
**Entregables**: Suite de tests completa, documentación actualizada, build exitoso

---

## 📊 Resumen de la Semana

### Estadísticas Esperadas

| Métrica | Valor Inicial | Valor Final | Mejora |
|---------|---------------|-------------|--------|
| **Servicios creados** | 1 | 4 | +300% |
| **Líneas por API route (promedio)** | 150 | 35 | -77% |
| **API routes refactorizados** | 0 | 8 | +800% |
| **Test coverage servicios** | 0% | >80% | +∞ |
| **Tests unitarios** | 0 | 30+ | +3000% |
| **Archivos de documentación** | 3 | 5 | +67% |

### Servicios Implementados (4)

#### 1. solicitudes.service.ts (~450 líneas)
- ✅ crearSolicitud()
- ✅ aprobarSolicitudJefe()
- ✅ aprobarSolicitudRRHH()
- ✅ rechazarSolicitud()
- ✅ obtenerSolicitudes()
- ✅ obtenerSolicitudPorId()
- ✅ cancelarSolicitud()

#### 2. usuarios.service.ts (~300 líneas)
- ✅ crearUsuario()
- ✅ actualizarUsuario()
- ✅ desactivarUsuario()
- ✅ asignarRolConValidacion()
- ✅ removerRol()
- ✅ cambiarContraseña()

#### 3. reportes.service.ts (~250 líneas)
- ✅ generarReporteGeneral()
- ✅ generarReporteDepartamento()
- ✅ exportarReporteExcel()
- ✅ exportarReporteCSV()

#### 4. balance.service.ts (ya existe - ~180 líneas)
- ✅ calcularBalanceUsuario()
- ✅ actualizarBalancePorSolicitud()
- ✅ registrarDiasPendientes()

### API Routes Refactorizados (8)

#### Solicitudes (2)
- ✅ POST /api/solicitudes (200 → 25 líneas)
- ✅ PATCH /api/solicitudes (150 → 40 líneas)

#### Usuarios (4)
- ✅ GET /api/usuarios (80 → 30 líneas)
- ✅ POST /api/usuarios (100 → 25 líneas)
- ✅ PATCH /api/usuarios (70 → 20 líneas)
- ✅ DELETE /api/usuarios (50 → 20 líneas)

#### Gestión de Roles (1)
- ✅ POST /api/usuarios/roles (90 → 30 líneas)
- ✅ DELETE /api/usuarios/roles (70 → 25 líneas)

### Testing y Calidad

- 📊 **30+ unit tests** implementados
- 🎯 **Coverage >80%** en servicios
- 🚀 **Tests ejecutan en <5seg**
- ✅ **0 errores TypeScript**
- ✅ **0 errores de lint**

---

## 🚨 Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Romper funcionalidad existente | Media | Alto | Tests E2E antes de cada refactorización |
| Time overrun en testing | Alta | Medio | Priorizar tests críticos (crear, aprobar) |
| Dificultad con mocks de BD | Media | Medio | Usar transacciones en tests, rollback automático |
| Coverage <80% | Media | Bajo | Focus en happy path + casos de error principales |

---

## 📝 Notas Importantes

### ⚠️ Antes de Empezar

1. **Branch nueva**: Crear `feature/semana-2-services` desde `feature/semana-1-rbac-integration`
2. **Backup de BD**: Asegurar que datos de testing estén disponibles
3. **Tests E2E**: Validar funcionalidad actual antes de refactorizar
4. **Commits incrementales**: Un commit por función implementada

### 🔑 Comandos Útiles

```bash
# Crear branch
git checkout -b feature/semana-2-services

# Instalar dependencias de testing
pnpm add -D vitest @vitest/ui @testing-library/react jsdom

# Correr tests
pnpm test                    # Correr todos
pnpm test:ui                # UI interactiva
pnpm test:coverage          # Con coverage report

# Validar build
pnpm build
pnpm lint
```

### 📊 Coverage Target por Servicio

- `solicitudes.service.ts`: >85% (crítico)
- `usuarios.service.ts`: >80% (crítico)
- `reportes.service.ts`: >70% (reportes)
- `balance.service.ts`: >75% (ya existe)

---

## ✅ Checklist Final de Viernes 20/01

Antes de dar por completada la semana, verificar:

**Código**:
- [ ] 4 servicios implementados y funcionando
- [ ] 8 API routes refactorizados
- [ ] Todos los imports actualizados
- [ ] 0 código comentado sin usar
- [ ] 0 console.logs de debug

**Testing**:
- [ ] 30+ unit tests implementados
- [ ] Coverage >75% en servicios
- [ ] Todos los tests pasan (0 failures)
- [ ] Tests corren en <5 segundos

**Documentación**:
- [ ] SERVICES.md creado (~400 líneas)
- [ ] ARQUITECTURA.md actualizado
- [ ] CHANGELOG.md con Semana 2
- [ ] Postman collection actualizada (opcional)

**Git**:
- [ ] Todos los commits pusheados
- [ ] Pull Request creado con descripción detallada
- [ ] Code review solicitado
- [ ] CI/CD pasa (si existe)

**Validación Final**:
- [ ] `pnpm build` exitoso
- [ ] `pnpm test` exitoso
- [ ] `pnpm lint` sin errores
- [ ] Testing E2E manual de flujos críticos

---

## 🎯 Objetivo de Cierre de Semana

**Al finalizar el viernes 20/01, el sistema CNI Honduras debe tener**:
- ✅ Lógica de negocio desacoplada de Next.js
- ✅ 4 servicios puros y testeables
- ✅ API routes simplificados (−70% líneas)
- ✅ Suite de tests unitarios (>30 tests)
- ✅ Coverage >75% en servicios
- ✅ Base sólida para continuar con Semana 3 (Frontend Refactor)

**Progreso del proyecto**: 30% → 45% (objetivo)

---

## 🔜 Vista Previa Semana 3

**Semana 3-4: Frontend Refactor (Shared Components)**
- Crear librería de componentes UI reutilizables
- Implementar custom hooks
- Crear módulos feature-based
- Storybook para documentación de componentes
- Testing de componentes con React Testing Library

---

**Documento creado**: 13 de enero de 2026  
**Inicio planeado**: Miércoles 14 de enero de 2026  
**Fin planeado**: Viernes 20 de enero de 2026  
**Responsable**: Equipo de desarrollo CNI  
**Próximo milestone**: Semana 3 - Frontend Refactor

---

**🇭🇳 Consejo Nacional de Inversiones - Honduras**  
**Sistema de Gestión de Vacaciones y Permisos**  
**Clean Architecture | Services Layer | Unit Testing**
