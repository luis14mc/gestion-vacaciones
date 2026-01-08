/**
 * Helper de autenticación y autorización con RBAC
 * Sistema de Gestión de Vacaciones - CNI Honduras
 * 
 * @module lib/auth
 */

import { auth } from '@/auth';
import type { SessionUser, RolUsuario } from '@/types';

/**
 * Obtiene la sesión actual del usuario con roles y permisos RBAC desde NextAuth
 * 
 * @returns SessionUser completo con roles y permisos o null si no hay sesión
 * 
 * @example
 * ```typescript
 * const session = await getSession();
 * if (!session) {
 *   return redirect('/login');
 * }
 * console.log(session.roles); // [{ codigo: 'ADMIN', nombre: 'Administrador', nivel: 3 }]
 * console.log(session.permisos); // ['vacaciones.solicitudes.crear', ...]
 * ```
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    // Obtener sesión de NextAuth
    const session = await auth();
    
    if (!session?.user) {
      return null;
    }
    
    // La sesión de NextAuth ya tiene roles y permisos porque se agregan en auth.ts
    const sessionUser: SessionUser = {
      id: parseInt(session.user.id),
      email: session.user.email!,
      nombre: session.user.nombre,
      apellido: session.user.apellido,
      departamentoId: session.user.departamentoId,
      departamentoNombre: session.user.departamentoNombre || undefined,
      cargo: session.user.cargo || undefined,
      
      // Sistema RBAC (ya viene en la sesión de NextAuth)
      roles: session.user.roles || [],
      permisos: session.user.permisos || [],
      
      // DEPRECATED - Calcular desde roles[] por compatibilidad
      esAdmin: session.user.esAdmin || false,
      esRrhh: session.user.esRrhh || false,
      esJefe: session.user.esJefe || false,
    };
    
    return sessionUser;
  } catch (error) {
    console.error('❌ Error al obtener sesión:', error);
    return null;
  }
}

/**
 * Verifica si el usuario tiene un permiso específico
 * 
 * @param user - Usuario de sesión
 * @param permiso - Código del permiso a verificar (ej: 'vacaciones.solicitudes.crear')
 * @returns true si el usuario tiene el permiso, false en caso contrario
 * 
 * @example
 * ```typescript
 * const session = await getSession();
 * if (!tienePermiso(session, 'vacaciones.solicitudes.aprobar_jefe')) {
 *   return Response.json({ error: 'Sin permiso' }, { status: 403 });
 * }
 * ```
 */
export function tienePermiso(user: SessionUser | null, permiso: string): boolean {
  if (!user) return false;
  return user.permisos.includes(permiso);
}

/**
 * Verifica si el usuario tiene al menos uno de los permisos especificados
 * 
 * @param user - Usuario de sesión
 * @param permisos - Array de códigos de permisos
 * @returns true si el usuario tiene al menos uno de los permisos
 * 
 * @example
 * ```typescript
 * if (!tieneAlgunoDeEstosPermisos(session, ['reportes.general', 'reportes.departamento'])) {
 *   return Response.json({ error: 'Sin acceso a reportes' }, { status: 403 });
 * }
 * ```
 */
export function tieneAlgunoDeEstosPermisos(user: SessionUser | null, permisos: string[]): boolean {
  if (!user) return false;
  return permisos.some(permiso => user.permisos.includes(permiso));
}

/**
 * Verifica si el usuario tiene TODOS los permisos especificados
 * 
 * @param user - Usuario de sesión
 * @param permisos - Array de códigos de permisos
 * @returns true si el usuario tiene todos los permisos
 * 
 * @example
 * ```typescript
 * if (!tieneTodosLosPermisos(session, ['usuarios.ver', 'usuarios.editar'])) {
 *   return Response.json({ error: 'Permisos insuficientes' }, { status: 403 });
 * }
 * ```
 */
export function tieneTodosLosPermisos(user: SessionUser | null, permisos: string[]): boolean {
  if (!user) return false;
  return permisos.every(permiso => user.permisos.includes(permiso));
}

/**
 * Verifica si el usuario tiene un rol específico
 * 
 * @param user - Usuario de sesión
 * @param rolCodigo - Código del rol (ADMIN, RRHH, JEFE, EMPLEADO)
 * @returns true si el usuario tiene el rol
 * 
 * @example
 * ```typescript
 * if (tieneRol(session, 'ADMIN')) {
 *   // Mostrar opciones de administrador
 * }
 * ```
 */
export function tieneRol(user: SessionUser | null, rolCodigo: string): boolean {
  if (!user) return false;
  return user.roles.some(r => r.codigo === rolCodigo);
}

/**
 * Verifica si el usuario tiene un nivel jerárquico mínimo
 * 
 * Niveles:
 * - 0: EMPLEADO
 * - 1: JEFE
 * - 2: RRHH
 * - 3: ADMIN
 * 
 * @param user - Usuario de sesión
 * @param nivelRequerido - Nivel mínimo requerido (0-3)
 * @returns true si el usuario tiene nivel >= al requerido
 * 
 * @example
 * ```typescript
 * // Solo RRHH (nivel 2) o ADMIN (nivel 3)
 * if (!tieneNivelMinimo(session, 2)) {
 *   return Response.json({ error: 'Acceso denegado' }, { status: 403 });
 * }
 * ```
 */
export function tieneNivelMinimo(user: SessionUser | null, nivelRequerido: number): boolean {
  if (!user) return false;
  return user.roles.some(r => r.nivel >= nivelRequerido);
}

/**
 * Obtiene el nivel más alto del usuario
 * 
 * @param user - Usuario de sesión
 * @returns Nivel más alto (0-3) o -1 si no tiene roles
 * 
 * @example
 * ```typescript
 * const nivel = obtenerNivelMaximo(session);
 * if (nivel >= 2) {
 *   // Usuario es RRHH o ADMIN
 * }
 * ```
 */
export function obtenerNivelMaximo(user: SessionUser | null): number {
  if (!user || !user.roles.length) return -1;
  return Math.max(...user.roles.map(r => r.nivel));
}

/**
 * Obtiene los códigos de todos los roles del usuario
 * 
 * @param user - Usuario de sesión
 * @returns Array de códigos de roles
 * 
 * @example
 * ```typescript
 * const roles = obtenerRoles(session);
 * console.log(roles); // ['ADMIN', 'RRHH']
 * ```
 */
export function obtenerRoles(user: SessionUser | null): string[] {
  if (!user) return [];
  return user.roles.map(r => r.codigo);
}

/**
 * Verifica si el usuario está autenticado
 * 
 * @param user - Usuario de sesión
 * @returns true si hay sesión válida
 * 
 * @example
 * ```typescript
 * if (!estaAutenticado(session)) {
 *   return redirect('/login');
 * }
 * ```
 */
export function estaAutenticado(user: SessionUser | null): boolean {
  return user !== null && user.id > 0;
}

/**
 * Genera mensaje de error descriptivo para permisos denegados
 * 
 * @param permiso - Permiso que se intentó verificar
 * @returns Mensaje de error descriptivo
 * 
 * @example
 * ```typescript
 * if (!tienePermiso(session, 'usuarios.eliminar')) {
 *   return Response.json(
 *     { error: mensajePermisoDenegado('usuarios.eliminar') }, 
 *     { status: 403 }
 *   );
 * }
 * ```
 */
export function mensajePermisoDenegado(permiso: string): string {
  return `No tiene permiso para realizar esta acción. Permiso requerido: ${permiso}`;
}

/**
 * Verifica múltiples condiciones de autorización
 * Útil para endpoints complejos con múltiples requisitos
 * 
 * @param user - Usuario de sesión
 * @param opciones - Condiciones a verificar
 * @returns Objeto con resultado y mensaje de error si falla
 * 
 * @example
 * ```typescript
 * const { autorizado, error } = verificarAutorizacion(session, {
 *   requiereAutenticacion: true,
 *   nivelMinimo: 2,
 *   permisos: ['reportes.general'],
 *   roles: ['ADMIN', 'RRHH']
 * });
 * 
 * if (!autorizado) {
 *   return Response.json({ error }, { status: 403 });
 * }
 * ```
 */
export function verificarAutorizacion(
  user: SessionUser | null,
  opciones: {
    requiereAutenticacion?: boolean;
    nivelMinimo?: number;
    permisos?: string[];
    roles?: string[];
    todosLosPermisos?: boolean; // true = AND, false = OR
  }
): { autorizado: boolean; error?: string } {
  const {
    requiereAutenticacion = true,
    nivelMinimo,
    permisos = [],
    roles = [],
    todosLosPermisos = false
  } = opciones;
  
  // Verificar autenticación
  if (requiereAutenticacion && !estaAutenticado(user)) {
    return {
      autorizado: false,
      error: 'Debe iniciar sesión para acceder a este recurso'
    };
  }
  
  // Verificar nivel mínimo
  if (nivelMinimo !== undefined && !tieneNivelMinimo(user, nivelMinimo)) {
    return {
      autorizado: false,
      error: `Nivel de acceso insuficiente. Nivel requerido: ${nivelMinimo}`
    };
  }
  
  // Verificar permisos
  if (permisos.length > 0) {
    const tienePermisos = todosLosPermisos
      ? tieneTodosLosPermisos(user, permisos)
      : tieneAlgunoDeEstosPermisos(user, permisos);
    
    if (!tienePermisos) {
      return {
        autorizado: false,
        error: `Permiso denegado. Permisos requeridos: ${permisos.join(', ')}`
      };
    }
  }
  
  // Verificar roles
  if (roles.length > 0) {
    const tieneRolRequerido = roles.some(rol => tieneRol(user, rol));
    if (!tieneRolRequerido) {
      return {
        autorizado: false,
        error: `Rol insuficiente. Roles permitidos: ${roles.join(', ')}`
      };
    }
  }
  
  return { autorizado: true };
}
