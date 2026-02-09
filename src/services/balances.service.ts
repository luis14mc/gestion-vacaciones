/**
 * ============================================================
 * BALANCES SERVICE - CNI Clean Architecture
 * ============================================================
 * @description Servicio de gestión de balances de ausencias
 * @version 5.0 - Compatible con Schema CNI
 * ============================================================
 */

import { db } from '@/lib/db';
import { balances, anosLaborales, usuarios } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// =====================================================
// TIPOS
// =====================================================

export interface CrearBalanceParams {
  usuarioId: number;
  anoLaboralId: number;
  tipoAusencia: 'vacaciones' | 'licencia_medica' | 'permiso_personal';
  cantidadInicial: number;
}

export interface ActualizarBalanceParams {
  balanceId: number;
  cantidadAcumulada?: number;
  cantidadUsada?: number;
  cantidadPendiente?: number;
  bloqueado?: boolean;
  motivoBloqueo?: string;
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Crear balance para un usuario
 */
export async function crearBalance(params: CrearBalanceParams) {
  const { usuarioId, anoLaboralId, tipoAusencia, cantidadInicial } = params;

  // Verificar que no existe ya
  const existente = await db.query.balances.findFirst({
    where: and(
      eq(balances.usuarioId, usuarioId),
      eq(balances.anoLaboralId, anoLaboralId),
      eq(balances.tipoAusencia, tipoAusencia)
    ),
  });

  if (existente) {
    throw new Error('Ya existe un balance para este usuario/año/tipo');
  }

  const [nuevoBalance] = await db
    .insert(balances)
    .values({
      usuarioId,
      anoLaboralId,
      tipoAusencia,
      cantidadInicial: cantidadInicial.toString(),
      cantidadAcumulada: '0',
      cantidadUsada: '0',
      cantidadPendiente: '0',
      cantidadDisponible: cantidadInicial.toString(),
      bloqueado: false,
      metadata: {},
    })
    .returning();

  return nuevoBalance;
}

/**
 * Obtener balance de un usuario
 */
export async function obtenerBalance(
  usuarioId: number,
  tipoAusencia: 'vacaciones' | 'licencia_medica' | 'permiso_personal' = 'vacaciones'
) {
  const anoLaboral = await db.query.anosLaborales.findFirst({
    where: eq(anosLaborales.activo, true),
  });

  if (!anoLaboral) {
    throw new Error('No hay año laboral activo');
  }

  return await db.query.balances.findFirst({
    where: and(
      eq(balances.usuarioId, usuarioId),
      eq(balances.anoLaboralId, anoLaboral.id),
      eq(balances.tipoAusencia, tipoAusencia)
    ),
  });
}

/**
 * Actualizar balance manualmente (RRHH)
 */
export async function actualizarBalance(params: ActualizarBalanceParams) {
  const {
    balanceId,
    cantidadAcumulada,
    cantidadUsada,
    cantidadPendiente,
    bloqueado,
    motivoBloqueo,
  } = params;

  const updateData: any = {
    updatedAt: new Date().toISOString(),
  };

  if (cantidadAcumulada !== undefined) {
    updateData.cantidadAcumulada = cantidadAcumulada.toString();
  }
  if (cantidadUsada !== undefined) {
    updateData.cantidadUsada = cantidadUsada.toString();
  }
  if (cantidadPendiente !== undefined) {
    updateData.cantidadPendiente = cantidadPendiente.toString();
  }
  if (bloqueado !== undefined) {
    updateData.bloqueado = bloqueado;
  }
  if (motivoBloqueo !== undefined) {
    updateData.motivoBloqueo = motivoBloqueo;
  }

  const [updated] = await db
    .update(balances)
    .set(updateData)
    .where(eq(balances.id, balanceId))
    .returning();

  return updated;
}

/**
 * Listar balances de un usuario
 */
export async function listarBalancesUsuario(usuarioId: number) {
  const anoLaboral = await db.query.anosLaborales.findFirst({
    where: eq(anosLaborales.activo, true),
  });

  if (!anoLaboral) {
    return [];
  }

  return await db.query.balances.findMany({
    where: and(
      eq(balances.usuarioId, usuarioId),
      eq(balances.anoLaboralId, anoLaboral.id)
    ),
  });
}

/**
 * Crear balances masivos para todos los usuarios
 */
export async function crearBalancesMasivos(
  tipoAusencia: 'vacaciones' | 'licencia_medica' | 'permiso_personal',
  cantidadInicial: number
) {
  const anoLaboral = await db.query.anosLaborales.findFirst({
    where: eq(anosLaborales.activo, true),
  });

  if (!anoLaboral) {
    throw new Error('No hay año laboral activo');
  }

  const usuariosActivos = await db.query.usuarios.findMany({
    where: eq(usuarios.activo, true),
  });

  const resultados = [];

  for (const usuario of usuariosActivos) {
    try {
      const balance = await crearBalance({
        usuarioId: usuario.id,
        anoLaboralId: anoLaboral.id,
        tipoAusencia,
        cantidadInicial,
      });
      resultados.push({ success: true, usuarioId: usuario.id, balance });
    } catch (error) {
      resultados.push({
        success: false,
        usuarioId: usuario.id,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return resultados;
}

/**
 * Resetear balance a estado inicial (para tests)
 */
export async function resetearBalance(balanceId: number) {
  const [updated] = await db
    .update(balances)
    .set({
      cantidadUsada: '0',
      cantidadPendiente: '0',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(balances.id, balanceId))
    .returning();

  return updated;
}
