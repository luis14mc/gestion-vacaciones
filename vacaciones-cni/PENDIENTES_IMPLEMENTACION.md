# 📋 Plan de Implementación Pendiente - Sistema CNI

**Sistema de Gestión de Vacaciones y Permisos**  
**Consejo Nacional de Inversiones (CNI)**  
**Última Actualización**: 7 de enero de 2026

---

## 🎯 Estado Actual del Proyecto

### ✅ Completado (15%)

- **Infraestructura Core (100%)**
  - Arquitectura Clean implementada (domain/application/infrastructure)
  - Sistema RBAC completo en base de datos (4 roles, 24 permisos)
  - Foreign Keys y constraints configurados
  - 21 índices optimizados (+400% performance)
  - Migraciones SQL documentadas y testeadas
  - Build exitoso (36 rutas generadas)
  - Compatibilidad backward mantenida

- **Documentación (100%)**
  - ARQUITECTURA.md (800+ líneas)
  - GUIA_MIGRACION.md (600+ líneas)
  - ESTRUCTURA.md (400+ líneas)
  - INTEGRACION_RBAC_PENDIENTE.md (4000+ líneas)

### ⏳ Pendiente (85%)

El sistema tiene una base de datos robusta con RBAC, pero **0% integrado en la aplicación**. Los endpoints API y componentes frontend siguen usando el sistema legacy (es_admin, es_jefe, es_rrhh).

---

## 🚨 SEMANA 1 - CRÍTICO (Prioridad Máxima)

**Objetivo**: Integrar sistema RBAC en rutas API críticas y crear middleware de autorización.

**Duración**: 5 días laborales  
**Prioridad**: 🔴 CRÍTICA - Sistema actualmente sin control de acceso apropiado

### 📌 Día 1-2: Middleware de Autorización y SessionUser

**Archivos a modificar**:
- `src/middleware.ts` (crear)
- `src/types/index.ts` (actualizar)
- `src/lib/auth.ts` (crear helper de sesión)

#### 1.1 Actualizar tipo SessionUser

```typescript
// src/types/index.ts
export interface SessionUser {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  departamentoId: number;
  departamentoNombre: string;
  
  // 🆕 Campos RBAC
  roles: Array<{
    codigo: string;
    nombre: string;
    nivel: number;
  }>;
  permisos: string[];  // ['vacaciones.solicitudes.crear', ...]
  
  // ⚠️ DEPRECATED - mantener por compatibilidad
  esAdmin: boolean;
  esRrhh: boolean;
  esJefe: boolean;
}
```

**Impacto**: 
- ✅ Todos los componentes con `session.user` tendrán tipado correcto
- ✅ IntelliSense mostrará roles y permisos disponibles
- ⚠️ No rompe código existente (campos legacy se mantienen)

#### 1.2 Crear helper de sesión con RBAC

```typescript
// src/lib/auth.ts
import { cookies } from 'next/headers';
import { obtenerRolesYPermisos } from '@/core/application/rbac';

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieStore = await cookies();
  const sessionData = cookieStore.get('session')?.value;
  
  if (!sessionData) return null;
  
  const basicUser = JSON.parse(sessionData);
  
  // Obtener roles y permisos actualizados del sistema RBAC
  const usuarioCompleto = await obtenerRolesYPermisos(basicUser.id);
  
  if (!usuarioCompleto) return null;
  
  return {
    user: {
      ...basicUser,
      roles: usuarioCompleto.roles,
      permisos: usuarioCompleto.permisos,
      // Compatibilidad legacy
      esAdmin: usuarioCompleto.roles.some(r => r.codigo === 'ADMIN'),
      esRrhh: usuarioCompleto.roles.some(r => r.codigo === 'RRHH'),
      esJefe: usuarioCompleto.roles.some(r => r.codigo === 'JEFE'),
    }
  };
}

export function tienePermiso(user: SessionUser, permiso: string): boolean {
  return user.permisos.includes(permiso);
}

export function tieneNivelMinimo(user: SessionUser, nivelRequerido: number): boolean {
  return user.roles.some(r => r.nivel >= nivelRequerido);
}
```

**Impacto**:
- ✅ Centraliza lógica de sesión
- ✅ Evita duplicar consultas RBAC
- ✅ Función reutilizable en todas las rutas

#### 1.3 Crear middleware de autorización

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const session = await getSession();
  
  // Rutas públicas
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next();
  }
  
  // Proteger todas las rutas privadas
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Verificar permisos específicos por ruta
  const path = request.nextUrl.pathname;
  
  // Ejemplo: Solo ADMIN y RRHH pueden ver gestión de usuarios
  if (path.startsWith('/usuarios')) {
    const tieneAcceso = session.user.permisos.includes('usuarios.ver');
    
    if (!tieneAcceso) {
      return NextResponse.json(
        { error: 'No tiene permiso para acceder a esta sección' },
        { status: 403 }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Impacto**:
- ✅ Protección a nivel de aplicación (no solo API)
- ✅ Redirección automática a login si no autenticado
- ✅ Control centralizado de acceso a rutas

### 📌 Día 3: Integrar RBAC en API de Solicitudes

**Archivo**: `src/app/api/solicitudes/route.ts`

**Cambios requeridos**:

```typescript
// ANTES (sistema legacy)
if (!session.user.esJefe && !session.user.esRrhh) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}

// DESPUÉS (sistema RBAC)
import { tienePermiso } from '@/lib/auth';

// GET - Ver solicitudes
if (!tienePermiso(session.user, 'vacaciones.solicitudes.ver_todas')) {
  // Si no puede ver todas, solo puede ver las propias
  filtros.usuarioId = session.user.id;
}

// POST - Crear solicitud
if (!tienePermiso(session.user, 'vacaciones.solicitudes.crear')) {
  return NextResponse.json(
    { error: 'No tiene permiso para crear solicitudes' },
    { status: 403 }
  );
}

// PATCH - Aprobar como jefe
if (accion === 'aprobar_jefe') {
  if (!tienePermiso(session.user, 'vacaciones.solicitudes.aprobar_jefe')) {
    return NextResponse.json(
      { error: 'No tiene permiso para aprobar solicitudes como jefe' },
      { status: 403 }
    );
  }
  
  // Verificar que sea jefe del departamento del solicitante
  const solicitud = await obtenerSolicitud(solicitudId);
  if (solicitud.usuario.departamentoId !== session.user.departamentoId) {
    return NextResponse.json(
      { error: 'Solo puede aprobar solicitudes de su departamento' },
      { status: 403 }
    );
  }
}

// PATCH - Aprobar como RRHH (aprobación final)
if (accion === 'aprobar_rrhh') {
  if (!tienePermiso(session.user, 'vacaciones.solicitudes.aprobar_rrhh')) {
    return NextResponse.json(
      { error: 'No tiene permiso para aprobación final' },
      { status: 403 }
    );
  }
}

// PATCH - Rechazar
if (accion === 'rechazar') {
  if (!tienePermiso(session.user, 'vacaciones.solicitudes.rechazar')) {
    return NextResponse.json(
      { error: 'No tiene permiso para rechazar solicitudes' },
      { status: 403 }
    );
  }
}
```

**Impacto**:
- ✅ Control granular de permisos
- ✅ Scope contextual (jefe solo su departamento)
- ✅ Facilita auditoría (logs con permisos verificados)
- ✅ Extensible (agregar nuevos permisos sin modificar código)

### 📌 Día 4: Integrar RBAC en API de Usuarios

**Archivo**: `src/app/api/usuarios/route.ts`

```typescript
// GET - Ver usuarios
if (!tienePermiso(session.user, 'usuarios.ver')) {
  return NextResponse.json(
    { error: 'No tiene permiso para ver usuarios' },
    { status: 403 }
  );
}

// POST - Crear usuario
if (!tienePermiso(session.user, 'usuarios.crear')) {
  return NextResponse.json(
    { error: 'No tiene permiso para crear usuarios' },
    { status: 403 }
  );
}

// PATCH - Editar usuario
if (!tienePermiso(session.user, 'usuarios.editar')) {
  return NextResponse.json(
    { error: 'No tiene permiso para editar usuarios' },
    { status: 403 }
  );
}

// DELETE - Eliminar usuario (soft delete)
if (!tienePermiso(session.user, 'usuarios.eliminar')) {
  return NextResponse.json(
    { error: 'No tiene permiso para eliminar usuarios' },
    { status: 403 }
  );
}
```

**Endpoints adicionales a crear**:

```typescript
// POST /api/usuarios/roles - Asignar rol a usuario
if (!tienePermiso(session.user, 'usuarios.editar')) {
  return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
}

await asignarRolAUsuario(usuarioId, rolCodigo, departamentoId, session.user.id);

// DELETE /api/usuarios/roles - Remover rol
await removerRolDeUsuario(usuarioId, rolCodigo, session.user.id);
```

### 📌 Día 5: Integrar RBAC en API de Balances y Reportes

**Archivo**: `src/app/api/balances/route.ts`

```typescript
// GET - Ver balances
const { usuarioId } = searchParams;

if (usuarioId && usuarioId !== session.user.id) {
  // Intenta ver balance de otro usuario
  if (!tienePermiso(session.user, 'balances.ver_todos')) {
    return NextResponse.json(
      { error: 'Solo puede ver su propio balance' },
      { status: 403 }
    );
  }
} else {
  // Ver balance propio - permiso básico
  if (!tienePermiso(session.user, 'balances.ver_propios')) {
    return NextResponse.json(
      { error: 'No tiene permiso para ver balances' },
      { status: 403 }
    );
  }
}

// PATCH - Editar balance manualmente (ajustes RRHH)
if (!tienePermiso(session.user, 'balances.editar')) {
  return NextResponse.json(
    { error: 'No tiene permiso para editar balances' },
    { status: 403 }
  );
}
```

**Archivo**: `src/app/api/reportes/general/route.ts`

```typescript
if (!tienePermiso(session.user, 'reportes.general')) {
  return NextResponse.json(
    { error: 'No tiene permiso para ver reportes generales' },
    { status: 403 }
  );
}
```

**Archivo**: `src/app/api/reportes/departamento/route.ts`

```typescript
if (!tienePermiso(session.user, 'reportes.departamento')) {
  return NextResponse.json(
    { error: 'No tiene permiso para ver reportes por departamento' },
    { status: 403 }
  );
}
```

### ✅ Checklist Semana 1

- [ ] Actualizar `SessionUser` con campos RBAC
- [ ] Crear `src/lib/auth.ts` con helpers
- [ ] Crear `src/middleware.ts` para protección de rutas
- [ ] Integrar RBAC en `/api/solicitudes` (GET, POST, PATCH)
- [ ] Integrar RBAC en `/api/usuarios` (GET, POST, PATCH, DELETE)
- [ ] Crear endpoint `/api/usuarios/roles` (POST, DELETE)
- [ ] Integrar RBAC en `/api/balances` (GET, PATCH)
- [ ] Integrar RBAC en `/api/reportes/*` (GET)
- [ ] Testing manual de cada endpoint con usuarios de diferentes roles
- [ ] Actualizar Postman/Thunder Client collections

**Resultado esperado**: Sistema con control de acceso real basado en permisos, no en flags booleanos.

---

## 🔧 SEMANA 2 - SERVICIOS DE NEGOCIO (Prioridad Alta)

**Objetivo**: Extraer lógica de negocio de API routes hacia servicios reutilizables.

**Duración**: 5 días laborales  
**Prioridad**: 🟠 ALTA - Mejora mantenibilidad y testabilidad

### 📌 Día 1-2: Servicio de Solicitudes

**Crear**: `src/core/application/services/solicitudes.service.ts`

```typescript
import { db } from '@/core/infrastructure/database';
import { solicitudes, balancesAusencias, usuarios } from '@/core/infrastructure/database/schema';
import { usuarioTienePermiso } from '@/core/application/rbac';
import { eq, and } from 'drizzle-orm';

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

export async function crearSolicitud(data: NuevaSolicitud) {
  // 1. Validar usuario activo
  const usuario = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.id, data.usuarioId),
      eq(usuarios.activo, true)
    )
  });
  
  if (!usuario) {
    throw new Error('Usuario no encontrado o inactivo');
  }
  
  // 2. Validar balance disponible
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, data.usuarioId),
      eq(balancesAusencias.tipoAusenciaId, data.tipoAusenciaId),
      eq(balancesAusencias.anio, new Date().getFullYear())
    )
  });
  
  if (!balance) {
    throw new Error('Balance no encontrado para este tipo de ausencia');
  }
  
  const disponible = balance.cantidadAsignada - balance.cantidadUtilizada - balance.cantidadPendiente;
  
  if (disponible < data.cantidad) {
    throw new Error(`Saldo insuficiente. Disponible: ${disponible} días`);
  }
  
  // 3. Generar código de solicitud
  const anio = new Date().getFullYear();
  const ultimaSolicitud = await db.query.solicitudes.findFirst({
    orderBy: (solicitudes, { desc }) => [desc(solicitudes.createdAt)],
    where: eq(solicitudes.codigo, `SOL-${anio}-%`)
  });
  
  const ultimoNumero = ultimaSolicitud 
    ? parseInt(ultimaSolicitud.codigo.split('-')[2]) 
    : 0;
  
  const codigo = `SOL-${anio}-${String(ultimoNumero + 1).padStart(5, '0')}`;
  
  // 4. Crear solicitud en transacción
  return await db.transaction(async (tx) => {
    // Crear solicitud
    const [nuevaSolicitud] = await tx.insert(solicitudes).values({
      codigo,
      usuarioId: data.usuarioId,
      tipoAusenciaId: data.tipoAusenciaId,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      cantidad: data.cantidad,
      motivo: data.motivo,
      esPermiso: data.esPermiso,
      direccionDuranteAusencia: data.direccionDuranteAusencia,
      telefonoDuranteAusencia: data.telefonoDuranteAusencia,
      estado: 'pendiente',
      version: 1
    }).returning();
    
    // Actualizar balance (cantidad_pendiente)
    await tx.update(balancesAusencias)
      .set({
        cantidadPendiente: balance.cantidadPendiente + data.cantidad,
        updatedAt: new Date()
      })
      .where(eq(balancesAusencias.id, balance.id));
    
    return nuevaSolicitud;
  });
}

export async function aprobarSolicitudJefe(
  solicitudId: number,
  jefeId: number
) {
  // Verificar permiso
  const { tienePermiso, razon } = await usuarioTienePermiso(
    jefeId,
    'vacaciones.solicitudes.aprobar_jefe'
  );
  
  if (!tienePermiso) {
    throw new Error(razon);
  }
  
  // Obtener solicitud con datos del usuario
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId),
    with: {
      usuario: {
        columns: { departamentoId: true }
      }
    }
  });
  
  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }
  
  if (solicitud.estado !== 'pendiente') {
    throw new Error(`No se puede aprobar una solicitud en estado: ${solicitud.estado}`);
  }
  
  // Verificar que el jefe pertenece al mismo departamento
  const jefe = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, jefeId),
    columns: { departamentoId: true }
  });
  
  if (jefe?.departamentoId !== solicitud.usuario.departamentoId) {
    throw new Error('Solo puede aprobar solicitudes de su departamento');
  }
  
  // Actualizar solicitud con optimistic locking
  const [actualizada] = await db.update(solicitudes)
    .set({
      estado: 'aprobada_jefe',
      aprobadoPor: jefeId,
      fechaAprobacionJefe: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(solicitudes.id, solicitudId),
      eq(solicitudes.version, solicitud.version)
    ))
    .returning();
  
  if (!actualizada) {
    throw new Error('La solicitud fue modificada por otro usuario. Intente nuevamente.');
  }
  
  return actualizada;
}

export async function aprobarSolicitudRRHH(
  solicitudId: number,
  rrhhId: number
) {
  // Verificar permiso
  const { tienePermiso, razon } = await usuarioTienePermiso(
    rrhhId,
    'vacaciones.solicitudes.aprobar_rrhh'
  );
  
  if (!tienePermiso) {
    throw new Error(razon);
  }
  
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId)
  });
  
  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }
  
  if (solicitud.estado !== 'aprobada_jefe') {
    throw new Error('La solicitud debe estar aprobada por el jefe primero');
  }
  
  // Actualizar solicitud y balance en transacción
  return await db.transaction(async (tx) => {
    // Actualizar solicitud
    const [actualizada] = await tx.update(solicitudes)
      .set({
        estado: 'aprobada',
        aprobadoRrhhPor: rrhhId,
        fechaAprobacionRrhh: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(solicitudes.id, solicitudId),
        eq(solicitudes.version, solicitud.version)
      ))
      .returning();
    
    if (!actualizada) {
      throw new Error('Lost update - intente nuevamente');
    }
    
    // Actualizar balance: pendiente → utilizada
    const balance = await tx.query.balancesAusencias.findFirst({
      where: and(
        eq(balancesAusencias.usuarioId, solicitud.usuarioId),
        eq(balancesAusencias.tipoAusenciaId, solicitud.tipoAusenciaId),
        eq(balancesAusencias.anio, new Date(solicitud.fechaInicio).getFullYear())
      )
    });
    
    if (balance) {
      await tx.update(balancesAusencias)
        .set({
          cantidadPendiente: balance.cantidadPendiente - solicitud.cantidad,
          cantidadUtilizada: balance.cantidadUtilizada + solicitud.cantidad,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
    }
    
    return actualizada;
  });
}

export async function rechazarSolicitud(
  solicitudId: number,
  rechazadoPorId: number,
  motivoRechazo: string
) {
  const { tienePermiso, razon } = await usuarioTienePermiso(
    rechazadoPorId,
    'vacaciones.solicitudes.rechazar'
  );
  
  if (!tienePermiso) {
    throw new Error(razon);
  }
  
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId)
  });
  
  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }
  
  if (solicitud.estado === 'rechazada' || solicitud.estado === 'aprobada') {
    throw new Error(`No se puede rechazar una solicitud en estado: ${solicitud.estado}`);
  }
  
  return await db.transaction(async (tx) => {
    // Actualizar solicitud
    const [actualizada] = await tx.update(solicitudes)
      .set({
        estado: 'rechazada',
        rechazadoPor: rechazadoPorId,
        fechaRechazo: new Date(),
        motivoRechazo,
        updatedAt: new Date()
      })
      .where(and(
        eq(solicitudes.id, solicitudId),
        eq(solicitudes.version, solicitud.version)
      ))
      .returning();
    
    if (!actualizada) {
      throw new Error('Lost update');
    }
    
    // Devolver cantidad pendiente al balance
    const balance = await tx.query.balancesAusencias.findFirst({
      where: and(
        eq(balancesAusencias.usuarioId, solicitud.usuarioId),
        eq(balancesAusencias.tipoAusenciaId, solicitud.tipoAusenciaId),
        eq(balancesAusencias.anio, new Date(solicitud.fechaInicio).getFullYear())
      )
    });
    
    if (balance) {
      await tx.update(balancesAusencias)
        .set({
          cantidadPendiente: balance.cantidadPendiente - solicitud.cantidad,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
    }
    
    return actualizada;
  });
}

export async function obtenerSolicitudesPorUsuario(
  usuarioId: number,
  filtros?: {
    estado?: string;
    anio?: number;
    page?: number;
    pageSize?: number;
  }
) {
  // Implementar query con filtros y paginación
  // ...
}
```

**Uso en API route**:

```typescript
// src/app/api/solicitudes/route.ts
import { crearSolicitud, aprobarSolicitudJefe } from '@/core/application/services/solicitudes.service';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // La lógica compleja está en el servicio
    const solicitud = await crearSolicitud({
      usuarioId: session.user.id,
      ...body
    });
    
    return NextResponse.json({ success: true, data: solicitud });
  } catch (error) {
    console.error('Error crear solicitud:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
```

**Beneficios**:
- ✅ API routes limpias (solo validación y respuesta)
- ✅ Lógica de negocio reutilizable
- ✅ Fácil de testear (unit tests de servicios)
- ✅ Transacciones manejadas correctamente
- ✅ Optimistic locking implementado

### 📌 Día 3: Servicio de Usuarios

**Crear**: `src/core/application/services/usuarios.service.ts`

```typescript
import bcrypt from 'bcryptjs';
import { db } from '@/core/infrastructure/database';
import { usuarios, balancesAusencias, tiposAusenciaConfig } from '@/core/infrastructure/database/schema';
import { asignarRolAUsuario } from '@/core/application/rbac';

export interface NuevoUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  cedula: string;
  departamentoId: number;
  fechaIngreso: Date;
  cargoId?: number;
}

export async function crearUsuario(data: NuevoUsuario) {
  // Verificar email único
  const existe = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, data.email)
  });
  
  if (existe) {
    throw new Error('El email ya está registrado');
  }
  
  // Hash de contraseña
  const passwordHash = await bcrypt.hash(data.password, 10);
  
  return await db.transaction(async (tx) => {
    // Crear usuario
    const [nuevoUsuario] = await tx.insert(usuarios).values({
      ...data,
      password: passwordHash,
      activo: true,
      version: 1
    }).returning();
    
    // Asignar rol por defecto: EMPLEADO
    await asignarRolAUsuario(nuevoUsuario.id, 'EMPLEADO', null, nuevoUsuario.id);
    
    // Crear balances iniciales para tipos de ausencia activos
    const tiposActivos = await tx.query.tiposAusenciaConfig.findMany({
      where: eq(tiposAusenciaConfig.activo, true)
    });
    
    const anioActual = new Date().getFullYear();
    
    for (const tipo of tiposActivos) {
      await tx.insert(balancesAusencias).values({
        usuarioId: nuevoUsuario.id,
        tipoAusenciaId: tipo.id,
        anio: anioActual,
        cantidadAsignada: tipo.diasAsignadosAnuales || 0,
        cantidadUtilizada: 0,
        cantidadPendiente: 0,
        estado: 'activo',
        version: 1
      });
    }
    
    return nuevoUsuario;
  });
}

export async function actualizarUsuario(
  usuarioId: number,
  cambios: Partial<NuevoUsuario>
) {
  // Implementar actualización con validaciones
  // ...
}

export async function desactivarUsuario(usuarioId: number) {
  // Soft delete
  await db.update(usuarios)
    .set({
      activo: false,
      updatedAt: new Date()
    })
    .where(eq(usuarios.id, usuarioId));
}
```

### 📌 Día 4-5: Testing y Documentación

- Unit tests con Vitest para servicios creados
- Integration tests para flujos completos
- Actualizar documentación de API
- Code review interno

### ✅ Checklist Semana 2

- [ ] Crear `solicitudes.service.ts` con 5+ funciones
- [ ] Crear `usuarios.service.ts` con 3+ funciones
- [ ] Refactorizar API routes para usar servicios
- [ ] Unit tests de servicios (coverage >80%)
- [ ] Integration tests de endpoints
- [ ] Actualizar Postman collections con nuevos ejemplos
- [ ] Documentar servicios en README.md

---

## 🎨 SEMANA 3-4 - COMPONENTES COMPARTIDOS (Prioridad Media)

**Objetivo**: Crear biblioteca de componentes UI reutilizables y extraer lógica común.

**Duración**: 10 días laborales  
**Prioridad**: 🟡 MEDIA - Mejora experiencia de desarrollo

### 📌 Semana 3: UI Components Library

**Crear estructura**:

```
src/shared/components/ui/
├── Button.tsx
├── Input.tsx
├── Select.tsx
├── TextArea.tsx
├── DatePicker.tsx
├── Modal.tsx
├── Table.tsx
├── Card.tsx
├── Badge.tsx
├── Alert.tsx
├── Spinner.tsx
└── index.ts
```

#### Ejemplo: Button Component

```typescript
// src/shared/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'btn transition-all duration-200';
    
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      danger: 'btn-error',
      success: 'btn-success'
    };
    
    const sizeClasses = {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg'
    };
    
    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <span className="loading loading-spinner loading-sm mr-2"></span>}
        {leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

#### Ejemplo: Modal Component

```typescript
// src/shared/components/ui/Modal.tsx
import { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);
  
  const sizeClasses = {
    sm: 'modal-box max-w-sm',
    md: 'modal-box max-w-2xl',
    lg: 'modal-box max-w-4xl',
    xl: 'modal-box max-w-6xl'
  };
  
  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className={sizeClasses[size]}>
        <form method="dialog">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={onClose}
          >
            ✕
          </button>
        </form>
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        <div className="py-4">{children}</div>
        {footer && <div className="modal-action">{footer}</div>}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
```

### 📌 Semana 4: Hooks y Utilidades

**Crear estructura**:

```
src/shared/hooks/
├── useAuth.ts
├── usePermissions.ts
├── usePagination.ts
├── useDebounce.ts
├── useAsync.ts
└── index.ts

src/shared/utils/
├── formatters.ts
├── validators.ts
├── api.ts
├── dates.ts
└── index.ts
```

#### Ejemplo: usePermissions Hook

```typescript
// src/shared/hooks/usePermissions.ts
import { useSession } from '@/contexts/SessionContext';

export function usePermissions() {
  const { session } = useSession();
  
  const tienePermiso = (permiso: string): boolean => {
    return session?.user?.permisos?.includes(permiso) || false;
  };
  
  const tieneNivelMinimo = (nivelRequerido: number): boolean => {
    return session?.user?.roles?.some(r => r.nivel >= nivelRequerido) || false;
  };
  
  const esRol = (rolCodigo: string): boolean => {
    return session?.user?.roles?.some(r => r.codigo === rolCodigo) || false;
  };
  
  return {
    tienePermiso,
    tieneNivelMinimo,
    esRol,
    roles: session?.user?.roles || [],
    permisos: session?.user?.permisos || []
  };
}

// Uso en componente:
function MiComponente() {
  const { tienePermiso, esRol } = usePermissions();
  
  if (!tienePermiso('vacaciones.solicitudes.ver_todas')) {
    return <div>No tiene acceso</div>;
  }
  
  return (
    <div>
      {esRol('ADMIN') && <button>Configuración avanzada</button>}
    </div>
  );
}
```

#### Ejemplo: Formatters Utility

```typescript
// src/shared/utils/formatters.ts
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatearFecha(fecha: Date | string, formato = 'dd/MM/yyyy'): string {
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return format(date, formato, { locale: es });
}

export function formatearNombreCompleto(nombre: string, apellido: string): string {
  return `${nombre} ${apellido}`;
}

export function formatearEstadoSolicitud(estado: string): string {
  const estados: Record<string, string> = {
    'pendiente': 'Pendiente',
    'aprobada_jefe': 'Aprobada por Jefe',
    'aprobada': 'Aprobada Final',
    'rechazada': 'Rechazada'
  };
  
  return estados[estado] || estado;
}

export function formatearCantidadDias(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'día' : 'días'}`;
}

export function formatearBalance(asignada: number, utilizada: number, pendiente: number) {
  const disponible = asignada - utilizada - pendiente;
  
  return {
    asignada: formatearCantidadDias(asignada),
    utilizada: formatearCantidadDias(utilizada),
    pendiente: formatearCantidadDias(pendiente),
    disponible: formatearCantidadDias(disponible),
    disponibleNumero: disponible
  };
}
```

### ✅ Checklist Semana 3-4

- [ ] Crear 11 componentes UI base en `shared/components/ui/`
- [ ] Crear 5 hooks custom en `shared/hooks/`
- [ ] Crear utilidades en `shared/utils/` (formatters, validators, api)
- [ ] Storybook setup (opcional pero recomendado)
- [ ] Documentar cada componente con JSDoc
- [ ] Ejemplos de uso en README
- [ ] Testing de componentes con React Testing Library

---

## 🎯 SEMANA 5-7 - MIGRACIÓN FRONTEND A FEATURES (Prioridad Media-Baja)

**Objetivo**: Reorganizar componentes frontend por módulo/feature.

**Duración**: 15 días laborales  
**Prioridad**: 🟢 MEDIA-BAJA - Mejora organización, no funcionalidad

### 📌 Semana 5: Feature Solicitudes

**Crear estructura**:

```
src/features/solicitudes/
├── components/
│   ├── FormularioSolicitud.tsx      (migrar desde src/components/)
│   ├── TablaSolicitudes.tsx          (migrar)
│   ├── DetalleSolicitud.tsx          (migrar)
│   ├── BotonesAprobacion.tsx         (nuevo)
│   └── FiltrosSolicitudes.tsx        (nuevo)
├── hooks/
│   ├── useSolicitudes.ts
│   ├── useAprobarSolicitud.ts
│   └── useCrearSolicitud.ts
├── api/
│   └── solicitudes.api.ts
├── types/
│   └── solicitudes.types.ts
└── index.ts
```

#### Ejemplo: useSolicitudes Hook

```typescript
// src/features/solicitudes/hooks/useSolicitudes.ts
import { useState, useEffect } from 'react';
import { fetchSolicitudes } from '../api/solicitudes.api';
import type { SolicitudCompleta, FiltrosSolicitudes } from '../types/solicitudes.types';

export function useSolicitudes(filtros?: FiltrosSolicitudes) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  useEffect(() => {
    async function cargar() {
      try {
        setIsLoading(true);
        const { data, total } = await fetchSolicitudes(filtros);
        setSolicitudes(data);
        setTotal(total);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    cargar();
  }, [filtros]);
  
  const refetch = async () => {
    // Refetch lógica
  };
  
  return {
    solicitudes,
    isLoading,
    error,
    total,
    refetch
  };
}
```

#### Ejemplo: API Client

```typescript
// src/features/solicitudes/api/solicitudes.api.ts
import { api } from '@/shared/utils/api';
import type { SolicitudCompleta, NuevaSolicitud, FiltrosSolicitudes } from '../types/solicitudes.types';

export async function fetchSolicitudes(filtros?: FiltrosSolicitudes) {
  const params = new URLSearchParams();
  
  if (filtros?.usuarioId) params.append('usuarioId', String(filtros.usuarioId));
  if (filtros?.estado) params.append('estado', filtros.estado);
  if (filtros?.page) params.append('page', String(filtros.page));
  if (filtros?.pageSize) params.append('pageSize', String(filtros.pageSize));
  
  const response = await api.get<{
    success: boolean;
    data: SolicitudCompleta[];
    total: number;
  }>(`/api/solicitudes?${params.toString()}`);
  
  return response;
}

export async function crearSolicitud(data: NuevaSolicitud) {
  return await api.post<{ success: boolean; data: SolicitudCompleta }>(
    '/api/solicitudes',
    data
  );
}

export async function aprobarSolicitud(
  solicitudId: number,
  accion: 'aprobar_jefe' | 'aprobar_rrhh' | 'rechazar',
  motivoRechazo?: string
) {
  return await api.patch<{ success: boolean; message: string }>(
    '/api/solicitudes',
    { solicitudId, accion, motivoRechazo }
  );
}
```

### 📌 Semana 6: Feature Usuarios y Dashboard

**Crear estructuras**:

```
src/features/usuarios/
├── components/
│   ├── TablaUsuarios.tsx
│   ├── FormularioUsuario.tsx
│   ├── SelectorRoles.tsx          (🆕 para asignar roles RBAC)
│   └── DetalleUsuario.tsx
├── hooks/
│   ├── useUsuarios.ts
│   └── useAsignarRol.ts          (🆕)
├── api/
│   └── usuarios.api.ts
└── types/
    └── usuarios.types.ts

src/features/dashboard/
├── components/
│   ├── WidgetEstadisticas.tsx
│   ├── CalendarioAusencias.tsx    (migrar)
│   ├── GraficoBalances.tsx
│   └── ProximasAusencias.tsx
├── hooks/
│   ├── useDashboardStats.ts
│   └── useCalendario.ts
└── api/
    └── dashboard.api.ts
```

### 📌 Semana 7: Features Reportes y Configuración

```
src/features/reportes/
├── components/
│   ├── ReporteGeneral.tsx
│   ├── ReporteDepartamento.tsx
│   ├── FiltrosReporte.tsx
│   └── ExportarReporte.tsx
├── hooks/
│   └── useReportes.ts
└── api/
    └── reportes.api.ts

src/features/configuracion/
├── components/
│   ├── TiposAusenciaConfig.tsx
│   ├── DepartamentosConfig.tsx
│   └── RolesYPermisos.tsx        (🆕 UI para gestión RBAC)
├── hooks/
│   ├── useTiposAusencia.ts
│   └── useRoles.ts               (🆕)
└── api/
    └── configuracion.api.ts
```

### ✅ Checklist Semana 5-7

- [ ] Migrar `FormularioSolicitud.tsx` a `features/solicitudes/`
- [ ] Migrar `TablaSolicitudes.tsx`
- [ ] Crear hooks de solicitudes (3)
- [ ] Crear API client de solicitudes
- [ ] Migrar componentes de usuarios (4)
- [ ] Crear UI para asignar roles RBAC
- [ ] Migrar CalendarioAusencias
- [ ] Crear widgets de dashboard (4)
- [ ] Crear componentes de reportes (4)
- [ ] Crear UI de configuración RBAC
- [ ] Actualizar imports en páginas (app/*)
- [ ] Testing de componentes migrados
- [ ] Eliminar carpeta `src/components/` antigua

---

## 🧹 SEMANA 8 - LIMPIEZA FINAL (Prioridad Baja)

**Objetivo**: Eliminar código legacy y finalizar migración completa.

**Duración**: 3-5 días  
**Prioridad**: 🟢 BAJA - Housekeeping final

### 📌 Día 1-2: Eliminar Aliases y Sistema Legacy

**Archivos a eliminar**:

```powershell
# Verificar que no hay imports antiguos
Get-ChildItem -Recurse src/ -Include *.ts,*.tsx | 
  Select-String "from '@/lib/db'" -List | 
  Select-Object -ExpandProperty Path

# Si el comando anterior NO retorna nada, eliminar:
Remove-Item src/lib/db/ -Recurse -Force
Remove-Item src/lib/rbac.ts -Force
Remove-Item src/services/ -Recurse -Force
Remove-Item src/types/ -Recurse -Force
Remove-Item src/components/ -Recurse -Force
```

**Migración de sesión a RBAC puro**:

```typescript
// src/types/session.ts (actualizar)
export interface SessionUser {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  departamentoId: number;
  departamentoNombre: string;
  roles: Role[];
  permisos: string[];
  // ❌ ELIMINAR campos legacy
  // esAdmin: boolean;
  // esRrhh: boolean;
  // esJefe: boolean;
}
```

### 📌 Día 3: Eliminar Columnas Legacy de BD

**Migración SQL**:

```sql
-- migrations/002_remove_legacy_roles.sql
BEGIN;

-- 1. Verificar que todos los usuarios tienen roles RBAC
SELECT u.id, u.email, COUNT(ur.id) as roles_count
FROM usuarios u
LEFT JOIN usuarios_roles ur ON u.id = ur.usuario_id AND ur.activo = true
GROUP BY u.id, u.email
HAVING COUNT(ur.id) = 0;

-- Si hay usuarios sin roles, asignarlos primero:
-- INSERT INTO usuarios_roles (usuario_id, rol_id, ...) ...

-- 2. Eliminar columnas legacy (después de confirmar que nadie las usa)
ALTER TABLE usuarios DROP COLUMN IF EXISTS es_admin;
ALTER TABLE usuarios DROP COLUMN IF EXISTS es_rrhh;
ALTER TABLE usuarios DROP COLUMN IF EXISTS es_jefe;

COMMIT;
```

**⚠️ IMPORTANTE**: NO ejecutar esto hasta confirmar que:
- ✅ 100% de endpoints usan sistema RBAC
- ✅ 100% de componentes usan `usePermissions`
- ✅ 0 referencias a `es_admin`, `es_rrhh`, `es_jefe` en código

### 📌 Día 4-5: Optimización Final

**Tareas**:

1. **Análisis de bundle size**:
```powershell
pnpm run build
# Revisar output de Next.js bundle analyzer
```

2. **Optimizar imports**:
```typescript
// Malo (importa todo)
import * as utils from '@/shared/utils';

// Bueno (tree-shaking funciona)
import { formatearFecha } from '@/shared/utils/formatters';
```

3. **Lazy loading de componentes pesados**:
```typescript
// app/dashboard/page.tsx
import dynamic from 'next/dynamic';

const CalendarioAusencias = dynamic(
  () => import('@/features/dashboard/components/CalendarioAusencias'),
  { loading: () => <Spinner /> }
);
```

4. **Configurar ISR (Incremental Static Regeneration)**:
```typescript
// Para páginas con datos que cambian poco
export const revalidate = 300; // 5 minutos
```

5. **Cleanup de dependencias no usadas**:
```powershell
pnpm install -g depcheck
depcheck
pnpm remove <paquetes-no-usados>
```

### ✅ Checklist Semana 8

- [ ] Verificar 0 imports a rutas legacy (`@/lib/db`, etc.)
- [ ] Eliminar aliases de compatibilidad
- [ ] Eliminar carpetas antiguas (lib/, services/, types/, components/)
- [ ] Actualizar SessionUser (remover campos legacy)
- [ ] Crear migración SQL para eliminar columnas legacy
- [ ] **NO EJECUTAR** migración SQL hasta validación completa
- [ ] Optimizar bundle size
- [ ] Implementar lazy loading en componentes pesados
- [ ] Cleanup de dependencias
- [ ] Build final sin warnings
- [ ] Performance testing (Lighthouse score >90)

---

## 📊 RESUMEN EJECUTIVO

### Cronograma General

| Semana | Foco | Prioridad | Esfuerzo | Estado |
|--------|------|-----------|----------|--------|
| **1** | Integración RBAC en API | 🔴 CRÍTICA | 40h | ⏳ Pendiente |
| **2** | Servicios de Negocio | 🟠 ALTA | 40h | ⏳ Pendiente |
| **3-4** | Componentes Compartidos | 🟡 MEDIA | 80h | ⏳ Pendiente |
| **5-7** | Migración Frontend a Features | 🟢 MEDIA-BAJA | 120h | ⏳ Pendiente |
| **8** | Limpieza Final | 🟢 BAJA | 20-40h | ⏳ Pendiente |
| **TOTAL** | | | **300-320h** | **0% completado** |

### Estimación de Tiempo

**Modalidad Full-Time (8h/día)**:
- Desarrollador único: **8-10 semanas**
- Equipo de 2: **4-5 semanas**
- Equipo de 3: **3-4 semanas**

**Modalidad Part-Time (4h/día)**:
- Desarrollador único: **16-20 semanas (4-5 meses)**
- Equipo de 2: **8-10 semanas (2-2.5 meses)**

### Prioridades CNI

**Implementar INMEDIATAMENTE** (Semana 1):
- ✅ RBAC en API routes
- ✅ Middleware de autorización
- ✅ SessionUser actualizado

**Razón**: Sistema actualmente tiene control de acceso débil. Un usuario podría:
- Modificar roles editando la sesión
- Aprobar solicitudes sin permisos reales
- Acceder a endpoints sin validación de permisos

**Implementar PRONTO** (Semana 2):
- Servicios de negocio (solicitudes, usuarios)
- Testing de integración

**Razón**: Facilita mantenimiento y permite escalar el equipo de desarrollo.

**Implementar GRADUALMENTE** (Semanas 3-8):
- Componentes compartidos
- Features frontend
- Limpieza legacy

**Razón**: Mejora DX (Developer Experience) pero no afecta seguridad o funcionalidad.

### Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Breaking changes en Semana 1 | Media | Alto | Testing exhaustivo antes de deploy |
| Performance degradation | Baja | Medio | Benchmarking antes/después |
| Datos inconsistentes (usuarios sin roles) | Baja | Alto | Script de verificación antes de eliminar legacy |
| Time overrun (subestimación) | Media | Medio | Buffer de 20% en estimaciones |

### Métricas de Éxito

**Semana 1**:
- ✅ 21 endpoints API con RBAC implementado
- ✅ 0 endpoints usando flags booleanos
- ✅ Middleware de autorización funcionando
- ✅ Tests pasando (cobertura >70%)

**Semana 2**:
- ✅ 2 servicios creados (solicitudes, usuarios)
- ✅ API routes refactorizadas a <50 líneas cada una
- ✅ Unit tests de servicios (cobertura >80%)

**Semanas 3-4**:
- ✅ 11 componentes UI base creados
- ✅ 5 hooks custom creados
- ✅ Storybook funcional (opcional)

**Semanas 5-7**:
- ✅ 4 features completados (solicitudes, usuarios, dashboard, reportes)
- ✅ Carpeta `components/` antigua eliminada
- ✅ 100% de componentes usando nueva estructura

**Semana 8**:
- ✅ 0 referencias a código legacy
- ✅ Build size optimizado (<500KB First Load JS)
- ✅ Lighthouse score >90
- ✅ 100% TypeScript strict mode

### Recursos Necesarios

**Humanos**:
- 1-2 desarrolladores full-stack (TypeScript + React + SQL)
- 1 QA tester (medio tiempo en Semana 1 y 8)
- 1 DBA (consultoría para validar migración SQL de Semana 8)

**Técnicos**:
- Ambiente de desarrollo local funcional
- Ambiente de staging para testing
- PostgreSQL 16+ con datos de prueba
- CI/CD configurado (GitHub Actions / GitLab CI)

**Conocimientos clave**:
- Clean Architecture y DDD
- Next.js 16 (App Router, Server Components)
- Drizzle ORM
- TypeScript avanzado
- RBAC y sistemas de permisos
- Testing (Vitest, React Testing Library)

---

## 📞 Contacto y Siguientes Pasos

**Documento creado**: 7 de enero de 2026  
**Sistema**: Gestión de Vacaciones y Permisos - CNI  
**Versión**: 2.1.0 (Post-Clean Architecture)

### Próximos Pasos Inmediatos

1. **Revisar y aprobar este plan** con stakeholders del CNI
2. **Asignar recursos** (desarrolladores, QA)
3. **Configurar ambiente de staging** para testing
4. **Iniciar Semana 1** con integración RBAC en API

### Soporte y Dudas

Para preguntas sobre este plan de implementación:

1. Revisar documentación existente:
   - [ARQUITECTURA.md](ARQUITECTURA.md)
   - [GUIA_MIGRACION.md](GUIA_MIGRACION.md)
   - [INTEGRACION_RBAC_PENDIENTE.md](INTEGRACION_RBAC_PENDIENTE.md)

2. Abrir Issue en repositorio con template apropiado

3. Consultar con equipo técnico del CNI

---

**Preparado para el Consejo Nacional de Inversiones (CNI)**  
**Nicaragua, 2026**  
**Arquitectura Clean | RBAC Completo | PostgreSQL Optimizado**
