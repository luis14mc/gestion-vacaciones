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
 * ============================================================
 * SINCRONIZACIÓN FLAGS ↔ RBAC (Fuente única de verdad)
 * ============================================================
 * Mapeo entre los flags booleanos legacy de la tabla `usuarios`
 * y los roles del sistema RBAC. Mientras coexistan ambos modelos,
 * esta es la ÚNICA función autorizada para escribir en
 * `usuarios_roles` a partir de flags, evitando la divergencia
 * descrita en la auditoría (un flag activo sin su rol, o viceversa).
 */
export const FLAG_A_ROL: Record<
  'esAdmin' | 'esRrhh' | 'esDirector' | 'esJefe' | 'esSecretarioGeneral',
  string
> = {
  esAdmin: 'ADMIN',
  esRrhh: 'RRHH',
  esDirector: 'DIRECTOR',
  esJefe: 'JEFE',
  esSecretarioGeneral: 'SECRETARIO_GENERAL',
};

// Roles gestionados por los flags. syncUserRoles SOLO añade/quita estos;
// nunca toca roles personalizados asignados directamente vía RBAC.
const ROLES_GESTIONADOS = Object.values(FLAG_A_ROL);

export interface FlagsRol {
  esAdmin?: boolean;
  esRrhh?: boolean;
  esDirector?: boolean;
  esJefe?: boolean;
  esSecretarioGeneral?: boolean;
}

/**
 * Sincroniza las asignaciones en `usuarios_roles` con los flags dados.
 * - Añade los roles gestionados cuyos flags están activos.
 * - Quita los roles gestionados cuyos flags están inactivos.
 * - Garantiza el rol base EMPLEADO siempre presente.
 * - No altera roles fuera del set gestionado.
 *
 * Acepta un `tx` opcional para participar en una transacción mayor.
 */
export async function syncUserRoles(
  usuarioId: number,
  flags: FlagsRol,
  tx: any = db
): Promise<void> {
  const deseados = new Set<string>();
  if (flags.esAdmin) deseados.add('ADMIN');
  if (flags.esRrhh) deseados.add('RRHH');
  if (flags.esDirector) deseados.add('DIRECTOR');
  if (flags.esJefe) deseados.add('JEFE');
  if (flags.esSecretarioGeneral) deseados.add('SECRETARIO_GENERAL');

  // Cargar filas de roles relevantes (gestionados + EMPLEADO base)
  const codigosRelevantes = [...ROLES_GESTIONADOS, 'EMPLEADO'];
  const rolesDb = await tx.query.roles.findMany({
    where: inArray(roles.codigo, codigosRelevantes),
  });
  const porCodigo = new Map<string, { id: number }>(
    rolesDb.map((r: any) => [r.codigo, r])
  );

  // Asignaciones actuales del usuario
  const actuales = await tx.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
  });
  const idsActuales = new Set<number>(actuales.map((a: any) => a.rolId));

  // 1. Añadir roles deseados ausentes
  for (const codigo of deseados) {
    const rol = porCodigo.get(codigo);
    if (rol && !idsActuales.has(rol.id)) {
      await tx.insert(usuariosRoles).values({ usuarioId, rolId: rol.id, activo: true });
      idsActuales.add(rol.id);
    }
  }

  // 2. Quitar roles gestionados que ya no se desean
  const idsAQuitar = ROLES_GESTIONADOS
    .filter((c) => !deseados.has(c))
    .map((c) => porCodigo.get(c)?.id)
    .filter((id): id is number => typeof id === 'number' && idsActuales.has(id));

  if (idsAQuitar.length > 0) {
    await tx
      .delete(usuariosRoles)
      .where(
        and(
          eq(usuariosRoles.usuarioId, usuarioId),
          inArray(usuariosRoles.rolId, idsAQuitar)
        )
      );
    idsAQuitar.forEach((id) => idsActuales.delete(id));
  }

  // 3. Garantizar rol base EMPLEADO
  const empleado = porCodigo.get('EMPLEADO');
  if (empleado && !idsActuales.has(empleado.id)) {
    await tx.insert(usuariosRoles).values({ usuarioId, rolId: empleado.id, activo: true });
  }
}

/**
 * Sincroniza los roles de un usuario leyendo sus flags actuales desde BD.
 * Útil cuando un flag (p.ej. esJefe) se modifica fuera del flujo de
 * /api/usuarios (como al asignar jefe de departamento desde
 * /api/departamentos), para no reintroducir la divergencia flag↔RBAC.
 */
export async function syncUserRolesDesdeBD(usuarioId: number, tx: any = db): Promise<void> {
  const u = await tx.query.usuarios.findFirst({ where: eq(usuarios.id, usuarioId) });
  if (!u) return;
  await syncUserRoles(
    usuarioId,
    {
      esAdmin: u.esAdmin,
      esRrhh: u.esRrhh,
      esDirector: u.esDirector,
      esJefe: u.esJefe,
      esSecretarioGeneral: u.esSecretarioGeneral,
    },
    tx
  );
}

/**
 * Sincroniza flags booleanos de `usuarios` a partir de roles RBAC asignados.
 * Complemento inverso de syncUserRoles: cuando se asigna/quita un rol vía
 * /api/usuarios/roles, los flags deben reflejar la misma verdad.
 */
export async function syncFlagsFromRoles(usuarioId: number, tx: any = db): Promise<void> {
  const actuales = await tx.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: { rol: true },
  });

  const codigos = new Set(actuales.map((a: { rol: { codigo: string } }) => a.rol.codigo));
  const flags: FlagsRol = {
    esAdmin: codigos.has('ADMIN'),
    esRrhh: codigos.has('RRHH'),
    esDirector: codigos.has('DIRECTOR'),
    esJefe: codigos.has('JEFE'),
    esSecretarioGeneral: codigos.has('SECRETARIO_GENERAL'),
  };

  await tx
    .update(usuarios)
    .set({
      esAdmin: flags.esAdmin ?? false,
      esRrhh: flags.esRrhh ?? false,
      esDirector: flags.esDirector ?? false,
      esJefe: flags.esJefe ?? false,
      esSecretarioGeneral: flags.esSecretarioGeneral ?? false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usuarios.id, usuarioId));
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
