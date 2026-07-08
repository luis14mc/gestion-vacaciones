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
import { obtenerRolesYPermisos } from '@/services/rbac.service';
import { obtenerConfig, asNumber } from '@/lib/config/service';
import { passwordExpirada } from '@/lib/config/password-expiry';

export async function getSession(): Promise<SessionUser | null> {
  try {
    const session = await auth();

    if (!session?.user) {
      return null;
    }

    // Expiración absoluta de sesión (Configuración → Seguridad)
    const absExp = (session as any).absExp as number | null | undefined;
    if (absExp && Date.now() > absExp) {
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
    let debeCambiarPasswordDb = false;

    try {
      const [row] = await db
        .select({
          esAdmin: usuarios.esAdmin,
          esRrhh: usuarios.esRrhh,
          esDirector: usuarios.esDirector,
          esJefe: usuarios.esJefe,
          departamentoId: usuarios.departamentoId,
          cargo: usuarios.cargo,
          metadata: usuarios.metadata,
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
        const metadata = (row.metadata as Record<string, unknown>) || {};
        debeCambiarPasswordDb = metadata.debeCambiarPassword === true;
        if (!debeCambiarPasswordDb) {
          const diasForzar = asNumber(
            await obtenerConfig('seguridad.forzar_cambio_password_dias'),
            0
          );
          debeCambiarPasswordDb = passwordExpirada(metadata, diasForzar);
        }
      }
    } catch (dbErr) {
      console.error('Error leyendo flags de BD, usando token:', dbErr);
    }

    // Fuente única de verdad: roles y permisos se leen FRESCOS desde BD
    // en cada request. El JWT solo guarda claims mínimos (id, flags, etc.);
    // no incluye arrays de roles/permisos para mantener la cookie pequeña.
    let rolesDb: RolUsuario[] = [];
    let permisosDb: string[] = [];
    try {
      const rbac = await obtenerRolesYPermisos(userId);
      if (rbac) {
        rolesDb = rbac.roles as RolUsuario[];
        permisosDb = rbac.permisos;
      }
    } catch (rbacErr) {
      console.error('Error leyendo RBAC de BD:', rbacErr);
    }

    const sessionUser: SessionUser = {
      id: userId,
      email: session.user.email!,
      nombre: session.user.nombre,
      apellido: session.user.apellido,
      departamentoId: departamentoIdDb ?? session.user.departamentoId,
      departamentoNombre: undefined,
      cargo: cargoDb || undefined,

      roles: rolesDb,
      permisos: permisosDb,

      // Flags: BD como fuente de verdad (el token queda como respaldo).
      esAdmin: esAdminDb || session.user.esAdmin || false,
      esRrhh: esRrhhDb || session.user.esRrhh || false,
      esDirector: esDirectorDb || session.user.esDirector || false,
      esJefe: esJefeDb || session.user.esJefe || false,

      debeCambiarPassword: debeCambiarPasswordDb,
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

/**
 * Resuelve el departamento al que un usuario puede acotar un reporte.
 * - Admin y RRHH: alcance organizacional (respeta el filtro solicitado, o todos).
 * - Resto (Jefe/Director con permiso): forzado a SU propio departamento,
 *   ignorando el departamentoId pedido por el cliente. Evita la fuga de
 *   datos de otros departamentos vía parámetros manipulables.
 * Devuelve -1 si el usuario no tiene departamento (resultado vacío seguro).
 */
export function alcanceDepartamento(
  user: SessionUser | null,
  departamentoSolicitado: number | null
): number | null {
  if (!user) return -1;
  if (user.esAdmin || user.esRrhh) return departamentoSolicitado;
  return user.departamentoId ?? -1;
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
