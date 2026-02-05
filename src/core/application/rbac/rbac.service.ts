import { db, roles, permisos, rolesPermisos, usuariosRoles, usuarios } from '@/core/infrastructure/database';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Sistema RBAC - Helper para gestión de roles y permisos
 * Arquitectura Senior - Separación de concerns
 */

// =====================================================
// TIPOS
// =====================================================
export interface UsuarioConRoles {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  departamentoId: number;
  cargo?: string | null;
  roles: RolConPermisos[];
  permisos: string[]; // Array de códigos de permisos
}

export interface RolConPermisos {
  id: number;
  codigo: string;
  nombre: string;
  nivel: number;
  permisos: string[];
}

export interface ValidacionPermiso {
  tienePermiso: boolean;
  razon?: string;
  roles?: string[];
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Obtener roles y permisos de un usuario
 */
export async function obtenerRolesYPermisos(usuarioId: number): Promise<UsuarioConRoles | null> {
  try {
    // 1. Obtener usuario
    const [usuario] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    if (!usuario) return null;

    // 2. Obtener roles activos del usuario
    const rolesUsuario = await db
      .select({
        rol: roles,
        usuarioRol: usuariosRoles
      })
      .from(usuariosRoles)
      .innerJoin(roles, eq(usuariosRoles.rolId, roles.id))
      .where(
        and(
          eq(usuariosRoles.usuarioId, usuarioId),
          eq(usuariosRoles.activo, true),
          eq(roles.activo, true)
        )
      );

    if (rolesUsuario.length === 0) {
      return {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        departamentoId: usuario.departamentoId,
        cargo: usuario.cargo,
        roles: [],
        permisos: []
      };
    }

    // 3. Obtener permisos de cada rol
    const rolIds = rolesUsuario.map(r => r.rol.id);
    const permisosDeRoles = await db
      .select({
        permiso: permisos,
        rolPermiso: rolesPermisos
      })
      .from(rolesPermisos)
      .innerJoin(permisos, eq(rolesPermisos.permisoId, permisos.id))
      .where(
        and(
          inArray(rolesPermisos.rolId, rolIds),
          eq(permisos.activo, true)
        )
      );

    // 4. Agrupar permisos por rol
    const rolesConPermisos: RolConPermisos[] = rolesUsuario.map(ru => {
      const permisosDelRol = permisosDeRoles
        .filter(p => p.rolPermiso.rolId === ru.rol.id)
        .map(p => p.permiso.codigo);

      return {
        id: ru.rol.id,
        codigo: ru.rol.codigo,
        nombre: ru.rol.nombre,
        nivel: ru.rol.nivel,
        permisos: permisosDelRol
      };
    });

    // 5. Obtener array único de permisos
    const permisosUnicos = Array.from(
      new Set(rolesConPermisos.flatMap(r => r.permisos))
    );

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      departamentoId: usuario.departamentoId,
      cargo: usuario.cargo,
      roles: rolesConPermisos,
      permisos: permisosUnicos
    };
  } catch (error) {
    console.error('❌ Error obtenerRolesYPermisos:', error);
    return null;
  }
}

/**
 * Verificar si un usuario tiene un permiso específico
 */
export async function usuarioTienePermiso(
  usuarioId: number,
  codigoPermiso: string
): Promise<ValidacionPermiso> {
  try {
    const usuario = await obtenerRolesYPermisos(usuarioId);

    if (!usuario) {
      return {
        tienePermiso: false,
        razon: 'Usuario no encontrado'
      };
    }

    if (usuario.roles.length === 0) {
      return {
        tienePermiso: false,
        razon: 'Usuario sin roles asignados'
      };
    }

    const tienePermiso = usuario.permisos.includes(codigoPermiso);

    return {
      tienePermiso,
      razon: tienePermiso ? undefined : `Permiso '${codigoPermiso}' no encontrado`,
      roles: usuario.roles.map(r => r.codigo)
    };
  } catch (error) {
    console.error('❌ Error usuarioTienePermiso:', error);
    return {
      tienePermiso: false,
      razon: 'Error al verificar permiso'
    };
  }
}

/**
 * Verificar si un usuario tiene alguno de los permisos (OR)
 */
export async function usuarioTieneAlgunPermiso(
  usuarioId: number,
  codigosPermisos: string[]
): Promise<ValidacionPermiso> {
  try {
    const usuario = await obtenerRolesYPermisos(usuarioId);

    if (!usuario) {
      return {
        tienePermiso: false,
        razon: 'Usuario no encontrado'
      };
    }

    const tieneAlguno = codigosPermisos.some(codigo => 
      usuario.permisos.includes(codigo)
    );

    return {
      tienePermiso: tieneAlguno,
      razon: tieneAlguno ? undefined : `Ninguno de los permisos requeridos: ${codigosPermisos.join(', ')}`,
      roles: usuario.roles.map(r => r.codigo)
    };
  } catch (error) {
    console.error('❌ Error usuarioTieneAlgunPermiso:', error);
    return {
      tienePermiso: false,
      razon: 'Error al verificar permisos'
    };
  }
}

/**
 * Verificar si un usuario tiene todos los permisos (AND)
 */
export async function usuarioTieneTodosPermisos(
  usuarioId: number,
  codigosPermisos: string[]
): Promise<ValidacionPermiso> {
  try {
    const usuario = await obtenerRolesYPermisos(usuarioId);

    if (!usuario) {
      return {
        tienePermiso: false,
        razon: 'Usuario no encontrado'
      };
    }

    const tieneTodos = codigosPermisos.every(codigo => 
      usuario.permisos.includes(codigo)
    );

    if (!tieneTodos) {
      const faltantes = codigosPermisos.filter(codigo => 
        !usuario.permisos.includes(codigo)
      );
      return {
        tienePermiso: false,
        razon: `Permisos faltantes: ${faltantes.join(', ')}`,
        roles: usuario.roles.map(r => r.codigo)
      };
    }

    return {
      tienePermiso: true,
      roles: usuario.roles.map(r => r.codigo)
    };
  } catch (error) {
    console.error('❌ Error usuarioTieneTodosPermisos:', error);
    return {
      tienePermiso: false,
      razon: 'Error al verificar permisos'
    };
  }
}

/**
 * Verificar si un usuario tiene un rol específico
 */
export async function usuarioTieneRol(
  usuarioId: number,
  codigoRol: string
): Promise<boolean> {
  try {
    const usuario = await obtenerRolesYPermisos(usuarioId);
    if (!usuario) return false;

    return usuario.roles.some(r => r.codigo === codigoRol);
  } catch (error) {
    console.error('❌ Error usuarioTieneRol:', error);
    return false;
  }
}

/**
 * Verificar si un usuario tiene nivel de rol suficiente
 */
export async function usuarioTieneNivelMinimo(
  usuarioId: number,
  nivelMinimo: number
): Promise<boolean> {
  try {
    const usuario = await obtenerRolesYPermisos(usuarioId);
    if (!usuario || usuario.roles.length === 0) return false;

    const nivelMaximo = Math.max(...usuario.roles.map(r => r.nivel));
    return nivelMaximo >= nivelMinimo;
  } catch (error) {
    console.error('❌ Error usuarioTieneNivelMinimo:', error);
    return false;
  }
}

/**
 * Asignar rol a usuario
 */
export async function asignarRolAUsuario(
  usuarioId: number,
  codigoRol: string,
  departamentoId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener rol
    const [rol] = await db
      .select()
      .from(roles)
      .where(eq(roles.codigo, codigoRol))
      .limit(1);

    if (!rol) {
      return { success: false, error: 'Rol no encontrado' };
    }

    // 2. Verificar si ya existe asignación
    const [existente] = await db
      .select()
      .from(usuariosRoles)
      .where(
        and(
          eq(usuariosRoles.usuarioId, usuarioId),
          eq(usuariosRoles.rolId, rol.id),
          departamentoId 
            ? eq(usuariosRoles.departamentoId, departamentoId)
            : eq(usuariosRoles.departamentoId, null as any)
        )
      )
      .limit(1);

    if (existente) {
      // Activar si estaba inactivo
      if (!existente.activo) {
        await db
          .update(usuariosRoles)
          .set({ activo: true, updatedAt: new Date() })
          .where(eq(usuariosRoles.id, existente.id));
      }
      return { success: true };
    }

    // 3. Crear asignación
    await db.insert(usuariosRoles).values({
      usuarioId,
      rolId: rol.id,
      departamentoId: departamentoId || null,
      activo: true,
      fechaAsignacion: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error asignarRolAUsuario:', error);
    return { success: false, error: 'Error al asignar rol' };
  }
}

/**
 * Remover rol de usuario
 */
export async function removerRolDeUsuario(
  usuarioId: number,
  codigoRol: string,
  departamentoId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener rol
    const [rol] = await db
      .select()
      .from(roles)
      .where(eq(roles.codigo, codigoRol))
      .limit(1);

    if (!rol) {
      return { success: false, error: 'Rol no encontrado' };
    }

    // 2. Desactivar asignación (soft delete)
    await db
      .update(usuariosRoles)
      .set({ activo: false, updatedAt: new Date() })
      .where(
        and(
          eq(usuariosRoles.usuarioId, usuarioId),
          eq(usuariosRoles.rolId, rol.id),
          departamentoId 
            ? eq(usuariosRoles.departamentoId, departamentoId)
            : eq(usuariosRoles.departamentoId, null as any)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('❌ Error removerRolDeUsuario:', error);
    return { success: false, error: 'Error al remover rol' };
  }
}

// =====================================================
// HELPERS LEGACY (Compatibilidad con sistema antiguo)
// =====================================================

/**
 * Verificar si usuario es Admin (legacy + nuevo sistema)
 */
export async function esAdmin(usuarioId: number): Promise<boolean> {
  // Primero verificar en nuevo sistema
  const tieneRol = await usuarioTieneRol(usuarioId, 'ADMIN');
  if (tieneRol) return true;

  // Fallback a sistema antiguo
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  return usuario?.esAdmin || false;
}

/**
 * Verificar si usuario es RRHH (legacy + nuevo sistema)
 */
export async function esRrhh(usuarioId: number): Promise<boolean> {
  const tieneRol = await usuarioTieneRol(usuarioId, 'RRHH');
  if (tieneRol) return true;

  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  return usuario?.esRrhh || false;
}

/**
 * Verificar si usuario es Jefe (legacy + nuevo sistema)
 */
export async function esJefe(usuarioId: number): Promise<boolean> {
  const tieneRol = await usuarioTieneRol(usuarioId, 'JEFE');
  if (tieneRol) return true;

  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  return usuario?.esJefe || false;
}

// =====================================================
// CACHE (Opcional - para optimización futura)
// =====================================================

// Map para cache en memoria (TTL: 5 minutos)
const cachePermisos = new Map<string, { data: UsuarioConRoles; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function limpiarCacheUsuario(usuarioId: number) {
  cachePermisos.delete(`user_${usuarioId}`);
}

export function limpiarTodoCache() {
  cachePermisos.clear();
}

// Versión con cache (usar solo si performance es crítico)
export async function obtenerRolesYPermisosConCache(usuarioId: number): Promise<UsuarioConRoles | null> {
  const cacheKey = `user_${usuarioId}`;
  const cached = cachePermisos.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await obtenerRolesYPermisos(usuarioId);
  if (data) {
    cachePermisos.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}
