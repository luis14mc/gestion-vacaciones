/**
 * ============================================================
 * USUARIOS SERVICE - CNI Clean Architecture
 * ============================================================
 * @description Servicio de gestión de usuarios
 * @version 5.0 - Compatible con Schema CNI
 * ============================================================
 */

import { db } from '@/lib/db';
import { usuarios, usuariosRoles, roles } from '@/lib/db/schema';
import { eq, and, or, sql, ilike } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// =====================================================
// TIPOS
// =====================================================

export interface CrearUsuarioParams {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  departamentoId?: number;
  cargo?: string;
  fechaIngreso?: string;
  activo?: boolean;
  esAdmin?: boolean;
  esRrhh?: boolean;
  esDirector?: boolean;
  esJefe?: boolean;
  numeroEmpleado?: string;
  telefono?: string;
  direccion?: string;
  jefeSuperiorId?: number;
}

export interface ActualizarUsuarioParams {
  nombre?: string;
  apellido?: string;
  departamentoId?: number;
  cargo?: string;
  fechaIngreso?: string;
  activo?: boolean;
  numeroEmpleado?: string;
  telefono?: string;
  direccion?: string;
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Crear nuevo usuario
 */
export async function crearUsuario(params: CrearUsuarioParams) {
  const {
    email,
    password,
    nombre,
    apellido,
    departamentoId,
    cargo,
    fechaIngreso,
    activo = true,
    esAdmin = false,
    esRrhh = false,
    esDirector = false,
    esJefe = false,
    numeroEmpleado,
    telefono,
    direccion,
    jefeSuperiorId,
  } = params;

  return await db.transaction(async (tx) => {
    // Validar email único
    const existente = await tx.query.usuarios.findFirst({
      where: eq(usuarios.email, email.toLowerCase()),
    });

    if (existente) {
      throw new Error('El email ya está registrado');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const [nuevoUsuario] = await tx
      .insert(usuarios)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        nombre,
        apellido,
        departamentoId,
        cargo,
        fechaIngreso,
        activo,
        esAdmin,
        esRrhh,
        esDirector,
        esJefe,
        numeroEmpleado,
        telefono,
        direccion,
        jefeSuperiorId,
        metadata: {},
      })
      .returning();

    // Asignar roles si se especificaron
    const rolesAAsignar = [];
    if (esAdmin) rolesAAsignar.push('ADMIN');
    if (esRrhh) rolesAAsignar.push('RRHH');
    if (esDirector) rolesAAsignar.push('DIRECTOR');
    if (esJefe) rolesAAsignar.push('JEFE');
    
    // Si no se asignó ningún rol, asignar EMPLEADO por defecto
    if (rolesAAsignar.length === 0) {
      rolesAAsignar.push('EMPLEADO');
    }

    // Buscar los IDs de los roles y asignarlos
    for (const nombreRol of rolesAAsignar) {
      const rol = await tx.query.roles.findFirst({
        where: eq(roles.codigo, nombreRol),
      });

      if (rol) {
        await tx.insert(usuariosRoles).values({
          usuarioId: nuevoUsuario.id,
          rolId: rol.id,
          fechaAsignacion: new Date().toISOString(),
          activo: true,
        });
      }
    }

    return nuevoUsuario;
  });
}

/**
 * Obtener usuario por ID
 */
export async function obtenerUsuarioPorId(id: number) {
  return await db.query.usuarios.findFirst({
    where: eq(usuarios.id, id),
    with: {
      usuariosRoles: {
        with: {
          rol: true,
        },
      },
    },
  });
}

/**
 * Obtener usuario por email
 */
export async function obtenerUsuarioPorEmail(email: string) {
  return await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email.toLowerCase()),
    with: {
      usuariosRoles: {
        with: {
          rol: true,
        },
      },
    },
  });
}

/**
 * Actualizar usuario
 */
export async function actualizarUsuario(id: number, params: ActualizarUsuarioParams) {
  const updateData: any = {
    updatedAt: new Date().toISOString(),
  };

  if (params.nombre !== undefined) updateData.nombre = params.nombre;
  if (params.apellido !== undefined) updateData.apellido = params.apellido;
  if (params.departamentoId !== undefined) updateData.departamentoId = params.departamentoId;
  if (params.cargo !== undefined) updateData.cargo = params.cargo;
  if (params.fechaIngreso !== undefined) updateData.fechaIngreso = params.fechaIngreso;
  if (params.activo !== undefined) updateData.activo = params.activo;

  const [updated] = await db
    .update(usuarios)
    .set(updateData)
    .where(eq(usuarios.id, id))
    .returning();

  return updated;
}

/**
 * Cambiar password
 */
export async function cambiarPassword(id: number, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const [updated] = await db
    .update(usuarios)
    .set({
      passwordHash,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usuarios.id, id))
    .returning();

  return updated;
}

/**
 * Verificar password
 */
export async function verificarPassword(email: string, password: string) {
  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email.toLowerCase()),
  });

  if (!usuario) {
    return null;
  }

  const isValid = await bcrypt.compare(password, usuario.passwordHash);

  return isValid ? usuario : null;
}

/**
 * Asignar rol a usuario
 */
export async function asignarRol(usuarioId: number, rolId: number) {
  // Verificar que no existe ya
  const existente = await db.query.usuariosRoles.findFirst({
    where: and(
      eq(usuariosRoles.usuarioId, usuarioId),
      eq(usuariosRoles.rolId, rolId)
    ),
  });

  if (existente) {
    throw new Error('El usuario ya tiene este rol asignado');
  }

  const [asignacion] = await db
    .insert(usuariosRoles)
    .values({
      usuarioId,
      rolId,
    })
    .returning();

  return asignacion;
}

/**
 * Remover rol de usuario
 */
export async function removerRol(usuarioId: number, rolId: number) {
  await db
    .delete(usuariosRoles)
    .where(
      and(
        eq(usuariosRoles.usuarioId, usuarioId),
        eq(usuariosRoles.rolId, rolId)
      )
    );

  return true;
}

/**
 * Listar usuarios con filtros
 */
export async function listarUsuarios(filtros: {
  activo?: boolean;
  departamentoId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { activo, departamentoId, search, limit = 50, offset = 0 } = filtros;

  const conditions = [];

  if (activo !== undefined) {
    conditions.push(eq(usuarios.activo, activo));
  }

  if (departamentoId) {
    conditions.push(eq(usuarios.departamentoId, departamentoId));
  }

  if (search) {
    conditions.push(
      or(
        ilike(usuarios.nombre, `%${search}%`),
        ilike(usuarios.apellido, `%${search}%`),
        ilike(usuarios.email, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.query.usuarios.findMany({
    where,
    limit,
    offset,
    with: {
      usuariosRoles: {
        with: {
          rol: true,
        },
      },
    },
  });
}

/**
 * Obtener roles de un usuario
 */
export async function obtenerRolesUsuario(usuarioId: number) {
  const asignaciones = await db.query.usuariosRoles.findMany({
    where: eq(usuariosRoles.usuarioId, usuarioId),
    with: {
      rol: true,
    },
  });

  return asignaciones.map((a) => a.rol);
}

/**
 * Desactivar usuario (soft delete)
 */
export async function desactivarUsuario(id: number) {
  return await actualizarUsuario(id, { activo: false });
}

/**
 * Activar usuario
 */
export async function activarUsuario(id: number) {
  return await actualizarUsuario(id, { activo: true });
}
