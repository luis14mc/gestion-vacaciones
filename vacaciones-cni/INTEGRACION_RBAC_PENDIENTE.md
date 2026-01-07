# 🔍 Análisis de Integración RBAC - Sistema de Gestión de Vacaciones

**Fecha**: 7 de enero de 2026  
**Estado**: ⚠️ Sistema RBAC implementado pero NO integrado  
**Prioridad**: 🔴 ALTA

---

## 📊 Resumen Ejecutivo

### ✅ Completado (Infraestructura)

- [x] Schema de BD con 4 tablas RBAC (roles, permisos, roles_permisos, usuarios_roles)
- [x] Migraciones SQL completas (650+ líneas)
- [x] Helper RBAC con 15+ funciones (src/lib/rbac.ts)
- [x] Foreign Keys y validaciones en BD
- [x] Documentación técnica completa

### ❌ Pendiente (Integración)

- [ ] **0 API routes usan el sistema RBAC** (21 archivos)
- [ ] **0 componentes frontend usan permisos RBAC** (20+ archivos)
- [ ] **100% del código sigue usando sistema legacy** (es_jefe, es_rrhh, es_admin)
- [ ] Middleware de autorización no implementado
- [ ] UI para gestión de roles/permisos no existe
- [ ] Tests de integración RBAC no existen

---

## 🚨 Problemas Críticos Identificados

### 1. API Routes - Sistema Legacy (21 archivos)

**Problema**: TODAS las rutas API siguen verificando roles con campos booleanos legacy.

#### Archivos Afectados:

##### 🔴 Autenticación
- `src/app/api/auth/login/route.ts`
  - **Línea 64-66**: Retorna `esJefe`, `esRrhh`, `esAdmin` en SessionUser
  - **Impacto**: La sesión NO incluye roles RBAC ni permisos
  - **Corrección**: Obtener roles/permisos con `obtenerRolesYPermisos()` y agregarlo a sesión

##### 🔴 Dashboard - Jefes
- `src/app/api/dashboard/jefe/metricas/route.ts`
  - **Línea 11**: `if (!session?.user?.esJefe || session.user?.esAdmin || session.user?.esRrhh)`
  - **Problema**: Usa campos legacy en lugar de verificar permiso `reportes.departamento`
  - **Corrección**: 
    ```typescript
    const { tienePermiso } = await usuarioTienePermiso(session.user.id, 'reportes.departamento');
    if (!tienePermiso) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    ```

##### 🔴 Dashboard - RRHH
- `src/app/api/dashboard/rrhh/metricas/route.ts`
  - **Línea 11**: `if (!session?.user?.esRrhh || session.user?.esAdmin)`
  - **Problema**: Usa campos legacy
  - **Corrección**: Verificar `reportes.general` o nivel mínimo RRHH

##### 🔴 Usuarios
- `src/app/api/usuarios/route.ts`
  - **Línea 22**: `if (session?.user?.esJefe && !session?.user?.esAdmin && !session?.user?.esRrhh)`
  - **Problema**: Autorización basada en flags booleanos
  - **Corrección**: 
    ```typescript
    const { tienePermiso: puedeVerTodos } = await usuarioTienePermiso(
      session.user.id, 
      'usuarios.ver'
    );
    ```

##### 🔴 Solicitudes
- `src/app/api/solicitudes/route.ts`
  - **GET (línea ~60)**: No verifica permisos `vacaciones.solicitudes.ver_todas`
  - **POST (línea ~80)**: No verifica `vacaciones.solicitudes.crear`
  - **PATCH (línea ~250)**: Lógica de aprobación usa campos legacy
  - **Corrección**: Agregar validación RBAC antes de cada operación

##### 🟡 Otros Endpoints sin Validación RBAC:
- `src/app/api/balances/route.ts` - No verifica `balances.ver_todos`
- `src/app/api/tipos-ausencia/route.ts` - No verifica `config.tipos_ausencia`
- `src/app/api/configuracion/route.ts` - No verifica `config.sistema`
- `src/app/api/departamentos/route.ts` - No verifica `departamentos.ver`
- `src/app/api/reportes/route.ts` - No verifica `reportes.*`
- `src/app/api/reportes/departamento/route.ts` - Sistema legacy
- `src/app/api/reportes/exportar/route.ts` - No verifica `reportes.exportar`
- `src/app/api/exportar/route.ts` - Usa campos legacy (línea 113-115)
- `src/app/api/auditoria/route.ts` - Sin validación de permisos
- `src/app/api/asignacion-masiva/route.ts` - Sin validación
- `src/app/api/dashboard/calendario/route.ts` - Sin validación
- `src/app/api/dashboard/actividad/route.ts` - Sin validación
- `src/app/api/dashboard/metricas/route.ts` - Sin validación
- `src/app/api/dashboard/mi-balance/route.ts` - Sin validación

### 2. Componentes Frontend - Sistema Legacy (20+ archivos)

**Problema**: Componentes usan `esJefe`, `esRrhh`, `esAdmin` de sesión en lugar de verificar permisos.

#### Archivos Afectados:

##### 🔴 Páginas con Validación Legacy
- `src/app/usuarios/page.tsx`
  - **Línea 12**: `if (!session.user.esAdmin && !session.user.esRrhh)`
  - **Problema**: Restringe acceso con flags legacy
  - **Corrección**: Verificar permiso `usuarios.ver` en servidor o cliente

- `src/app/configuracion/page.tsx`
  - **Línea 12**: `if (!session.user.esAdmin)`
  - **Corrección**: Verificar `config.sistema`

##### 🔴 Componentes con Lógica Legacy
- `src/app/usuarios/UsuariosClient.tsx`
  - **Líneas 33-35**: Tipos TypeScript incluyen `esAdmin`, `esRrhh`, `esJefe`
  - **Líneas 78-80**: FormData con campos legacy
  - **Líneas 137-139**: POST incluye campos legacy
  - **Líneas 248-250, 267-269**: Gestión de roles legacy
  - **Problema**: Formulario permite editar flags booleanos en lugar de asignar roles RBAC
  - **Corrección**: 
    1. Cambiar UI para seleccionar roles del sistema (ADMIN, RRHH, JEFE, EMPLEADO)
    2. Al guardar, usar `asignarRolAUsuario()` del helper RBAC
    3. Eliminar checkboxes de es_jefe/es_rrhh/es_admin

- `src/components/SolicitudesTable.tsx` (probable)
  - **Estimado**: Botones de aprobar/rechazar basados en `esJefe`/`esRrhh`
  - **Corrección**: Verificar permisos específicos en cliente

- `src/components/NavBar.tsx` o `src/components/Sidebar.tsx` (si existen)
  - **Estimado**: Menú condicionalmente renderizado según roles legacy
  - **Corrección**: Verificar permisos antes de mostrar cada ítem

### 3. Tipos TypeScript - Inconsistencia

**Problema**: SessionUser incluye campos legacy pero no roles/permisos RBAC.

#### Archivo: `src/types/index.ts`

```typescript
// ❌ ACTUAL (líneas 14-26)
interface Session {
  user: {
    id: number;
    nombre: string;
    apellido: string;
    departamentoId: number;
    departamentoNombre?: string;
    cargo?: string | null;
    esJefe: boolean;      // ❌ Legacy
    esRrhh: boolean;      // ❌ Legacy
    esAdmin: boolean;     // ❌ Legacy
  } & DefaultSession["user"];
}

// ✅ CORRECCIÓN NECESARIA
interface Session {
  user: {
    id: number;
    email: string;
    nombre: string;
    apellido: string;
    departamentoId: number;
    departamentoNombre?: string;
    cargo?: string | null;
    // ⚠️ Mantener temporalmente para compatibilidad
    esJefe?: boolean;
    esRrhh?: boolean;
    esAdmin?: boolean;
    // 🆕 Agregar sistema RBAC
    roles?: Array<{
      codigo: string;
      nombre: string;
      nivel: number;
    }>;
    permisos?: string[]; // Array de códigos: ['vacaciones.solicitudes.crear', ...]
  } & DefaultSession["user"];
}
```

### 4. Middleware - No Implementado

**Problema**: No existe middleware global de autorización.

#### Archivo Faltante: `src/middleware.ts`

**Necesidad**:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  
  // Rutas públicas
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next();
  }
  
  // Verificar autenticación
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // 🆕 Verificar permisos RBAC por ruta
  const pathname = request.nextUrl.pathname;
  
  // Ejemplo: /usuarios requiere permiso usuarios.ver
  if (pathname.startsWith('/usuarios')) {
    const hasPermission = token.permisos?.includes('usuarios.ver');
    if (!hasPermission) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  
  // Ejemplo: /configuracion requiere config.sistema
  if (pathname.startsWith('/configuracion')) {
    const hasPermission = token.permisos?.includes('config.sistema');
    if (!hasPermission) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
```

### 5. UI Gestión de Roles - No Existe

**Problema**: No hay interfaz para asignar/remover roles a usuarios.

#### Archivos Faltantes:

- `src/app/admin/roles/page.tsx` - Listado de roles y permisos
- `src/app/admin/usuarios/[id]/roles/page.tsx` - Asignar roles a usuario
- `src/components/RoleSelector.tsx` - Componente para seleccionar roles
- `src/components/PermissionMatrix.tsx` - Vista de permisos por rol

**Funcionalidad Requerida**:
1. Ver todos los roles del sistema
2. Ver permisos de cada rol
3. Asignar múltiples roles a un usuario
4. Definir scope de rol (departamento específico o global)
5. Establecer fecha de expiración de rol
6. Ver historial de asignaciones

### 6. Schema Backup - Archivo Obsoleto

**Problema**: Existe un archivo backup del schema antiguo.

#### Archivo: `src/lib/db/schema.backup.ts`

- **Acción**: ELIMINAR - Ya no es necesario
- **Razón**: `schema.ts` actual ya tiene todo implementado

---

## 📋 Plan de Acción - Integración Completa

### Fase 1: Preparación (2 horas)

#### 1.1. Actualizar Tipos TypeScript
- [ ] Modificar `src/types/index.ts` para incluir roles/permisos en SessionUser
- [ ] Crear tipos para RoleSelector, PermissionCheck
- [ ] Agregar tipos para respuestas de validación RBAC

#### 1.2. Actualizar Login
- [ ] Modificar `src/app/api/auth/login/route.ts`
- [ ] Obtener roles/permisos con `obtenerRolesYPermisos()`
- [ ] Incluir en objeto SessionUser
- [ ] Mantener campos legacy temporalmente

#### 1.3. Eliminar Archivos Obsoletos
```powershell
Remove-Item "src/lib/db/schema.backup.ts" -Force
```

### Fase 2: API Routes (6-8 horas)

#### 2.1. Crear Helper de Autorización
**Archivo**: `src/lib/authorization.ts`

```typescript
import { auth } from '@/auth';
import { usuarioTienePermiso, usuarioTieneAlgunPermiso } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function requirePermission(permiso: string) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) 
    };
  }
  
  const { tienePermiso, razon } = await usuarioTienePermiso(session.user.id, permiso);
  
  if (!tienePermiso) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: razon || 'No autorizado' }, { status: 403 }) 
    };
  }
  
  return { authorized: true, userId: session.user.id };
}

export async function requireAnyPermission(permisos: string[]) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) 
    };
  }
  
  const { tienePermiso, razon } = await usuarioTieneAlgunPermiso(session.user.id, permisos);
  
  if (!tienePermiso) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: razon || 'No autorizado' }, { status: 403 }) 
    };
  }
  
  return { authorized: true, userId: session.user.id };
}
```

#### 2.2. Migrar Endpoints (Prioridad)

**Alta Prioridad** (usuarios frecuentes):
1. `src/app/api/solicitudes/route.ts`
   - GET: Verificar `vacaciones.solicitudes.ver` o `vacaciones.solicitudes.ver_todas`
   - POST: Verificar `vacaciones.solicitudes.crear`
   - PATCH: Verificar `vacaciones.solicitudes.aprobar_jefe`, `aprobar_rrhh`, `rechazar`

2. `src/app/api/usuarios/route.ts`
   - GET: Verificar `usuarios.ver`
   - POST: Verificar `usuarios.crear`
   - PATCH: Verificar `usuarios.editar`

3. `src/app/api/balances/route.ts`
   - GET: Verificar `balances.ver_propios` o `balances.ver_todos`

**Media Prioridad** (admin/config):
4. `src/app/api/configuracion/route.ts` → `config.sistema`
5. `src/app/api/tipos-ausencia/route.ts` → `config.tipos_ausencia`
6. `src/app/api/departamentos/route.ts` → `departamentos.*`

**Baja Prioridad** (reportes):
7. `src/app/api/reportes/**/*.ts` → `reportes.*`
8. `src/app/api/exportar/route.ts` → `reportes.exportar`

#### 2.3. Template de Migración

**Antes** (sistema legacy):
```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.esAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  
  // Lógica...
}
```

**Después** (sistema RBAC):
```typescript
import { requirePermission } from '@/lib/authorization';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('config.sistema');
  if (!authCheck.authorized) return authCheck.response;
  
  const userId = authCheck.userId;
  
  // Lógica...
}
```

### Fase 3: Frontend (4-6 horas)

#### 3.1. Hook de Permisos
**Archivo**: `src/hooks/usePermissions.ts`

```typescript
import { useSession } from 'next-auth/react';

export function usePermissions() {
  const { data: session } = useSession();
  
  const hasPermission = (permiso: string): boolean => {
    return session?.user?.permisos?.includes(permiso) ?? false;
  };
  
  const hasAnyPermission = (permisos: string[]): boolean => {
    return permisos.some(p => hasPermission(p));
  };
  
  const hasRole = (role: string): boolean => {
    return session?.user?.roles?.some(r => r.codigo === role) ?? false;
  };
  
  return { hasPermission, hasAnyPermission, hasRole };
}
```

#### 3.2. Componente Wrapper
**Archivo**: `src/components/RequirePermission.tsx`

```typescript
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { ReactNode } from 'react';

interface Props {
  permiso: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function RequirePermission({ permiso, fallback, children }: Props) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permiso)) {
    return fallback || null;
  }
  
  return <>{children}</>;
}
```

#### 3.3. Migrar Componentes

**Ejemplo**: `src/app/usuarios/UsuariosClient.tsx`

```tsx
// ❌ ANTES
{session.user.esAdmin && (
  <button onClick={handleCreate}>Crear Usuario</button>
)}

// ✅ DESPUÉS
import { RequirePermission } from '@/components/RequirePermission';

<RequirePermission permiso="usuarios.crear">
  <button onClick={handleCreate}>Crear Usuario</button>
</RequirePermission>
```

#### 3.4. Actualizar Formulario de Usuario

Cambiar de checkboxes legacy a selector de roles:

```tsx
// ❌ ELIMINAR
<label>
  <input type="checkbox" checked={formData.esAdmin} onChange={...} />
  Administrador
</label>

// ✅ AGREGAR
import { RoleSelector } from '@/components/RoleSelector';

<RoleSelector
  usuarioId={usuario.id}
  rolesActuales={usuario.roles}
  onChange={handleRolesChange}
/>
```

### Fase 4: UI Admin (4-6 horas)

#### 4.1. Página de Gestión de Roles
**Archivo**: `src/app/admin/roles/page.tsx`

- Listar todos los roles
- Mostrar permisos de cada rol
- Crear nuevo rol custom
- Editar roles custom (no roles de sistema)
- Ver usuarios con cada rol

#### 4.2. Asignación de Roles
**Archivo**: `src/app/admin/usuarios/[id]/roles/page.tsx`

- Ver roles actuales del usuario
- Asignar nuevos roles
- Remover roles
- Definir scope (departamento)
- Establecer fecha de expiración

#### 4.3. API para Gestión
**Archivo**: `src/app/api/admin/roles/route.ts`

```typescript
// GET: Listar roles
// POST: Crear rol custom
// PATCH: Editar rol custom
// DELETE: Eliminar rol custom (soft delete)
```

### Fase 5: Testing (3-4 horas)

#### 5.1. Tests de Permisos
```typescript
// tests/rbac.test.ts
describe('Sistema RBAC', () => {
  test('Admin tiene todos los permisos', async () => {
    const result = await usuarioTienePermiso(adminId, 'cualquier.permiso');
    expect(result.tienePermiso).toBe(true);
  });
  
  test('Empleado no puede crear usuarios', async () => {
    const result = await usuarioTienePermiso(empleadoId, 'usuarios.crear');
    expect(result.tienePermiso).toBe(false);
  });
  
  test('Jefe puede aprobar solicitudes de su departamento', async () => {
    const result = await usuarioTienePermiso(jefeId, 'vacaciones.solicitudes.aprobar_jefe');
    expect(result.tienePermiso).toBe(true);
  });
});
```

#### 5.2. Tests de Endpoints
```typescript
// tests/api/solicitudes.test.ts
describe('POST /api/solicitudes', () => {
  test('Usuario sin permiso recibe 403', async () => {
    const response = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenSinPermiso}` }
    });
    expect(response.status).toBe(403);
  });
  
  test('Usuario con permiso puede crear', async () => {
    const response = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenConPermiso}` },
      body: JSON.stringify(solicitud)
    });
    expect(response.status).toBe(200);
  });
});
```

### Fase 6: Migración de Datos (1-2 horas)

#### 6.1. Script de Migración
**Archivo**: `scripts/migrate-users-to-rbac.ts`

```typescript
/**
 * Migra usuarios del sistema legacy al RBAC
 * Ya hecho en migrations/001_schema_improvements.sql (Step 3)
 * Este script es para re-ejecutar si hay nuevos usuarios
 */

import { db } from '@/lib/db';
import { usuarios, roles, usuariosRoles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function migrateUsersToRBAC() {
  // Obtener usuarios con roles legacy
  const allUsers = await db.select().from(usuarios);
  
  // Obtener IDs de roles
  const [adminRole] = await db.select().from(roles).where(eq(roles.codigo, 'ADMIN'));
  const [rrhhRole] = await db.select().from(roles).where(eq(roles.codigo, 'RRHH'));
  const [jefeRole] = await db.select().from(roles).where(eq(roles.codigo, 'JEFE'));
  const [empleadoRole] = await db.select().from(roles).where(eq(roles.codigo, 'EMPLEADO'));
  
  for (const user of allUsers) {
    // Determinar roles
    const rolesToAssign = [];
    
    if (user.esAdmin) rolesToAssign.push(adminRole.id);
    if (user.esRrhh) rolesToAssign.push(rrhhRole.id);
    if (user.esJefe) rolesToAssign.push(jefeRole.id);
    if (rolesToAssign.length === 0) rolesToAssign.push(empleadoRole.id);
    
    // Insertar asignaciones
    for (const rolId of rolesToAssign) {
      await db.insert(usuariosRoles).values({
        usuarioId: user.id,
        rolId,
        departamentoId: user.departamentoId,
        activo: true
      }).onConflictDoNothing();
    }
  }
  
  console.log(`✅ Migrados ${allUsers.length} usuarios a sistema RBAC`);
}

migrateUsersToRBAC();
```

### Fase 7: Limpieza (1 hora)

#### 7.1. Deprecar Campos Legacy (Futuro - Fase 2)

**IMPORTANTE**: NO ejecutar hasta validar 100% del nuevo sistema (1-2 meses).

```sql
-- migrations/002_remove_legacy_roles.sql
-- ⚠️ Ejecutar SOLO después de validación completa

-- Paso 1: Verificar que todos los usuarios tienen roles RBAC
SELECT COUNT(*) FROM usuarios u
LEFT JOIN usuarios_roles ur ON u.id = ur.usuario_id
WHERE ur.id IS NULL;
-- Si retorna > 0, NO continuar

-- Paso 2: Eliminar columnas legacy
ALTER TABLE usuarios DROP COLUMN es_jefe;
ALTER TABLE usuarios DROP COLUMN es_rrhh;
ALTER TABLE usuarios DROP COLUMN es_admin;

-- Paso 3: Eliminar vista de compatibilidad
DROP VIEW IF EXISTS usuarios_legacy;
```

---

## 🎯 Priorización Recomendada

### Sprint 1 (1 semana) - Fundamentos
1. ✅ Actualizar tipos TypeScript
2. ✅ Modificar login para incluir roles/permisos
3. ✅ Crear helper de autorización
4. ✅ Migrar endpoint de solicitudes (más usado)
5. ✅ Crear hook usePermissions
6. ✅ Testing básico

### Sprint 2 (1 semana) - API Routes
1. Migrar endpoints de usuarios
2. Migrar endpoints de balances
3. Migrar dashboard jefe/rrhh
4. Migrar configuración y tipos-ausencia
5. Testing de endpoints

### Sprint 3 (1 semana) - Frontend
1. Crear RequirePermission component
2. Migrar páginas principales
3. Actualizar formulario de usuarios
4. Actualizar navbar/sidebar con permisos
5. Testing frontend

### Sprint 4 (1 semana) - UI Admin
1. Página de gestión de roles
2. Página de asignación de roles a usuarios
3. API de admin
4. Testing de funcionalidad admin

### Sprint 5 (3 días) - Validación
1. Testing E2E completo
2. Validar migración de usuarios
3. Documentar proceso
4. Training equipo

### Sprint 6 (Futuro - 2-3 meses después)
1. Monitorear uso del sistema
2. Validar estabilidad
3. Eliminar campos legacy
4. Limpiar código obsoleto

---

## 📈 Métricas de Éxito

### KPIs de Integración

| Métrica | Estado Actual | Objetivo |
|---------|---------------|----------|
| **API routes con RBAC** | 0/21 (0%) | 21/21 (100%) |
| **Componentes con RBAC** | 0/20 (~0%) | 20/20 (100%) |
| **Tests de permisos** | 0 | 50+ |
| **Coverage RBAC** | 0% | 80%+ |
| **Usuarios migrados** | 0% (solo en BD) | 100% |
| **Roles asignados por UI** | No existe | Funcional |

### Validaciones Pre-Producción

- [ ] Todos los endpoints tienen validación RBAC
- [ ] No queda código usando `esJefe`/`esRrhh`/`esAdmin` (excepto compatibilidad)
- [ ] Tests pasan al 100%
- [ ] Documentación actualizada
- [ ] Training completado
- [ ] Performance <5ms por verificación de permiso
- [ ] Logs de auditoría funcionando

---

## 🔄 Compatibilidad Durante Transición

### Sistema Dual (Recomendado)

Durante la transición, **ambos sistemas funcionan**:

1. **Login**: Retorna AMBOS (legacy + RBAC)
   ```typescript
   {
     esJefe: true,        // ← Legacy (de BD)
     esRrhh: false,       // ← Legacy (de BD)
     roles: ['JEFE'],     // ← RBAC (de usuarios_roles)
     permisos: ['vacaciones.solicitudes.aprobar_jefe', ...]
   }
   ```

2. **API Routes**: Verifican RBAC primero, fallback a legacy
   ```typescript
   // Helper en rbac.ts ya implementado
   export async function esJefe(usuarioId: number): Promise<boolean> {
     // 1. Verificar rol RBAC
     const tieneRol = await usuarioTieneRol(usuarioId, 'JEFE');
     if (tieneRol) return true;
     
     // 2. Fallback a campo legacy
     const usuario = await db.query.usuarios.findFirst({
       where: eq(usuarios.id, usuarioId)
     });
     return usuario?.esJefe ?? false;
   }
   ```

3. **Frontend**: Preferir RBAC, aceptar legacy
   ```typescript
   const canApprove = session.user.permisos?.includes('vacaciones.solicitudes.aprobar_jefe') 
                   || session.user.esJefe;
   ```

### Ventajas Sistema Dual
- ✅ Sin breaking changes
- ✅ Rollback fácil
- ✅ Migración gradual
- ✅ Testing en producción
- ✅ Sin downtime

---

## 🚀 Comandos de Despliegue

### Desarrollo
```powershell
# 1. Asegurar migraciones ejecutadas
pnpm run db:migrate

# 2. Verificar roles en BD
psql -U postgres -d vacaciones -c "SELECT * FROM roles;"

# 3. Verificar usuarios_roles
psql -U postgres -d vacaciones -c "
  SELECT u.email, r.codigo as rol, ur.activo 
  FROM usuarios u
  JOIN usuarios_roles ur ON u.id = ur.usuario_id
  JOIN roles r ON ur.rol_id = r.id
  WHERE ur.activo = true;
"

# 4. Desarrollo
pnpm dev
```

### Testing
```powershell
# Tests unitarios
pnpm test

# Tests de integración
pnpm test:integration

# Coverage
pnpm test:coverage
```

### Producción
```powershell
# 1. Backup BD
pg_dump vacaciones > backup_pre_rbac_$(date +%Y%m%d).sql

# 2. Ejecutar migraciones
pnpm run db:migrate

# 3. Build
pnpm build

# 4. Deploy
pnpm start
```

---

## 📞 Siguientes Pasos Inmediatos

### Hoy (2 horas)
1. ✅ Revisar este documento
2. ⏳ Decidir priorización (¿seguir plan recomendado?)
3. ⏳ Crear issues en GitHub/Jira por cada fase
4. ⏳ Asignar responsables

### Mañana (Sprint 1 - Día 1)
1. Actualizar `src/types/index.ts`
2. Modificar `src/app/api/auth/login/route.ts`
3. Crear `src/lib/authorization.ts`
4. Testing básico de login con roles

### Esta Semana (Sprint 1 completo)
- Migrar endpoint de solicitudes
- Crear hook usePermissions
- Testing de permisos básicos
- Documentar cambios

---

## ⚠️ Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Breaking changes en producción | Media | Alto | Sistema dual con fallback |
| Performance degradado | Baja | Medio | Cache de permisos (5min TTL) |
| Usuarios sin roles asignados | Alta | Alto | Script de migración automático |
| UI confusa para asignar roles | Media | Medio | Prototipar antes de desarrollar |
| Tests insuficientes | Alta | Alto | TDD desde Sprint 1 |
| Rollback complejo | Baja | Alto | Mantener campos legacy 2-3 meses |

---

**Conclusión**: El sistema RBAC está **100% implementado a nivel de BD** pero **0% integrado en la aplicación**. Se requiere un esfuerzo de **~4 semanas** para integración completa siguiendo el plan propuesto.

**Recomendación**: Iniciar Sprint 1 inmediatamente para evitar deuda técnica y aprovechar la arquitectura senior ya implementada.
