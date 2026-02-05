/**
 * 👤 SERVICIO DE USUARIOS
 * Lógica de negocio para gestión de usuarios
 * - Creación con roles y balances iniciales
 * - Actualización con validaciones
 * - Soft delete (desactivación)
 * - Gestión de roles y permisos
 */

import { db } from '@/core/infrastructure/database';
import { 
  usuarios, 
  roles, 
  usuariosRoles, 
  balancesAusencias,
  departamentos
} from '@/core/infrastructure/database/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// ==========================================
// INTERFACES
// ==========================================

export interface NuevoUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  departamentoId: number;
  fechaIngreso: Date;
  cargo?: string;
  cedula?: string; // Se guarda en metadata
}

export interface ActualizarUsuario {
  nombre?: string;
  apellido?: string;
  departamentoId?: number;
  cargo?: string;
  activo?: boolean;
}

export interface AsignarRol {
  usuarioId: number;
  rolId: number;
  departamentoId?: number;
  asignadoPor: number;
}

// ==========================================
// FUNCIONES DEL SERVICIO
// ==========================================

/**
 * 📝 CREAR USUARIO
 * Crea un nuevo usuario con:
 * - Hash de contraseña
 * - Rol EMPLEADO por defecto
 * - Balances iniciales
 * - Validaciones completas
 */
export async function crearUsuario(data: NuevoUsuario) {
  console.log(`📝 Creando usuario: ${data.email}`);

  // ========== VALIDACIONES ==========

  // 1. Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Formato de email inválido');
  }

  // 2. Validar longitud de contraseña
  if (data.password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  // 3. Verificar que el email no existe
  const usuarioExistente = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, data.email)
  });

  if (usuarioExistente) {
    throw new Error(`Ya existe un usuario con el email: ${data.email}`);
  }

  // 4. Verificar que el departamento existe
  const departamento = await db.query.departamentos.findFirst({
    where: sql`id = ${data.departamentoId}`
  });

  if (!departamento) {
    throw new Error(`Departamento con ID ${data.departamentoId} no encontrado`);
  }

  console.log(`✅ Validaciones completadas - Departamento: ${departamento.nombre}`);

  // ========== TRANSACCIÓN ==========
  
  return await db.transaction(async (tx) => {
    // 1. Hash de contraseña
    const SALT_ROUNDS = 10;
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    console.log(`🔒 Contraseña hasheada con ${SALT_ROUNDS} rounds`);

    // 2. Crear usuario
    const [nuevoUsuario] = await tx.insert(usuarios).values({
      email: data.email,
      password: passwordHash,
      nombre: data.nombre,
      apellido: data.apellido,
      departamentoId: data.departamentoId,
      fechaIngreso: data.fechaIngreso.toISOString().split('T')[0], // Convertir a string YYYY-MM-DD
      cargo: data.cargo,
      metadata: data.cedula ? { cedula: data.cedula } : {},
      activo: true,
      // Campos legacy en false por defecto
      esJefe: false,
      esRrhh: false,
      esAdmin: false
    }).returning();

    console.log(`✅ Usuario creado con ID: ${nuevoUsuario.id}`);

    // 3. Asignar rol EMPLEADO por defecto
    const rolEmpleado = await tx.query.roles.findFirst({
      where: eq(roles.nombre, 'EMPLEADO')
    });

    if (!rolEmpleado) {
      throw new Error('Error: Rol EMPLEADO no encontrado en la base de datos');
    }

    await tx.insert(usuariosRoles).values({
      usuarioId: nuevoUsuario.id,
      rolId: rolEmpleado.id,
      departamentoId: data.departamentoId,
      activo: true
    });

    console.log(`🎭 Rol EMPLEADO asignado al usuario`);

    // 4. Crear balances iniciales para todos los tipos de ausencia activos
    const tiposAusenciasActivos = await tx.query.tiposAusenciaConfig.findMany({
      where: sql`activo = true`
    });

    if (tiposAusenciasActivos.length > 0) {
      const anioActual = new Date().getFullYear();
      
      const balancesValues = tiposAusenciasActivos.map(tipo => ({
        usuarioId: nuevoUsuario.id,
        tipoAusenciaId: tipo.id,
        anio: anioActual,
        cantidadAsignada: '0', // Balance inicial en 0, se asigna manualmente después
        cantidadUtilizada: '0',
        cantidadPendiente: '0',
        estado: 'activo' as const
      }));

      await tx.insert(balancesAusencias).values(balancesValues);

      console.log(`📊 ${balancesValues.length} balances iniciales creados para el año ${anioActual}`);
    }

    // 5. Obtener usuario completo con relaciones
    const usuarioCompleto = await tx.query.usuarios.findFirst({
      where: eq(usuarios.id, nuevoUsuario.id),
      with: {
        departamento: true,
        usuariosRoles: {
          with: {
            rol: true
          }
        }
      }
    });

    console.log(`✅ Usuario creado exitosamente: ${usuarioCompleto?.email}`);
    
    return usuarioCompleto;
  });
}

/**
 * ✏️ ACTUALIZAR USUARIO
 * Actualiza datos del usuario con:
 * - Control optimista (version)
 * - Validación de email único
 * - Solo campos proporcionados
 */
export async function actualizarUsuario(
  usuarioId: number,
  data: ActualizarUsuario,
  actualizadoPor: number
) {
  console.log(`✏️ Actualizando usuario ID: ${usuarioId}`);

  // ========== VALIDACIONES ==========

  // 1. Verificar que el usuario existe
  const usuarioExistente = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, usuarioId)
  });

  if (!usuarioExistente) {
    throw new Error(`Usuario con ID ${usuarioId} no encontrado`);
  }

  // 2. Si se cambia el departamento, verificar que existe
  if (data.departamentoId) {
    const departamento = await db.query.departamentos.findFirst({
      where: sql`id = ${data.departamentoId}`
    });

    if (!departamento) {
      throw new Error(`Departamento con ID ${data.departamentoId} no encontrado`);
    }
  }

  console.log(`✅ Validaciones completadas`);

  // ========== ACTUALIZACIÓN ==========

  // Preparar objeto con campos a actualizar
  const camposActualizar: any = {
    version: usuarioExistente.version + 1,
    updatedAt: new Date()
  };

  // Solo agregar campos que se proporcionaron
  if (data.nombre !== undefined) camposActualizar.nombre = data.nombre;
  if (data.apellido !== undefined) camposActualizar.apellido = data.apellido;
  if (data.departamentoId !== undefined) camposActualizar.departamentoId = data.departamentoId;
  if (data.cargo !== undefined) camposActualizar.cargo = data.cargo;
  if (data.activo !== undefined) camposActualizar.activo = data.activo;

  // Actualizar usuario con control optimista
  const [usuarioActualizado] = await db
    .update(usuarios)
    .set(camposActualizar)
    .where(eq(usuarios.id, usuarioId))
    .returning();

  if (!usuarioActualizado) {
    throw new Error('Error al actualizar usuario - posible conflicto de versión');
  }

  console.log(`✅ Usuario actualizado - Nueva versión: ${usuarioActualizado.version}`);

  // Obtener usuario completo con relaciones
  const usuarioCompleto = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, usuarioId),
    with: {
      departamento: true,
      usuariosRoles: {
        with: {
          rol: true
        }
      }
    }
  });

  return usuarioCompleto;
}

/**
 * 🗑️ DESACTIVAR USUARIO (SOFT DELETE)
 * Desactiva usuario sin eliminar:
 * - activo = false
 * - Desactivar roles
 * - Mantener historial
 */
export async function desactivarUsuario(
  usuarioId: number,
  desactivadoPor: number,
  motivo?: string
) {
  // TODO: Implementar en tarea 3.4
  throw new Error('No implementado');
}

/**
 * 🎭 ASIGNAR ROL CON VALIDACIÓN
 * Asigna rol a usuario con:
 * - Validación de permisos del ejecutor
 * - Verificación de duplicados
 * - Departamento opcional
 */
export async function asignarRolConValidacion(data: AsignarRol) {
  // TODO: Implementar en tarea 3.5
  throw new Error('No implementado');
}
