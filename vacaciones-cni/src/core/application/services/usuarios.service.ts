/**
 * 👤 SERVICIO DE USUARIOS
 * Lógica de negocio para gestión de usuarios
 * - Creación con roles y balances iniciales
 * - Actualización con validaciones
 * - Soft delete (desactivación)
 * - Gestión de roles y permisos
 */

import { db } from '@/core/infrastructure/database';
import { usuarios, roles, rolesUsuarios, balancesAusencias, tiposAusencias } from '@/core/infrastructure/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// ==========================================
// INTERFACES
// ==========================================

export interface NuevoUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  cedula: string;
  departamentoId: number;
  fechaIngreso: Date;
  cargo?: string;
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
  // TODO: Implementar en tarea 3.2
  throw new Error('No implementado');
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
  // TODO: Implementar en tarea 3.3
  throw new Error('No implementado');
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
