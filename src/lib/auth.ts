/**
 * Helper de autenticación y autorización con RBAC
 * Sistema de Gestión de Vacaciones - CNI Honduras
 * 
 * @module lib/auth
 */

import { auth } from '@/auth';
import type { SessionUser, RolUsuario } from '@/types';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getSession(): Promise<SessionUser | null> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return null;
    }

    // session.user.id puede ser string (del JWT) o number (del callback session)
    const rawId = session.user.id;
    const userId = typeof rawId === 'number' ? rawId : Number(rawId);

    if (!userId || isNaN(userId) || userId <= 0) {
      console.error('ID de usuario inválido:', rawId);
      return null;
    }

    // Siempre leer flags desde BD para no depender del token JWT stale
    let esAdminDb = false;
    let esRrhhDb = false;
    let esDirectorDb = false;
    let esJefeDb = false;
    let departamentoIdDb: number | null | undefined;
    let cargoDb: string | null | undefined;

    try {
      const [row] = await db
        .select({
          esAdmin: usuarios.esAdmin,
          esRrhh: usuarios.esRrhh,
          esDirector: usuarios.esDirector,
          esJefe: usuarios.esJefe,
          departamentoId: usuarios.departamentoId,
          cargo: usuarios.cargo,
        })
        .from(usuarios)
        .where(eq(usuarios.id, userId))
        .limit(1);

      if (row) {
        esAdminDb = row.esAdmin;
        esRrhhDb = row.esRrhh;
        esDirectorDb = row.esDirector;
        esJefeDb = row.esJefe;
        departamentoIdDb = row.departamentoId;
        cargoDb = row.cargo;
      }
    } catch (dbErr) {
      console.error('Error leyendo flags de BD, usando token:', dbErr);
    }

    const sessionUser: SessionUser = {
      id: userId,
      email: session.user.email!,
      nombre: session.user.nombre,
      apellido: session.user.apellido,
      departamentoId: departamentoIdDb ?? session.user.departamentoId,
      departamentoNombre: session.user.departamentoNombre || undefined,
      cargo: (cargoDb ?? session.user.cargo) || undefined,
      
      roles: session.user.roles || [],
      permisos: session.user.permisos || [],
      
      esAdmin: session.user.esAdmin || esAdminDb || false,
      esRrhh: session.user.esRrhh || esRrhhDb || false,
      esDirector: session.user.esDirector || esDirectorDb || false,
      esJefe: session.user.esJefe || esJefeDb || false,
    };
    
    return sessionUser;
  } catch (error) {
    console.error('Error al obtener sesión:', error);
    return null;
  }
}

export function tienePermiso(user: SessionUser | null, permiso: string): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  return user.permisos.includes(permiso);
}

export function tieneAlgunoDeEstosPermisos(user: SessionUser | null, permisos: string[]): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  return permisos.some(permiso => user.permisos.includes(permiso));
}

export function tieneTodosLosPermisos(user: SessionUser | null, permisos: string[]): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  return permisos.every(permiso => user.permisos.includes(permiso));
}

export function tieneRol(user: SessionUser | null, rolCodigo: string): boolean {
  if (!user) return false;
  return user.roles.some(r => r.codigo === rolCodigo);
}

export function tieneNivelMinimo(user: SessionUser | null, nivelRequerido: number): boolean {
  if (!user) return false;
  return user.roles.some(r => r.nivel >= nivelRequerido);
}

export function obtenerNivelMaximo(user: SessionUser | null): number {
  if (!user || !user.roles.length) return -1;
  return Math.max(...user.roles.map(r => r.nivel));
}

export function obtenerRoles(user: SessionUser | null): string[] {
  if (!user) return [];
  return user.roles.map(r => r.codigo);
}

export function estaAutenticado(user: SessionUser | null): boolean {
  return user !== null && user.id > 0;
}

export function mensajePermisoDenegado(permiso: string): string {
  return `No tiene permiso para realizar esta acción. Permiso requerido: ${permiso}`;
}

export function verificarAutorizacion(
  user: SessionUser | null,
  opciones: {
    requiereAutenticacion?: boolean;
    nivelMinimo?: number;
    permisos?: string[];
    roles?: string[];
    todosLosPermisos?: boolean;
  }
): { autorizado: boolean; error?: string } {
  const {
    requiereAutenticacion = true,
    nivelMinimo,
    permisos = [],
    roles = [],
    todosLosPermisos = false
  } = opciones;
  
  if (requiereAutenticacion && !estaAutenticado(user)) {
    return { autorizado: false, error: 'Debe iniciar sesión para acceder a este recurso' };
  }
  
  if (user?.esAdmin) return { autorizado: true };
  
  if (nivelMinimo !== undefined && !tieneNivelMinimo(user, nivelMinimo)) {
    return { autorizado: false, error: `Nivel de acceso insuficiente. Nivel requerido: ${nivelMinimo}` };
  }
  
  if (permisos.length > 0) {
    const tienePermisos = todosLosPermisos
      ? tieneTodosLosPermisos(user, permisos)
      : tieneAlgunoDeEstosPermisos(user, permisos);
    if (!tienePermisos) {
      return { autorizado: false, error: `Permiso denegado. Permisos requeridos: ${permisos.join(', ')}` };
    }
  }
  
  if (roles.length > 0) {
    const tieneRolRequerido = roles.some(rol => tieneRol(user, rol));
    if (!tieneRolRequerido) {
      return { autorizado: false, error: `Rol insuficiente. Roles permitidos: ${roles.join(', ')}` };
    }
  }
  
  return { autorizado: true };
}
