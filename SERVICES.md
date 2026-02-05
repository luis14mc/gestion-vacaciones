# Documentación de Servicios - Gestión de Vacaciones CNI

> **Clean Architecture - Application Layer**  
> Servicios de negocio implementados en `src/core/application/services/`

---

## 📑 Tabla de Contenidos

1. [Solicitudes Service](#solicitudes-service)
2. [Usuarios Service](#usuarios-service)
3. [Reportes Service](#reportes-service)
4. [Balance Service](#balance-service)
5. [RBAC Service](#rbac-service)
6. [Patrones Comunes](#patrones-comunes)
7. [Manejo de Errores](#manejo-de-errores)

---

## 📋 Solicitudes Service

**Archivo**: `src/core/application/services/solicitudes.service.ts` (~800 líneas)

**Propósito**: Gestión completa del ciclo de vida de solicitudes de ausencia, incluyendo creación, aprobación, rechazo y consultas con RBAC.

### Funciones Principales

#### `crearSolicitud(params: NuevaSolicitud): Promise<Solicitud>`

Crea una nueva solicitud de ausencia con validaciones de negocio.

**Parámetros**:
```typescript
interface NuevaSolicitud {
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
```

**Validaciones**:
- ✅ Permiso RBAC: `solicitudes:crear`
- ✅ Balance disponible suficiente
- ✅ Fecha inicio < fecha fin
- ✅ Tipo de ausencia activo
- ✅ No hay solicitudes solapadas

**Comportamiento**:
1. Genera código único: `SOL-YYYY-XXXXXX` usando sequence de PostgreSQL
2. Calcula días laborables entre fechas
3. Valida balance disponible del usuario
4. Crea registro transaccional (rollback automático en error)
5. Actualiza balance: `diasDisponibles → diasPendientes`
6. Estado inicial: `PENDIENTE_JEFE`

**Retorna**: Solicitud creada con código, estado y metadata

**Errores**:
- `No tienes permiso para crear solicitudes` (RBAC)
- `No tienes días disponibles suficientes` (Balance)
- `La fecha de inicio debe ser anterior a la fecha de fin` (Validación)
- `Ya tienes una solicitud en este rango de fechas` (Solapamiento)

**Ejemplo de uso**:
```typescript
import { crearSolicitud } from '@/core/application/services/solicitudes.service';

const solicitud = await crearSolicitud({
  usuarioId: 5,
  tipoAusenciaId: 1,
  fechaInicio: new Date('2025-06-01'),
  fechaFin: new Date('2025-06-10'),
  cantidad: 7, // días laborables
  motivo: 'Vacaciones de verano',
  esPermiso: false,
  direccionDuranteAusencia: 'Calle 123',
  telefonoDuranteAusencia: '555-1234'
});

console.log(solicitud.codigo); // SOL-2025-00042
console.log(solicitud.estado); // PENDIENTE_JEFE
```

---

#### `aprobarSolicitudJefe(params): Promise<Solicitud>`

Aprueba solicitud como Jefe de Departamento (primera aprobación).

**Parámetros**:
```typescript
interface AprobarJefeParams {
  solicitudId: number;
  jefeId: number;
  observaciones?: string;
}
```

**Validaciones**:
- ✅ Permiso RBAC: `solicitudes:aprobar_jefe`
- ✅ Estado actual: `PENDIENTE_JEFE`
- ✅ Scope departamental: jefe.departamentoId === empleado.departamentoId
- ✅ Optimistic locking: verifica campo `version`

**Comportamiento**:
1. Valida permisos y scope departamental
2. Actualiza estado: `PENDIENTE_JEFE → PENDIENTE_RRHH`
3. Registra: `aprobadoPorJefeId`, `fechaAprobacionJefe`
4. Incrementa `version` para control de concurrencia
5. Transacción DB con rollback automático

**Retorna**: Solicitud actualizada con estado `PENDIENTE_RRHH`

**Errores**:
- `No tienes permiso para aprobar solicitudes` (RBAC)
- `La solicitud no está en estado PENDIENTE_JEFE` (Estado)
- `No tienes permiso para aprobar esta solicitud` (Scope)
- `La solicitud ha sido modificada por otro usuario` (Concurrencia)

**Ejemplo de uso**:
```typescript
const solicitudAprobada = await aprobarSolicitudJefe({
  solicitudId: 42,
  jefeId: 2,
  observaciones: 'Aprobado por necesidad del servicio'
});
```

---

#### `aprobarSolicitudRRHH(params): Promise<Solicitud>`

Aprobación final por Recursos Humanos (segunda aprobación).

**Parámetros**:
```typescript
interface AprobarRRHHParams {
  solicitudId: number;
  rrhhId: number;
  observaciones?: string;
}
```

**Validaciones**:
- ✅ Permiso RBAC: `solicitudes:aprobar_rrhh`
- ✅ Estado actual: `PENDIENTE_RRHH`
- ✅ Optimistic locking

**Comportamiento**:
1. Valida permisos RRHH
2. Actualiza estado: `PENDIENTE_RRHH → APROBADA`
3. Actualiza balance: `diasPendientes → diasUtilizados`
4. Registra: `aprobadoPorRRHHId`, `fechaAprobacionRRHH`
5. Incrementa `version`

**Retorna**: Solicitud con estado `APROBADA`

**Errores**:
- `No tienes permiso para aprobar solicitudes RRHH` (RBAC)
- `La solicitud no está en estado PENDIENTE_RRHH` (Estado)

**Ejemplo de uso**:
```typescript
const solicitudFinal = await aprobarSolicitudRRHH({
  solicitudId: 42,
  rrhhId: 3,
  observaciones: 'Aprobado definitivamente'
});
```

---

#### `rechazarSolicitud(params): Promise<Solicitud>`

Rechaza solicitud en cualquier etapa del flujo.

**Parámetros**:
```typescript
interface RechazarParams {
  solicitudId: number;
  rechazadoPorId: number;
  motivoRechazo: string; // REQUERIDO
}
```

**Validaciones**:
- ✅ Permiso RBAC: `solicitudes:rechazar`
- ✅ Estado: No puede ser `RECHAZADA` ni `APROBADA`
- ✅ Motivo rechazo: required, min 10 caracteres

**Comportamiento**:
1. Valida permisos y estado
2. Actualiza estado: → `RECHAZADA`
3. Devuelve días al balance: `diasPendientes → diasDisponibles`
4. Registra: `rechazadoPorId`, `motivoRechazo`, `fechaRechazo`
5. Incrementa `version`

**Retorna**: Solicitud rechazada con motivo

**Errores**:
- `No tienes permiso para rechazar solicitudes` (RBAC)
- `La solicitud ya está rechazada` (Estado)
- `El motivo de rechazo es requerido` (Validación)

**Ejemplo de uso**:
```typescript
const solicitudRechazada = await rechazarSolicitud({
  solicitudId: 42,
  rechazadoPorId: 2,
  motivoRechazo: 'No cumple con los requisitos de anticipación mínima (15 días)'
});
```

---

#### `obtenerSolicitudes(params): Promise<Solicitud[]>`

Obtiene lista de solicitudes con filtros RBAC dinámicos.

**Parámetros**:
```typescript
interface ObtenerSolicitudesParams {
  usuarioId: number;
  filtros?: {
    estado?: EstadoSolicitud;
    tipoAusenciaId?: number;
    departamentoId?: number;
    fechaDesde?: Date;
    fechaHasta?: Date;
  };
}
```

**Scope RBAC**:
| Rol | Scope |
|-----|-------|
| **ADMIN** | Ve todas las solicitudes del sistema |
| **RRHH** | Ve todas las solicitudes del sistema |
| **JEFE** | Solo solicitudes de su departamento |
| **EMPLEADO** | Solo sus propias solicitudes |

**Comportamiento**:
1. Valida permiso: `solicitudes:leer`
2. Aplica scope RBAC automáticamente
3. Filtra por parámetros opcionales
4. Ordena por fechaInicio DESC

**Retorna**: Array de solicitudes con datos de usuario y departamento

**Ejemplo de uso**:
```typescript
// Admin ve todas
const todasSolicitudes = await obtenerSolicitudes({
  usuarioId: 1,
  filtros: { estado: 'PENDIENTE_JEFE' }
});

// Empleado ve solo las suyas
const misSolicitudes = await obtenerSolicitudes({
  usuarioId: 5
});
```

---

#### `obtenerSolicitudPorId(params): Promise<Solicitud>`

Obtiene detalle de una solicitud específica validando acceso.

**Parámetros**:
```typescript
interface ObtenerPorIdParams {
  solicitudId: number;
  usuarioId: number;
}
```

**Validaciones**:
- ✅ Permiso RBAC: `solicitudes:leer`
- ✅ Existencia: 404 si no existe
- ✅ Acceso: 403 si usuario no tiene scope

**Comportamiento**:
1. Busca solicitud con LEFT JOINs
2. Valida scope RBAC
3. Empleado: solo ve sus solicitudes
4. Jefe: solo de su departamento
5. Admin/RRHH: cualquiera

**Retorna**: Solicitud completa con joins

**Errores**:
- `Solicitud no encontrada` (404)
- `No tienes permiso para ver esta solicitud` (403 RBAC)

**Ejemplo de uso**:
```typescript
const solicitud = await obtenerSolicitudPorId({
  solicitudId: 42,
  usuarioId: 5
});

console.log(solicitud.usuario.nombre);
console.log(solicitud.departamento.nombre);
console.log(solicitud.tipoAusencia.nombre);
```

---

## 👤 Usuarios Service

**Archivo**: `src/core/application/services/usuarios.service.ts` (~540 líneas)

**Propósito**: Gestión completa de usuarios, roles, contraseñas y balances con seguridad avanzada.

### Funciones Principales

#### `crearUsuario(params): Promise<Usuario>`

Crea nuevo usuario con hash de password, rol default y balances iniciales.

**Parámetros**:
```typescript
interface NuevoUsuario {
  email: string;
  password: string; // Min 8 caracteres
  nombre: string;
  cedula: string;
  departamentoId: number;
}
```

**Validaciones**:
- ✅ Email único (no duplicado)
- ✅ Email formato válido (regex)
- ✅ Password ≥ 8 caracteres
- ✅ Departamento existe y activo

**Comportamiento**:
1. Hash password con bcrypt (10 rounds)
2. Almacena cédula en campo JSON `metadata: { cedula }`
3. Asigna rol EMPLEADO por defecto
4. Crea balances iniciales:
   - Por cada tipo ausencia activo
   - `diasDisponibles` = `tipoAusencia.diasPorDefecto`
   - `diasUtilizados` = 0
   - `diasPendientes` = 0
5. Transacción completa (rollback si falla cualquier paso)

**Retorna**: Usuario creado sin campo `password`

**Errores**:
- `Ya existe un usuario con este email`
- `La contraseña debe tener al menos 8 caracteres`
- `El formato del email no es válido`

**Ejemplo de uso**:
```typescript
import { crearUsuario } from '@/core/application/services/usuarios.service';

const nuevoUsuario = await crearUsuario({
  email: 'juan.perez@cni.gov.py',
  password: 'Segur0Pass!',
  nombre: 'Juan Pérez',
  cedula: '1234567',
  departamentoId: 3
});

console.log(nuevoUsuario.id); // 10
console.log(nuevoUsuario.password); // undefined (nunca se retorna)
// Automáticamente tiene rol EMPLEADO y balances creados
```

---

#### `actualizarUsuario(params): Promise<Usuario>`

Actualización parcial de usuario con optimistic locking.

**Parámetros**:
```typescript
interface ActualizarUsuarioParams {
  usuarioId: number;
  datosActualizar: {
    nombre?: string;
    email?: string;
    departamentoId?: number;
    metadata?: Record<string, any>;
  };
  version: number; // Para optimistic locking
}
```

**Validaciones**:
- ✅ Usuario existe y activo
- ✅ Version coincide (control concurrencia)
- ✅ Email único si se cambia
- ✅ Departamento existe si se cambia

**Comportamiento**:
1. Valida version para evitar sobrescrituras
2. Actualiza solo campos proporcionados (partial update)
3. Incrementa `version++` en cada update
4. Preserva campos no mencionados
5. Transacción con rollback

**Retorna**: Usuario actualizado con nueva version

**Errores**:
- `Usuario no encontrado`
- `No se puede actualizar un usuario inactivo`
- `El usuario ha sido modificado por otro usuario` (versión)
- `Ya existe un usuario con este email`

**Ejemplo de uso**:
```typescript
const usuario = await actualizarUsuario({
  usuarioId: 10,
  datosActualizar: {
    nombre: 'Juan Carlos Pérez',
    departamentoId: 5
  },
  version: 1 // Debe coincidir con DB
});

console.log(usuario.version); // 2
```

---

#### `desactivarUsuario(params): Promise<Usuario>`

Soft delete del usuario preservando histórico.

**Parámetros**:
```typescript
interface DesactivarParams {
  usuarioId: number;
}
```

**Comportamiento**:
1. Marca `activo = false`
2. Establece `deletedAt = NOW()`
3. Desactiva todos los roles: `usuariosRoles.activo = false`
4. **NO elimina registros físicamente** (preserva histórico)
5. Solicitudes previas permanecen visibles
6. Transacción completa

**Retorna**: Usuario desactivado con deletedAt

**Errores**:
- `Usuario no encontrado`
- `El usuario ya está inactivo`

**Ejemplo de uso**:
```typescript
const usuario = await desactivarUsuario({
  usuarioId: 10
});

console.log(usuario.activo); // false
console.log(usuario.deletedAt); // 2025-06-05T10:30:00Z
// Histórico de solicitudes se preserva
```

---

#### `asignarRolConValidacion(params): Promise<UsuarioRol>`

Asigna rol a usuario con validaciones de negocio.

**Parámetros**:
```typescript
interface AsignarRolParams {
  usuarioId: number;
  rolId: number;
  departamentoId?: number; // REQUERIDO si rol es JEFE
}
```

**Validaciones**:
- ✅ Rol existe y está activo
- ✅ Usuario no tiene el rol ya asignado
- ✅ Si rol.codigo === 'JEFE': departamentoId requerido
- ✅ Usuario existe y activo

**Comportamiento**:
1. Verifica rol activo
2. Valida no duplicado
3. Valida regla JEFE → departamentoId
4. Crea relación usuariosRoles
5. Marca activo = true

**Retorna**: UsuarioRol creado

**Errores**:
- `El rol no existe o no está activo`
- `El usuario ya tiene este rol asignado`
- `El rol JEFE requiere un departamentoId`

**Ejemplo de uso**:
```typescript
// Asignar rol JEFE requiere departamento
const usuarioRol = await asignarRolConValidacion({
  usuarioId: 10,
  rolId: 2, // JEFE
  departamentoId: 3 // REQUERIDO
});

// Asignar rol RRHH no requiere departamento
const rrhhRol = await asignarRolConValidacion({
  usuarioId: 10,
  rolId: 4 // RRHH
});
```

---

#### `cambiarContrasena(params): Promise<void>`

Cambio seguro de contraseña validando actual.

**Parámetros**:
```typescript
interface CambiarContrasenaParams {
  usuarioId: number;
  passwordActual: string;
  passwordNuevo: string; // Min 8 caracteres
}
```

**Validaciones**:
- ✅ Usuario existe y activo
- ✅ Password actual correcto (bcrypt.compare)
- ✅ Password nuevo ≥ 8 caracteres
- ✅ Password nuevo ≠ password actual

**Comportamiento**:
1. Verifica password actual con bcrypt
2. Valida nuevo password requisitos
3. Hash nuevo password (10 rounds)
4. Actualiza campo `password`
5. Transacción segura

**Retorna**: void

**Errores**:
- `Usuario no encontrado`
- `La contraseña actual no es correcta`
- `La nueva contraseña debe tener al menos 8 caracteres`
- `La nueva contraseña debe ser diferente a la actual`

**Ejemplo de uso**:
```typescript
await cambiarContrasena({
  usuarioId: 10,
  passwordActual: 'OldPass123',
  passwordNuevo: 'NewSecurePass456!'
});

// Login con nueva contraseña funcionará inmediatamente
```

---

#### `obtenerUsuarios(params): Promise<Usuario[]>`

Lista usuarios con filtros opcionales, **NUNCA retorna passwords**.

**Parámetros**:
```typescript
interface ObtenerUsuariosParams {
  departamentoId?: number;
  search?: string; // Busca en nombre y email
  soloActivos?: boolean;
}
```

**Comportamiento**:
1. Aplica filtros opcionales
2. LEFT JOIN con departamento, roles
3. **Elimina campo password del resultado**
4. Ordena por nombre ASC
5. Retorna array vacío si no hay resultados

**Retorna**: Array de usuarios SIN password

**Ejemplo de uso**:
```typescript
// Todos los usuarios activos del departamento 3
const usuarios = await obtenerUsuarios({
  departamentoId: 3,
  soloActivos: true
});

usuarios.forEach(u => {
  console.log(u.nombre, u.email);
  console.log(u.password); // ✅ undefined - NUNCA se expone
});

// Buscar por nombre o email
const encontrados = await obtenerUsuarios({
  search: 'Juan'
});
```

---

## 📊 Reportes Service

**Archivo**: `src/core/application/services/reportes.service.ts` (~430 líneas)

**Propósito**: Generación de reportes gerenciales y exportación en múltiples formatos.

### Funciones Principales

#### `generarReporteGeneral(): Promise<ReporteGeneral>`

Reporte ejecutivo con métricas del sistema completo.

**Retorna**:
```typescript
interface ReporteGeneral {
  metricas: {
    totalUsuarios: number;
    usuariosActivos: number;
    totalSolicitudes: number;
    solicitudesPendientes: number;
    solicitudesAprobadas: number;
    solicitudesRechazadas: number;
    diasUtilizados: number;
    diasPendientes: number;
  };
  topDepartamentos: Array<{
    departamentoId: number;
    departamentoNombre: string;
    totalSolicitudes: number;
    diasUtilizados: number;
    porcentajeUso: number;
  }>;
  tendenciaMensual: Array<{
    mes: string; // 'YYYY-MM'
    solicitudesCreadas: number;
    solicitudesAprobadas: number;
    diasUtilizados: number;
  }>;
}
```

**Comportamiento**:
1. Ejecuta 3 queries en paralelo:
   - Métricas generales (COUNT, SUM)
   - Top 10 departamentos por uso
   - Últimos 6 meses tendencia
2. Usa PostgreSQL TO_CHAR para formateo fechas
3. Calcula porcentajes y agregaciones
4. Ordena por volumen DESC

**Ejemplo de uso**:
```typescript
import { generarReporteGeneral } from '@/core/application/services/reportes.service';

const reporte = await generarReporteGeneral();

console.log(`Usuarios activos: ${reporte.metricas.usuariosActivos}`);
console.log(`Días utilizados: ${reporte.metricas.diasUtilizados}`);
console.log(`Top departamento: ${reporte.topDepartamentos[0].departamentoNombre}`);

// Tendencia
reporte.tendenciaMensual.forEach(mes => {
  console.log(`${mes.mes}: ${mes.solicitudesAprobadas} aprobadas`);
});
```

---

#### `generarReporteDepartamento(departamentoId): Promise<ReporteDepartamento>`

Reporte detallado para un departamento específico.

**Parámetros**:
```typescript
departamentoId: number
```

**Retorna**:
```typescript
interface ReporteDepartamento {
  departamento: {
    id: number;
    nombre: string;
    jefe?: { id: number; nombre: string };
  };
  metricas: {
    totalColaboradores: number;
    solicitudesPendientes: number;
    solicitudesAprobadas: number;
    diasDisponiblesTotal: number;
    diasUtilizadosTotal: number;
  };
  colaboradores: Array<{
    usuarioId: number;
    nombre: string;
    email: string;
    balances: Array<{
      tipoAusencia: string;
      diasDisponibles: number;
      diasUtilizados: number;
    }>;
  }>;
  proximasVacaciones: Array<{
    usuarioNombre: string;
    fechaInicio: Date;
    fechaFin: Date;
    diasSolicitados: number;
  }>;
}
```

**Comportamiento**:
1. Valida departamento existe
2. Obtiene jefe del departamento (si tiene rol JEFE)
3. Calcula métricas agregadas
4. Lista colaboradores con balances
5. Obtiene próximas vacaciones (30 días)

**Ejemplo de uso**:
```typescript
const reporteDept = await generarReporteDepartamento(3);

console.log(`Departamento: ${reporteDept.departamento.nombre}`);
console.log(`Jefe: ${reporteDept.departamento.jefe?.nombre}`);
console.log(`Colaboradores: ${reporteDept.metricas.totalColaboradores}`);

// Ver balances por colaborador
reporteDept.colaboradores.forEach(col => {
  console.log(`${col.nombre}:`);
  col.balances.forEach(b => {
    console.log(`  ${b.tipoAusencia}: ${b.diasDisponibles} disponibles`);
  });
});
```

---

#### `exportarReporteCSV(reporte, tipo): string`

Exporta reporte a formato CSV compatible con Excel.

**Parámetros**:
```typescript
interface ExportarCSVParams {
  reporte: ReporteGeneral | ReporteDepartamento;
  tipo: 'general' | 'departamento';
}
```

**Comportamiento**:
1. Genera CSV con UTF-8 BOM (Excel compatibility)
2. Formato RFC 4180 compliant
3. Escapa comillas dobles
4. Secciones separadas con líneas vacías
5. Headers descriptivos en español

**Retorna**: String CSV listo para download

**Formato General**:
```csv
﻿"Reporte General - Sistema de Gestión de Vacaciones"
"Fecha","2025-06-05"

"Métricas Generales"
"Total Usuarios","150"
"Usuarios Activos","142"
"Solicitudes Pendientes","25"
...

"Top 10 Departamentos por Uso"
"Departamento","Total Solicitudes","Días Utilizados","% Uso"
"Recursos Humanos","45","320","78.5%"
...
```

**Ejemplo de uso**:
```typescript
const reporte = await generarReporteGeneral();
const csv = exportarReporteCSV(reporte, 'general');

// Enviar como descarga
return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="reporte-general.csv"'
  }
});
```

---

#### `exportarReporteExcel(reporte, tipo): Promise<Buffer>`

Exporta reporte a formato Excel (.xlsx) con estilos.

**Parámetros**:
```typescript
interface ExportarExcelParams {
  reporte: ReporteGeneral | ReporteDepartamento;
  tipo: 'general' | 'departamento';
}
```

**Estado**: 🚧 **TODO** - Requiere instalar librería ExcelJS

**Comportamiento planeado**:
1. Instalar: `pnpm add exceljs`
2. Crear workbook con múltiples hojas
3. Aplicar estilos: headers bold, colores corporativos
4. Formatos numéricos: miles, porcentajes, fechas
5. Ancho columnas auto-ajustado
6. Retornar Buffer para descarga

**Ejemplo futuro**:
```typescript
// TODO: Implementar después de instalar ExcelJS
const buffer = await exportarReporteExcel(reporte, 'general');

return new Response(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="reporte-general.xlsx"'
  }
});
```

---

## ⚖️ Balance Service

**Archivo**: `src/core/application/services/balance.service.ts` (existente, ~180 líneas)

**Propósito**: Cálculo y gestión de balances de días de ausencia por usuario.

### Funciones Principales

#### `calcularBalanceUsuario(usuarioId, tipoAusenciaId): Promise<Balance>`

Calcula balance actual de un usuario para un tipo de ausencia.

**Retorna**:
```typescript
interface Balance {
  tipoAusenciaId: number;
  diasAsignados: number;
  diasUtilizados: number;
  diasPendientes: number;
  diasDisponibles: number;
}
```

**Ejemplo de uso**:
```typescript
const balance = await calcularBalanceUsuario(5, 1);
console.log(`Disponibles: ${balance.diasDisponibles}`);
```

---

## 🔐 RBAC Service

**Archivo**: `src/core/application/rbac/rbac.service.ts`

Documentación completa en [TESTING_RBAC.md](./TESTING_RBAC.md)

**Funciones clave**:
- `usuarioTienePermiso(usuarioId: number, permiso: string): Promise<boolean>`
- `obtenerRolesYPermisos(usuarioId: number): Promise<RolesPermisos>`

---

## 🔧 Patrones Comunes

### 🔄 Transacciones con Rollback Automático

Todos los servicios de mutación usan transacciones DB:

```typescript
export async function servicioEjemplo(params) {
  return db.transaction(async (tx) => {
    // Paso 1: Validar
    const data = await tx.select()...;
    if (!data) throw new Error('No encontrado');

    // Paso 2: Actualizar
    const updated = await tx.update(tabla)
      .set({ campo: valor })
      .where(eq(tabla.id, id))
      .returning();

    // Si cualquier paso falla, rollback automático
    return updated[0];
  });
}
```

**Ventajas**:
- ✅ Atomicidad garantizada
- ✅ Rollback automático en error
- ✅ No requiere `try/catch` manual
- ✅ Consistencia de datos

---

### 🔒 Optimistic Locking con Version

Control de concurrencia para evitar sobrescrituras:

```typescript
// 1. Leer con version
const usuario = await tx.select().where(eq(usuarios.id, id));
if (usuario.version !== params.version) {
  throw new Error('El registro ha sido modificado por otro usuario');
}

// 2. Actualizar incrementando version
await tx.update(usuarios)
  .set({ 
    ...datosNuevos,
    version: usuario.version + 1  // ✅ Version++
  })
  .where(and(
    eq(usuarios.id, id),
    eq(usuarios.version, params.version)  // ✅ WHERE version
  ));
```

**Cuándo usar**:
- ✅ Formularios con edición concurrente
- ✅ Aprobaciones múltiples
- ✅ Updates desde UI

**Cómo usar desde UI**:
```typescript
// 1. Cargar con version
const usuario = await getUsuario(id); // { id: 1, nombre: 'Juan', version: 3 }

// 2. Enviar version en update
await actualizarUsuario({
  usuarioId: 1,
  datosActualizar: { nombre: 'Juan Carlos' },
  version: 3  // ✅ Debe coincidir
});
```

---

### 🗑️ Soft Deletes

Preservación del histórico con borrado lógico:

```typescript
// ❌ NUNCA hacer DELETE físico
await db.delete(usuarios).where(eq(usuarios.id, id));

// ✅ SIEMPRE usar soft delete
await db.update(usuarios)
  .set({
    activo: false,
    deletedAt: new Date()
  })
  .where(eq(usuarios.id, id));
```

**Filtros en queries**:
```typescript
// Filtrar usuarios activos
const activos = await db.select()
  .from(usuarios)
  .where(eq(usuarios.activo, true));

// Ver histórico completo (Admin)
const todos = await db.select().from(usuarios);
```

---

### ✅ Validación RBAC en Servicios

Todos los servicios validan permisos al inicio:

```typescript
export async function operacionSensible(params) {
  // 1. Validar permiso general
  const tienePermiso = await usuarioTienePermiso(
    params.usuarioId,
    'recurso:accion'
  );
  if (!tienePermiso) {
    throw new Error('No tienes permiso para realizar esta acción');
  }

  // 2. Validar scope (si aplica)
  if (esJefe && solicitud.departamentoId !== jefe.departamentoId) {
    throw new Error('No tienes permiso en este departamento');
  }

  // 3. Ejecutar operación
  return await realizarOperacion();
}
```

**Niveles de validación**:
1. **API Route** (primer filtro)
2. **Service** (validación de negocio)
3. **Query** (filtros SQL)

---

### 📅 Manejo de Fechas con PostgreSQL

Conversión correcta para compatibilidad:

```typescript
// ❌ Incorrecto: pasar Date objects
.where(gte(solicitudes.fechaInicio, new Date('2025-06-01')))

// ✅ Correcto: convertir a ISO string
.where(gte(
  solicitudes.fechaInicio,
  '2025-06-01' // Ya es string desde form
))

// ✅ O usar toISOString().split('T')[0]
const fechaSQL = new Date().toISOString().split('T')[0]; // '2025-06-05'
.where(gte(solicitudes.fechaInicio, fechaSQL))
```

**Drizzle fecha types**:
- `timestamp` → retorna `string` ISO
- `date` → retorna `string` 'YYYY-MM-DD'
- **NO** retorna Date objects

---

## ⚠️ Manejo de Errores

### Tipos de Errores

#### 1. **Errores de Validación** (400)
```typescript
// Usuario
throw new Error('Ya existe un usuario con este email');
throw new Error('La contraseña debe tener al menos 8 caracteres');

// Solicitud
throw new Error('No tienes días disponibles suficientes');
throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
```

#### 2. **Errores de RBAC** (403)
```typescript
throw new Error('No tienes permiso para realizar esta acción');
throw new Error('No tienes permiso para aprobar esta solicitud');
throw new Error('No tienes permiso en este departamento');
```

#### 3. **Errores de Estado** (409)
```typescript
throw new Error('La solicitud no está en estado PENDIENTE_JEFE');
throw new Error('El usuario ya tiene este rol asignado');
throw new Error('La solicitud ya está rechazada');
```

#### 4. **Errores de Concurrencia** (409)
```typescript
throw new Error('El usuario ha sido modificado por otro usuario');
throw new Error('La solicitud ha sido modificada por otro usuario');
```

#### 5. **Errores de No Encontrado** (404)
```typescript
throw new Error('Usuario no encontrado');
throw new Error('Solicitud no encontrada');
throw new Error('Departamento no encontrado');
```

### Manejo en API Routes

```typescript
// src/app/api/recurso/route.ts
export async function POST(req: Request) {
  try {
    const data = await crearRecurso(params);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error:', error);
    
    // Detectar tipo de error por mensaje
    if (error.message.includes('No tienes permiso')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('no encontrad')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('ya existe') || 
        error.message.includes('modificado por otro')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    
    // Validación genérica
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
```

---

## 📝 Buenas Prácticas

### ✅ DO's

1. **Siempre validar RBAC** al inicio de funciones
2. **Usar transacciones** para operaciones con múltiples pasos
3. **Implementar optimistic locking** en updates
4. **Soft delete** en lugar de DELETE físico
5. **Excluir password** de respuestas
6. **Validar permisos + scope** (general + departamental)
7. **Documentar errores posibles** en JSDoc
8. **Usar types TypeScript** para parámetros
9. **Retornar objetos completos** con joins cuando sea útil
10. **Incrementar version** en cada update

### ❌ DON'Ts

1. **NO exponer passwords** en ninguna respuesta
2. **NO hacer DELETE** físico sin razón crítica
3. **NO asumir permisos** sin validar
4. **NO ignorar version** en updates concurrentes
5. **NO usar Date objects** directamente en queries SQL
6. **NO duplicar lógica** de negocio en API routes
7. **NO hardcodear** códigos de error
8. **NO omitir** manejo de transacciones
9. **NO retornar** errores SQL raw al cliente
10. **NO ignorar** validaciones de negocio

---

## 🔗 Referencias

- [ARQUITECTURA.md](./ARQUITECTURA.md) - Estructura general del proyecto
- [TESTING_RBAC.md](./TESTING_RBAC.md) - Tests de RBAC completos
- [SEMANA_2_RESUMEN.md](./SEMANA_2_RESUMEN.md) - Resumen de implementación
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## 📊 Métricas de Código

| Servicio | Líneas | Funciones | Coverage | Complejidad |
|----------|--------|-----------|----------|-------------|
| solicitudes.service.ts | ~800 | 7 | 🚧 TBD | Alta |
| usuarios.service.ts | ~540 | 6 | 🚧 TBD | Media |
| reportes.service.ts | ~430 | 4 | 🚧 TBD | Media |
| balance.service.ts | ~180 | 3 | ✅ 80% | Baja |
| rbac.service.ts | ~350 | 5 | ✅ 95% | Alta |
| **TOTAL** | **~2,300** | **25** | **🎯 >75%** | - |

---

**Última actualización**: Día 5 - Semana 2  
**Autor**: Equipo de Desarrollo CNI  
**Versión**: 2.0.0
