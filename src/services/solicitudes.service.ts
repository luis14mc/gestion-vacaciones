/**
 * ============================================================
 * SOLICITUDES SERVICE - CNI Clean Architecture
 * ============================================================
 * @description Servicio de gestión de solicitudes de vacaciones
 * @version 5.0 - Compatible con Schema CNI
 * ============================================================
 */

import { db } from '@/lib/db';
import { solicitudes, balances, anosLaborales, usuarios } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

// =====================================================
// TIPOS
// =====================================================

export interface CrearSolicitudParams {
  usuarioId: number;
  tipo: 'vacaciones' | 'permiso_salida' | 'licencia_medica' | 'permiso_personal';
  fechaInicio?: string;
  fechaFin?: string;
  diasSolicitados?: number;
  duracionPermiso?: '1-2h' | '2-4h' | 'dia_completo';
  horaSalida?: string;
  horaRegreso?: string;
  motivo?: string;
  comentarioEmpleado?: string;
}

export interface AprobarSolicitudParams {
  solicitudId: number;
  aprobadorId: number;
  comentario?: string;
  tipo: 'jefe' | 'rrhh' | 'ejecutiva';
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Crear nueva solicitud de vacaciones/permiso
 */
export async function crearSolicitud(params: CrearSolicitudParams) {
  const {
    usuarioId,
    tipo,
    fechaInicio,
    fechaFin,
    diasSolicitados,
    duracionPermiso,
    horaSalida,
    horaRegreso,
    motivo,
    comentarioEmpleado,
  } = params;

  return await db.transaction(async (tx) => {
    // 1. Validar días solicitados
    if (tipo === 'vacaciones' && diasSolicitados !== undefined && diasSolicitados <= 0) {
      throw new Error('La cantidad de días solicitados debe ser mayor a 0');
    }

    // 2. Validar fechas
    if (fechaInicio && fechaFin && fechaInicio >= fechaFin) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    // 3. Validar usuario activo
    const usuario = await tx.query.usuarios.findFirst({
      where: eq(usuarios.id, usuarioId),
    });

    if (!usuario || !usuario.activo) {
      throw new Error('Usuario no encontrado o inactivo');
    }

    // 2. Obtener año laboral activo
    const anoLaboral = await tx.query.anosLaborales.findFirst({
      where: eq(anosLaborales.activo, true),
    });

    if (!anoLaboral) {
      throw new Error('No hay año laboral activo');
    }

    // 3. Si es vacación, validar balance
    if (tipo === 'vacaciones' && diasSolicitados) {
      const balance = await tx.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioId),
          eq(balances.anoLaboralId, anoLaboral.id),
          eq(balances.tipoAusencia, 'vacaciones')
        ),
      });

      if (!balance) {
        throw new Error('No se encontró balance de vacaciones para el usuario');
      }

      const disponible = parseFloat(balance.cantidadDisponible);
      if (disponible < diasSolicitados) {
        throw new Error(
          `Balance insuficiente. Disponible: ${disponible} días, solicitado: ${diasSolicitados} días`
        );
      }
    }

    // 4. Generar código único
    const year = new Date().getFullYear();
    const lastSolicitud = await tx.query.solicitudes.findFirst({
      where: sql`${solicitudes.codigo} LIKE ${`SOL-${year}-%`}`,
      orderBy: [desc(solicitudes.id)],
    });

    let nextNumber = 1;
    if (lastSolicitud?.codigo) {
      const match = lastSolicitud.codigo.match(/SOL-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const codigo = `SOL-${year}-${String(nextNumber).padStart(5, '0')}`;

    // 5. Crear solicitud
    const [nuevaSolicitud] = await tx
      .insert(solicitudes)
      .values({
        codigo,
        usuarioId,
        anoLaboralId: anoLaboral.id,
        tipo,
        fechaInicio,
        fechaFin,
        diasSolicitados: diasSolicitados?.toString(),
        duracionPermiso,
        horaSalida,
        horaRegreso,
        motivo,
        comentarioEmpleado,
        estado: 'pendiente_jefe',
        metadata: { test: false },
      })
      .returning();

    // 6. Si es vacación, actualizar balance (cantidad_pendiente)
    if (tipo === 'vacaciones' && diasSolicitados) {
      await tx.execute(sql`
        UPDATE balances
        SET cantidad_pendiente = cantidad_pendiente + ${diasSolicitados},
            updated_at = NOW()
        WHERE usuario_id = ${usuarioId}
          AND ano_laboral_id = ${anoLaboral.id}
          AND tipo_ausencia = 'vacaciones'
      `);
    }

    return nuevaSolicitud;
  });
}

/**
 * Aprobar solicitud por jefe de departamento
 */
export async function aprobarSolicitudJefe(
  solicitudId: number,
  jefeId: number,
  comentario?: string
) {
  return await db.transaction(async (tx) => {
    const solicitud = await tx.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
    });

    if (!solicitud) {
      throw new Error('Solicitud no encontrada');
    }

    if (solicitud.estado !== 'pendiente_jefe') {
      throw new Error(`Estado inválido: ${solicitud.estado}`);
    }

    const [updated] = await tx
      .update(solicitudes)
      .set({
        estado: 'aprobada_jefe',
        estadoAnterior: 'pendiente_jefe',
        aprobadaJefePor: jefeId,
        aprobadaJefeFecha: new Date().toISOString(),
        comentarioJefe: comentario,
        version: sql`${solicitudes.version} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(solicitudes.id, solicitudId),
          eq(solicitudes.version, solicitud.version)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Conflicto de versión (optimistic locking)');
    }

    return updated;
  });
}

/**
 * Aprobar solicitud por RRHH (aprobación final)
 */
export async function aprobarSolicitudRRHH(
  solicitudId: number,
  rrhhId: number,
  comentario?: string
) {
  return await db.transaction(async (tx) => {
    const solicitud = await tx.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
    });

    if (!solicitud) {
      throw new Error('Solicitud no encontrada');
    }

    if (solicitud.estado !== 'aprobada_jefe') {
      throw new Error(`Estado debe ser aprobada_jefe, actual: ${solicitud.estado}`);
    }

    const [updated] = await tx
      .update(solicitudes)
      .set({
        estado: 'aprobada_rrhh',
        estadoAnterior: 'aprobada_jefe',
        aprobadaRrhhPor: rrhhId,
        aprobadaRrhhFecha: new Date().toISOString(),
        comentarioRrhh: comentario,
        version: sql`${solicitudes.version} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(solicitudes.id, solicitudId),
          eq(solicitudes.version, solicitud.version)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Conflicto de versión');
    }

    // Si es vacación, mover días: pendiente → usada
    if (solicitud.tipo === 'vacaciones' && solicitud.diasSolicitados) {
      const dias = parseFloat(solicitud.diasSolicitados);

      await tx.execute(sql`
        UPDATE balances
        SET cantidad_pendiente = cantidad_pendiente - ${dias},
            cantidad_usada = cantidad_usada + ${dias},
            updated_at = NOW()
        WHERE usuario_id = ${solicitud.usuarioId}
          AND ano_laboral_id = ${solicitud.anoLaboralId}
          AND tipo_ausencia = 'vacaciones'
      `);
    }

    return updated;
  });
}

/**
 * Rechazar solicitud
 */
export async function rechazarSolicitud(
  solicitudId: number,
  rechazadorId: number,
  motivoRechazo: string
) {
  return await db.transaction(async (tx) => {
    const solicitud = await tx.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
    });

    if (!solicitud) {
      throw new Error('Solicitud no encontrada');
    }

    if (['aprobada_jefe', 'aprobada_rrhh', 'aprobada_ejecutiva', 'finalizada'].includes(solicitud.estado)) {
      throw new Error('No se puede rechazar una solicitud ya aprobada');
    }

    const nuevoEstado =
      solicitud.estado === 'pendiente_jefe' ? 'rechazada_jefe' : 'rechazada_rrhh';

    const [updated] = await tx
      .update(solicitudes)
      .set({
        estado: nuevoEstado,
        estadoAnterior: solicitud.estado,
        rechazadaPor: rechazadorId,
        rechazadaFecha: new Date().toISOString(),
        motivoRechazo,
        version: sql`${solicitudes.version} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(solicitudes.id, solicitudId))
      .returning();

    // Devolver días al balance si aplica
    if (solicitud.tipo === 'vacaciones' && solicitud.diasSolicitados) {
      const dias = parseFloat(solicitud.diasSolicitados);

      await tx.execute(sql`
        UPDATE balances
        SET cantidad_pendiente = cantidad_pendiente - ${dias},
            updated_at = NOW()
        WHERE usuario_id = ${solicitud.usuarioId}
          AND ano_laboral_id = ${solicitud.anoLaboralId}
          AND tipo_ausencia = 'vacaciones'
      `);
    }

    return updated;
  });
}

/**
 * Obtener solicitud por ID
 */
export async function obtenerSolicitudPorId(id: number) {
  return await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, id),
    with: {
      usuario: true,
      anoLaboral: true,
    },
  });
}

/**
 * Listar solicitudes con filtros
 */
export async function listarSolicitudes(filtros: {
  usuarioId?: number;
  estado?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
}) {
  const { usuarioId, estado, tipo, limit = 50, offset = 0 } = filtros;

  const conditions = [];

  if (usuarioId) {
    conditions.push(eq(solicitudes.usuarioId, usuarioId));
  }

  if (estado) {
    conditions.push(eq(solicitudes.estado, estado as any));
  }

  if (tipo) {
    conditions.push(eq(solicitudes.tipo, tipo as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.query.solicitudes.findMany({
    where,
    orderBy: [desc(solicitudes.createdAt)],
    limit,
    offset,
    with: {
      usuario: {
        columns: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      },
    },
  });
}
