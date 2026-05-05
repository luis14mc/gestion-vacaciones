/**
 * ============================================================
 * RBAC SERVICE - CNI Clean Architecture
 * ============================================================
 * @description Servicio de control de acceso basado en roles
 * @version 5.0 - Compatible con Schema CNI
 * ============================================================
 */

import { db } from '@/lib/db';
import { usuarios, usuariosRoles, roles, rolesPermisos, permisos } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// =====================================================
// TIPOS
// =====================================================

export interface UsuarioConRoles {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  roles: string[];
  permisos: string[];
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Verificar si usuario tiene un permiso específico
 */
export async function usuarioTienePermiso(
  usuarioId: number,
  codigoPermiso: string
): Promise<boolean> {
  // Obtener roles del usuario con permisos anidados
  const rolesUsuario = await db.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: {
      rol: {
        with: {
          rolesPermisos: {
            with: {
              permiso: true,
            },
          },
        },
      },
    },
  });

  // Verificar si alguno de los roles tiene el permiso
  for (const rolAsignado of rolesUsuario) {
    const tienePermiso = rolAsignado.rol.rolesPermisos.some(
      (rp: any) => rp.permiso.codigo === codigoPermiso
    );
    if (tienePermiso) {
      return true;
    }
  }

  return false;
}

/**
 * Verificar si usuario tiene un rol específico
 */
export async function usuarioTieneRol(
  usuarioId: number,
  codigoRol: string
): Promise<boolean> {
  const asignaciones = await db.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: {
      rol: true,
    },
  });

  return asignaciones.some((a) => a.rol.codigo === codigoRol);
}

/**
 * Obtener todos los permisos de un usuario
 */
export async function obtenerPermisosUsuario(usuarioId: number): Promise<string[]> {
  const rolesUsuario = await db.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: {
      rol: {
        with: {
          rolesPermisos: {
            with: {
              permiso: true,
            },
          },
        },
      },
    },
  });

  const permisosSet = new Set<string>();

  for (const rolAsignado of rolesUsuario) {
    for (const rp of rolAsignado.rol.rolesPermisos) {
      permisosSet.add((rp as any).permiso.codigo);
    }
  }

  return Array.from(permisosSet);
}

/**
 * Obtener roles y permisos de un usuario
 */
export async function obtenerRolesYPermisos(usuarioId: number) {
  const asignaciones = await db.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: {
      rol: {
        with: {
          rolesPermisos: {
            with: {
              permiso: true,
            },
          },
        },
      },
    },
  });

  if (asignaciones.length === 0) {
    return null;
  }

  const rolesUnicos = asignaciones.map((a) => ({
    codigo: a.rol.codigo,
    nombre: a.rol.nombre,
    nivel: a.rol.nivel,
  }));
  const permisosSet = new Set<string>();

  for (const a of asignaciones) {
    for (const rp of a.rol.rolesPermisos) {
      permisosSet.add((rp as any).permiso.codigo);
    }
  }

  // Obtener info básica del usuario
  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, usuarioId),
  });

  return {
    usuario: usuario
      ? {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
        }
      : null,
    roles: rolesUnicos,
    permisos: Array.from(permisosSet),
  };
}

/**
 * Verificar múltiples permisos (requiere TODOS)
 */
export async function usuarioTienePermisosMultiples(
  usuarioId: number,
  codigosPermisos: string[]
): Promise<boolean> {
  const permisosUsuario = await obtenerPermisosUsuario(usuarioId);

  return codigosPermisos.every((codigo) => permisosUsuario.includes(codigo));
}

/**
 * Verificar si tiene al menos uno de los permisos (OR)
 */
export async function usuarioTieneAlgunPermiso(
  usuarioId: number,
  codigosPermisos: string[]
): Promise<boolean> {
  const permisosUsuario = await obtenerPermisosUsuario(usuarioId);

  return codigosPermisos.some((codigo) => permisosUsuario.includes(codigo));
}

/**
 * Asignar permiso a rol
 */
export async function asignarPermisoARol(rolId: number, permisoId: number) {
  // Verificar que no existe ya
  const existente = await db.query.rolesPermisos.findFirst({
    where: and(
      eq(rolesPermisos.rolId, rolId),
      eq(rolesPermisos.permisoId, permisoId)
    ),
  });

  if (existente) {
    throw new Error('El rol ya tiene este permiso asignado');
  }

  const [asignacion] = await db
    .insert(rolesPermisos)
    .values({
      rolId,
      permisoId,
    })
    .returning();

  return asignacion;
}

/**
 * Remover permiso de rol
 */
export async function removerPermisoDRol(rolId: number, permisoId: number) {
  await db
    .delete(rolesPermisos)
    .where(
      and(
        eq(rolesPermisos.rolId, rolId),
        eq(rolesPermisos.permisoId, permisoId)
      )
    );

  return true;
}

/**
 * Crear nuevo rol
 */
export async function crearRol(codigo: string, nombre: string, descripcion?: string) {
  const [nuevoRol] = await db
    .insert(roles)
    .values({
      codigo,
      nombre,
      descripcion,
      activo: true,
    })
    .returning();

  return nuevoRol;
}

/**
 * Crear nuevo permiso
 */
export async function crearPermiso(
  codigo: string,
  descripcion?: string,
  modulo?: string,
  recurso?: string,
  accion?: string
) {
  const [nuevoPermiso] = await db
    .insert(permisos)
    .values({
      codigo,
      descripcion,
      modulo: modulo || codigo.split('.')[0] || 'general',
      recurso: recurso || codigo.split('.')[1] || 'general',
      accion: accion || codigo.split('.')[2] || 'general',
    })
    .returning();

  return nuevoPermiso;
}

/**
 * Listar todos los roles
 */
export async function listarRoles() {
  return await db.query.roles.findMany({
    where: eq(roles.activo, true),
    with: {
      rolesPermisos: {
        with: {
          permiso: true,
        },
      },
    },
  });
}

/**
 * Listar todos los permisos
 */
export async function listarPermisos() {
  return await db.query.permisos.findMany({
    orderBy: (permisos, { asc }) => [asc(permisos.modulo), asc(permisos.codigo)],
  });
}

/**
 * Verificar si usuario es administrador
 */
export async function esAdministrador(usuarioId: number): Promise<boolean> {
  return await usuarioTieneRol(usuarioId, 'ADMIN');
}

/**
 * Verificar si usuario es RRHH
 */
export async function esRRHH(usuarioId: number): Promise<boolean> {
  return await usuarioTieneRol(usuarioId, 'RRHH');
}

/**
 * Verificar si usuario es jefe de departamento
 */
export async function esJefeDepartamento(usuarioId: number): Promise<boolean> {
  return await usuarioTieneRol(usuarioId, 'JEFE');
}
