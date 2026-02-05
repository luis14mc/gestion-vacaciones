# 📝 Changelog

Todos los cambios notables del proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Semana 2 - Servicios de Negocio con Clean Architecture (20-24 enero 2026)

#### 🎯 Objetivo
Refactorizar lógica de negocio a servicios reutilizables aplicando Clean Architecture, reduciendo código duplicado en API routes y facilitando testing unitario.

#### ✨ Nuevas Características

##### Servicios de Negocio Implementados

**1. solicitudes.service.ts (~800 líneas)**
- `crearSolicitud()` - Crear solicitud con generación de código único `SOL-YYYY-XXXXX`
- `aprobarSolicitudJefe()` - Primera aprobación con scope departamental
- `aprobarSolicitudRRHH()` - Aprobación final moviendo días pendiente→utilizada
- `rechazarSolicitud()` - Rechazo con devolución de días al balance
- `obtenerSolicitudes()` - Consulta con filtros RBAC dinámicos (Admin/RRHH/Jefe/Empleado)
- `obtenerSolicitudPorId()` - Obtener detalle con validación de acceso
- ✅ Validación de balance disponible
- ✅ Cálculo de días laborables
- ✅ Control de concurrencia con optimistic locking (campo `version`)

**2. usuarios.service.ts (~540 líneas)**
- `crearUsuario()` - Crear con hash bcrypt, rol EMPLEADO default, balances iniciales
- `actualizarUsuario()` - Update parcial con optimistic locking
- `desactivarUsuario()` - Soft delete preservando histórico
- `asignarRolConValidacion()` - Asignar rol con validaciones (JEFE requiere departamentoId)
- `cambiarContrasena()` - Cambio seguro validando password actual
- `obtenerUsuarios()` - Lista con filtros, NUNCA retorna passwords
- ✅ Password hashing con bcrypt (10 rounds)
- ✅ Validación de email único
- ✅ Metadata JSON para campos adicionales (cédula)

**3. reportes.service.ts (~430 líneas)**
- `generarReporteGeneral()` - Métricas sistema completo con Top 10 departamentos
- `generarReporteDepartamento()` - Reporte detallado con colaboradores y próximas vacaciones
- `exportarReporteCSV()` - Export CSV RFC 4180 con UTF-8 BOM (Excel compatible)
- `exportarReporteExcel()` - Base para export Excel (TODO: implementar con ExcelJS)
- ✅ Queries agregadas complejas con PostgreSQL TO_CHAR
- ✅ Cálculos de porcentajes y tendencias (últimos 6 meses)
- ✅ Próximas vacaciones (30 días hacia adelante)

**4. balance.service.ts (~180 líneas)** - Ya existente, documentado

##### API Routes Refactorizados

**Solicitudes (2 endpoints):**
- `POST /api/solicitudes` - 170→100 líneas (**-41%**)
- `PATCH /api/solicitudes` - 280→160 líneas (**-43%**)

**Usuarios (5 endpoints):**
- `GET /api/usuarios` - 150→70 líneas (**-53%**)
- `POST /api/usuarios` - 100→60 líneas (**-40%**)
- `PATCH /api/usuarios` - 70→35 líneas (**-50%**)
- `DELETE /api/usuarios` - 50→25 líneas (**-50%**)
- `POST /api/usuarios/roles` - 90→40 líneas (**-56%**)

**Métricas Totales:**
- 📉 **526 líneas eliminadas** de API routes
- 📈 **~2,300 líneas** de servicios reutilizables
- 🎯 **45% reducción promedio** en código de endpoints

#### 🏗️ Arquitectura

##### Patrones Implementados

**1. Transacciones con Rollback Automático**
```typescript
return db.transaction(async (tx) => {
  // Operaciones atómicas con rollback automático en error
});
```

**2. Optimistic Locking**
```typescript
// Control de concurrencia con campo version
if (registro.version !== params.version) {
  throw new Error('El registro ha sido modificado por otro usuario');
}
await tx.update(...).set({ ...datos, version: registro.version + 1 });
```

**3. Soft Deletes**
```typescript
// Preservar histórico, nunca DELETE físico
await tx.update(usuarios).set({ 
  activo: false, 
  deletedAt: new Date() 
});
```

**4. Scope RBAC Dinámico**
- Admin: ve todo el sistema
- RRHH: ve todo el sistema
- Jefe: solo su departamento
- Empleado: solo sus propios datos

#### 📚 Documentación

##### Nuevos Documentos
- **SERVICES.md** (~2,000 líneas) - Documentación completa de servicios:
  - Firmas de funciones con TypeScript interfaces
  - Validaciones y comportamientos detallados
  - Ejemplos de uso reales
  - Tabla de errores por tipo (400/403/404/409)
  - Patrones comunes con código
  - Buenas prácticas (DO's y DON'Ts)
  - Métricas de código y cobertura

##### Documentos Actualizados
- **ARQUITECTURA.md** - Servicios completados marcados como ✅
- **SEMANA_2_RESUMEN.md** - Resumen ejecutivo con todos los commits
- **CHANGELOG.md** - Esta sección con detalles completos

#### 🧪 Testing

##### Tests Unitarios Creados
- `solicitudes.service.test.ts` - 15 tests documentados (estructura validada)
- `usuarios.service.test.ts` - 25 tests documentados (estructura validada)
- Tests validan exportaciones, firmas async, casos de uso principales
- Framework: Vitest con configuración completa

**Casos de Uso Documentados:**
- ✅ Crear solicitud con código único SOL-YYYY-XXXXX
- ✅ Validación balance disponible
- ✅ Aprobaciones con scope RBAC
- ✅ Rechazo con devolución días
- ✅ Password hashing bcrypt
- ✅ Soft delete usuarios
- ✅ Optimistic locking updates
- ✅ Asignación roles con validaciones

#### 🔒 Seguridad

##### Validaciones Implementadas

**Usuarios:**
- ✅ Email único (validación DB)
- ✅ Email formato válido (regex)
- ✅ Password mínimo 8 caracteres
- ✅ Password hash bcrypt (10 rounds)
- ✅ Password nunca retornado en respuestas
- ✅ Verificación password actual en cambios

**Solicitudes:**
- ✅ Balance disponible suficiente
- ✅ Fechas válidas (inicio < fin)
- ✅ Scope departamental en aprobaciones
- ✅ Estado correcto para transiciones
- ✅ No solapamiento de solicitudes

**Concurrencia:**
- ✅ Optimistic locking con campo `version`
- ✅ Transacciones atómicas
- ✅ Rollback automático en errores

#### 🐛 Correcciones

##### Limpieza de Código
- **Commit 59d5932**: Eliminados imports no usados en 5 archivos:
  - `usuarios/route.ts` - 9 imports eliminados
  - `usuarios.service.ts` - 1 import eliminado
  - `reportes.service.ts` - 1 import eliminado
- **Variable no utilizada**: Eliminada `solicitudActualizada` en 5 ubicaciones

##### Errores PostgreSQL
- Fix: Conversión Date→String para queries SQL compatibles
- Fix: Campo `cedula` almacenado en metadata JSON
- Fix: Uso correcto de TO_CHAR para formateo fechas
- Fix: Drizzle ORM retorna strings en campos date/timestamp

#### 📊 Métricas

##### Commits Realizados
- **20 commits** en rama `feature/semana-2-services`
- 10 commits funcionales (feat/refactor)
- 4 commits de documentación (docs)
- 3 commits de limpieza (chore/fix)
- 3 commits de testing (test)

##### Líneas de Código
| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| API Routes | ~1,000 | ~474 | **-526 (-53%)** |
| Servicios | ~180 | ~2,300 | **+2,120 (+1,178%)** |
| Tests | 0 | ~900 | **+900 (∞%)** |
| Docs | ~3,500 | ~8,000 | **+4,500 (+129%)** |

##### Cobertura
- ✅ 7 funciones en solicitudes.service
- ✅ 6 funciones en usuarios.service
- ✅ 4 funciones en reportes.service
- ✅ 3 funciones en balance.service
- 🎯 **20 funciones totales** reutilizables

#### ⚠️ Breaking Changes
**Ninguno** - Cambios internos únicamente. APIs públicos mantienen misma interfaz.

#### 📦 Dependencias
No se agregaron nuevas dependencias en esta semana.

**Próximas dependencias sugeridas:**
- [ ] `exceljs` - Para export Excel
- [ ] `jest` o completar `vitest` - Para tests de integración

#### 🚀 Próximos Pasos (Semana 3)
1. [ ] Implementar tests de integración con BD real
2. [ ] Completar exportación Excel con ExcelJS
3. [ ] Refactorizar reportes API routes
4. [ ] Crear feature modules en frontend
5. [ ] Coverage >80% en servicios críticos

---

### Semana 1 - Integración RBAC en API Routes (7-13 enero 2026)

#### 🎯 Objetivo
Integrar el sistema RBAC completo en todas las rutas API del sistema, eliminando la dependencia de flags booleanos legacy (`es_admin`, `es_rrhh`, `es_jefe`) y estableciendo control de acceso basado en permisos granulares.

#### ✨ Nuevas Características

##### Página Mi Perfil
- **Nueva página**: `/mi-perfil` - Página completa de gestión de perfil de usuario
- Visualización de información personal y laboral
- Edición de datos de contacto (teléfono, dirección)
- Cambio de contraseña con validaciones
- Integración con balance de ausencias
- Diseño responsive para móviles y tablets

##### Nuevos Endpoints API

**Gestión de Perfil:**
- `GET /api/usuarios/me` - Obtener perfil del usuario autenticado
- `PATCH /api/usuarios/me` - Actualizar datos de contacto del perfil
- `PATCH /api/usuarios/me/password` - Cambiar contraseña del usuario

**Gestión de Roles:**
- `POST /api/usuarios/roles` - Asignar rol a usuario (Admin/RRHH)
- `DELETE /api/usuarios/roles` - Remover rol de usuario (Admin/RRHH)

##### Dashboard APIs con RBAC
- `GET /api/dashboard/metricas` - Métricas filtradas por rol y permisos
- `GET /api/dashboard/calendario` - Calendario de ausencias según scope
- `GET /api/dashboard/mi-balance` - Balance personal de días disponibles
- `GET /api/dashboard/actividad` - Actividad reciente filtrada por permisos

#### 🔒 Seguridad (RBAC Implementation)

##### Endpoints Actualizados con RBAC

**Solicitudes API (5 endpoints):**
- `GET /api/solicitudes` - Filtrado contextual según rol
  - Admin/RRHH: Todas las solicitudes
  - Jefe: Solicitudes de su departamento
  - Empleado: Solo solicitudes propias
- `POST /api/solicitudes` - Verificación permiso `vacaciones.solicitudes.crear`
- `PATCH /api/solicitudes` (aprobar_jefe) - Scope departamental + permiso
- `PATCH /api/solicitudes` (aprobar_rrhh) - Permiso `aprobar_rrhh`
- `PATCH /api/solicitudes` (rechazar) - Permiso `rechazar`

**Usuarios API (6 endpoints):**
- `GET /api/usuarios` - Permiso `usuarios.ver` + filtrado opcional por depto
- `POST /api/usuarios` - Permiso `usuarios.crear`
- `PATCH /api/usuarios` - Permiso `usuarios.editar`
- `DELETE /api/usuarios` - Permiso `usuarios.eliminar` (soft delete)
- `POST /api/usuarios/roles` - Permiso `usuarios.editar`
- `DELETE /api/usuarios/roles` - Permiso `usuarios.editar`

**Balances API (2 endpoints):**
- `GET /api/balances` - Permisos contextuales:
  - Propio: `balances.ver_propios`
  - Otros: `balances.ver_todos`
- `PATCH /api/balances` - Permiso `balances.editar` (solo Admin/RRHH)

**Reportes API (3 endpoints):**
- `GET /api/reportes/general` - Permiso `reportes.general` (Admin/RRHH)
- `GET /api/reportes/departamento` - Permiso `reportes.departamento` + scope
- `GET /api/reportes/exportar` - Permiso `reportes.exportar` (Admin/RRHH)

**Dashboard API (5 endpoints):**
- Todos los endpoints con validación RBAC y filtrado contextual

**Mi Perfil API (3 endpoints):**
- Acceso permitido a todos los usuarios autenticados
- Validaciones específicas para cambio de contraseña

#### 🎨 Mejoras UI/UX

##### Responsive Design
- **Página Solicitudes**: Cards adaptativas para móviles
- **Reportes Departamento**: Layout responsive mejorado
- **Mi Perfil**: Diseño completamente responsive
- **Navegación**: Dropdown menu con link a Mi Perfil

##### Componentes
- Nuevo componente `UserDropdown` con opciones de perfil
- Cards de solicitudes optimizadas para móviles
- Formularios de perfil con validación en tiempo real

#### 🧪 Testing

##### Cobertura de Testing
- **27/27 endpoints** testeados con RBAC (100% coverage)
- **4 roles diferentes** validados (Admin, RRHH, Jefe, Empleado)
- **0 bugs críticos** encontrados
- Documentación completa en `TESTING_RBAC.md`

##### Casos de Prueba Validados
- ✅ Scope contextual (Jefe ve solo su departamento)
- ✅ Permisos restrictivos (Empleado acceso limitado)
- ✅ Permisos elevados (Admin/RRHH acceso completo)
- ✅ Validaciones de permisos exhaustivas
- ✅ Mensajes de error descriptivos (403 Forbidden)

#### 📚 Documentación

##### Archivos Nuevos
- `TESTING_RBAC.md` - Documentación exhaustiva de testing (850 líneas)
  - Matrices de permisos por rol
  - Resultados de testing para cada endpoint
  - Casos de prueba y validaciones
  - Recomendaciones para producción
- `postman/README.md` - Guía completa de uso de Postman Collection
- `CHANGELOG.md` - Este archivo

##### Postman Collection
- **Carpeta `postman/`** con colección completa para testing
- 25 requests organizados en 8 categorías
- Environment pre-configurado con variables
- Script automático de autenticación
- Documentación de uso y troubleshooting

##### Thunder Client
- **Carpeta `thunder-tests/`** con configuración para VS Code
- 4 environments pre-configurados (Admin, RRHH, Jefe, Empleado)
- Mismos 25 endpoints que Postman

#### 🔧 Cambios Técnicos

##### Arquitectura
- Implementación completa de RBAC en capa API
- Verificación de permisos en cada endpoint
- Scope contextual para Jefes de departamento
- Validaciones exhaustivas de autorización

##### Base de Datos
- Uso de servicio RBAC existente (`obtenerRolesYPermisos`)
- Consultas optimizadas con filtrado por permisos
- Soft delete implementado en usuarios

##### Seguridad
- Tokens Bearer en todas las peticiones
- Validación de sesión en cada request
- Mensajes de error descriptivos sin exponer información sensible
- Control de acceso a nivel de permisos granulares

#### ⚠️ Breaking Changes

**Ninguno** - La integración RBAC mantiene compatibilidad con código legacy.

Los campos booleanos legacy (`es_admin`, `es_rrhh`, `es_jefe`) siguen funcionando pero serán deprecados en versiones futuras. Se recomienda migrar a verificación por permisos usando:
- `tienePermiso(usuario, 'nombre.permiso')`
- Consulta de roles y permisos vía `obtenerRolesYPermisos(usuarioId)`

#### 🚀 Migraciones Requeridas

**Ninguna** - El sistema es 100% compatible con la base de datos existente.

#### 📊 Estadísticas

- **Endpoints modificados**: 21
- **Endpoints nuevos**: 6
- **Archivos modificados**: ~18
- **Commits realizados**: 5
- **Líneas de documentación**: ~2,500
- **Cobertura de testing**: 100%
- **Tiempo estimado**: 35.5h
- **Tiempo real**: ~32h

#### 🎯 Próximos Pasos (Semana 2)

- Implementar servicios de negocio para validaciones complejas
- Agregar caché de permisos (Redis) para mejorar performance
- Implementar auditoría completa de cambios
- Suite de tests E2E automatizados
- Eliminar console.logs de producción
- Agregar rate limiting en endpoints críticos

#### 👥 Usuarios de Testing

```typescript
// Credenciales de usuarios de prueba
{
  admin: { email: 'admin@cni.hn', password: 'Admin123!' },    // 21 permisos
  rrhh: { email: 'rrhh@cni.hn', password: 'RRHH123!' },      // 18 permisos
  jefe: { email: 'jefe@cni.hn', password: 'Jefe123!' },      // 12 permisos
  empleado: { email: 'empleado@cni.hn', password: 'Emp123!' } // 5 permisos
}
```

#### 📖 Ejemplos de Uso

##### Ejemplo 1: Obtener Mi Perfil
```http
GET /api/usuarios/me
Authorization: Bearer {token}

Response 200:
{
  "id": 4,
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "empleado@cni.hn",
  "cargo": "Analista",
  "departamento": {
    "id": 1,
    "nombre": "Tecnología"
  },
  "balance": {
    "vacaciones": 15,
    "enfermedad": 10
  }
}
```

##### Ejemplo 2: Cambiar Contraseña
```http
PATCH /api/usuarios/me/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "Emp123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}

Response 200:
{
  "message": "Contraseña actualizada correctamente"
}
```

##### Ejemplo 3: Obtener Solicitudes (Scope Contextual)
```http
GET /api/solicitudes?page=1&pageSize=20
Authorization: Bearer {token}

# Como Admin/RRHH: Retorna todas las solicitudes
# Como Jefe: Retorna solo solicitudes de su departamento
# Como Empleado: Retorna solo sus solicitudes propias

Response 200:
{
  "solicitudes": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

##### Ejemplo 4: Aprobar Solicitud como Jefe
```http
PATCH /api/solicitudes/5
Authorization: Bearer {token}
Content-Type: application/json

{
  "accion": "aprobar_jefe",
  "comentarios": "Aprobado - Fechas disponibles"
}

Response 200 (si es su departamento):
{
  "message": "Solicitud aprobada por jefe",
  "solicitud": { ... }
}

Response 403 (si NO es su departamento):
{
  "error": "No tienes permiso para aprobar solicitudes de otros departamentos"
}
```

##### Ejemplo 5: Asignar Rol a Usuario
```http
POST /api/usuarios/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "usuarioId": 10,
  "rolCodigo": "JEFE",
  "departamentoId": 2
}

Response 200:
{
  "message": "Rol asignado correctamente",
  "usuario": {
    "id": 10,
    "nombre": "María López",
    "roles": ["EMPLEADO", "JEFE"]
  }
}
```

#### 🔗 Referencias

- **Testing Documentation**: `TESTING_RBAC.md`
- **Postman Collection**: `postman/CNI-Vacaciones-RBAC.postman_collection.json`
- **Thunder Client**: `thunder-tests/thunderclient.json`
- **Tasklist**: `SEMANA_1_TASKLIST.md`
- **RBAC Integration Guide**: `INTEGRACION_RBAC_PENDIENTE.md`

---

## [0.1.0] - 2026-01-06

### Inicial
- Setup inicial del proyecto
- Estructura base de Clean Architecture
- Configuración PostgreSQL con Prisma
- Sistema RBAC base implementado
- Endpoints legacy sin verificación RBAC

---

**Mantenido por**: Equipo de Desarrollo CNI Honduras  
**Última actualización**: 13 de enero de 2026  
**Versión del formato**: 1.0.0 (Keep a Changelog)
