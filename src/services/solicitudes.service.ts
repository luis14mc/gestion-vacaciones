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
import { obtenerConfigs, asBool, asNumber } from '@/lib/config/service';

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
  esDirector?: boolean;
  documentosAdjuntos?: any[];
}

export interface AprobarSolicitudParams {
  solicitudId: number;
  aprobadorId: number;
  comentario?: string;
  tipo: 'jefe' | 'rrhh';
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
    esDirector = false,
    documentosAdjuntos = [],
  } = params;

  return await db.transaction(async (tx) => {
    const diasParaBalance = tipo === 'permiso_salida' && duracionPermiso === 'dia_completo'
      ? 1
      : Number(diasSolicitados || 0);
    const descuentaBalance = tipo === 'vacaciones' || (tipo === 'permiso_salida' && duracionPermiso === 'dia_completo');
    const diasParaSolicitud = tipo === 'permiso_salida' ? diasParaBalance : Number(diasSolicitados || 0);

    // 1. Validar días solicitados
    if (tipo === 'vacaciones' && diasParaSolicitud <= 0) {
      throw new Error('La cantidad de días solicitados debe ser mayor a 0');
    }

    // 1b. Reglas de vacaciones configurables (Configuración → Vacaciones)
    if (tipo === 'vacaciones') {
      const reglas = await obtenerConfigs([
        'vacaciones.dias_minimos_solicitud',
        'vacaciones.dias_maximos_consecutivos',
        'vacaciones.dias_anticipacion',
        'vacaciones.permitir_medio_dia',
      ]);
      const minDias = asNumber(reglas['vacaciones.dias_minimos_solicitud'], 1);
      const maxDias = asNumber(reglas['vacaciones.dias_maximos_consecutivos'], 365);
      const anticipacion = asNumber(reglas['vacaciones.dias_anticipacion'], 0);
      const permitirMedioDia = asBool(reglas['vacaciones.permitir_medio_dia']);

      if (diasParaSolicitud < minDias) {
        throw new Error(`La solicitud debe ser de al menos ${minDias} día(s).`);
      }
      if (diasParaSolicitud > maxDias) {
        throw new Error(`No puede solicitar más de ${maxDias} días consecutivos.`);
      }
      if (!permitirMedioDia && !Number.isInteger(diasParaSolicitud)) {
        throw new Error('No está permitido solicitar medios días.');
      }
      if (anticipacion > 0 && fechaInicio) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const minInicio = new Date(hoy);
        minInicio.setDate(minInicio.getDate() + anticipacion);
        const inicio = new Date(`${fechaInicio}T00:00:00`);
        if (inicio < minInicio) {
          throw new Error(`Las vacaciones deben solicitarse con al menos ${anticipacion} día(s) de anticipación.`);
        }
      }
    }

    if (tipo === 'permiso_salida' && (!motivo?.trim() || motivo.trim().length < 5)) {
      throw new Error('Para permisos de salida es obligatorio indicar un motivo de al menos 5 caracteres.');
    }

    // 2. Validar fechas
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
    }

    // 3. Validar VoBo de Ministro para Directores
    if (esDirector && (!documentosAdjuntos || documentosAdjuntos.length === 0)) {
      throw new Error('Los Directores deben adjuntar obligatoriamente el correo con el VoBo del Ministro.');
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
    if (descuentaBalance && diasParaBalance > 0) {
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
      if (disponible < diasParaBalance) {
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
    // Director crea + adjunta VoBo → va directo a RRHH (estado: aprobada_jefe)
    // Jefe crea → pendiente_jefe (va a su Director para aprobación)
    // Empleado crea → pendiente_jefe (va a su Jefe/Director para aprobación)
    const estadoInicial = esDirector ? 'aprobada_jefe' : 'pendiente_jefe';

    // Resolver horas para permisos de salida
    // El CHECK constraint de la BD exige hora_salida y hora_regreso NOT NULL para permiso_salida
    let horaSalidaFinal = horaSalida || null;
    let horaRegresoFinal = horaRegreso || null;

    if (tipo === 'permiso_salida') {
      if (duracionPermiso === 'dia_completo') {
        // Para día completo, auto-asignar jornada laboral
        horaSalidaFinal = horaSalidaFinal || '08:00';
        horaRegresoFinal = horaRegresoFinal || '17:00';
      } else {
        // Para 1-2h y 2-4h, asegurar que las horas estén presentes
        if (!horaSalidaFinal) horaSalidaFinal = '08:00';
        if (!horaRegresoFinal) {
          if (duracionPermiso === '1-2h') horaRegresoFinal = '10:00';
          else if (duracionPermiso === '2-4h') horaRegresoFinal = '12:00';
          else horaRegresoFinal = '17:00';
        }
      }
    }

    const [nuevaSolicitud] = await tx
      .insert(solicitudes)
      .values({
        codigo,
        usuarioId,
        anoLaboralId: anoLaboral.id,
        tipo,
        fechaInicio,
        fechaFin,
        diasSolicitados: diasParaSolicitud.toString(),
        duracionPermiso,
        horaSalida: horaSalidaFinal,
        horaRegreso: horaRegresoFinal,
        motivo,
        comentarioEmpleado,
        documentosAdjuntos,
        estado: estadoInicial,
        // Si es Director, marcamos que ya pasó el filtro del jefe vía adjunto
        aprobadaJefeFecha: esDirector ? new Date().toISOString() : null,
        metadata: { test: false },
        ...(esDirector ? {
          aprobadaJefePor: usuarioId,
          aprobadaJefeFecha: new Date().toISOString(),
          comentarioJefe: 'Auto-aprobado (solicitud creada por Director)',
        } : {}),
      })
      .returning();

    // 6. Si es vacación, actualizar balance (cantidad_pendiente)
    if (descuentaBalance && diasParaBalance > 0) {
      await tx.execute(sql`
        UPDATE balances
        SET cantidad_pendiente = cantidad_pendiente + ${diasParaBalance},
            cantidad_disponible = GREATEST(0, cantidad_disponible - ${diasParaBalance}),
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
 *
 * @deprecated Workflow imperativo legacy. La vía viva de aprobación es
 * `ejecutarAccion` en workflow.service.ts (ruta /api/solicitudes/[id]/accion),
 * que centraliza estado + efectos de balance + guards de jerarquía vía la
 * máquina de estados. Esta función se conserva solo como objetivo de los
 * tests de integración; no la uses en código nuevo ni la conectes a rutas.
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

    if (solicitud.usuarioId === jefeId) {
      throw new Error('No puede aprobar su propia solicitud');
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
 *
 * @deprecated Workflow imperativo legacy. Usar `ejecutarAccion`
 * (workflow.service.ts). Conservada solo para tests de integración.
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
    if ((solicitud.tipo === 'vacaciones' || (solicitud.tipo === 'permiso_salida' && solicitud.duracionPermiso === 'dia_completo')) && solicitud.diasSolicitados) {
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
 *
 * @deprecated Workflow imperativo legacy. Usar `ejecutarAccion`
 * (workflow.service.ts). Conservada solo para tests de integración.
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

    if (['aprobada_rrhh', 'finalizada'].includes(solicitud.estado)) {
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
      .where(and(eq(solicitudes.id, solicitudId), eq(solicitudes.version, solicitud.version)))
      .returning();

    if (!updated) {
      throw new Error('Conflicto de versión: la solicitud fue modificada por otro usuario');
    }

    const devuelveBalance = solicitud.tipo === 'vacaciones' || (solicitud.tipo === 'permiso_salida' && solicitud.duracionPermiso === 'dia_completo');
    if (devuelveBalance && solicitud.diasSolicitados) {
      const dias = parseFloat(solicitud.diasSolicitados);

      await tx.execute(sql`
        UPDATE balances
        SET cantidad_disponible = cantidad_disponible + ${dias},
            cantidad_pendiente = GREATEST(0, cantidad_pendiente - ${dias}),
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

/**
 * Cancelar solicitud
 * Permite al usuario o admin cancelar una solicitud
 *
 * @deprecated Workflow imperativo legacy. Usar `ejecutarAccion` con la
 * acción 'cancelar' (workflow.service.ts). Conservada para tests.
 */
export async function cancelarSolicitud(
  solicitudId: number,
  usuarioId: number,
  motivo: string,
  esAdmin: boolean = false
) {
  return await db.transaction(async (tx) => {
    const solicitud = await tx.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
    });

    if (!solicitud) {
      throw new Error('Solicitud no encontrada');
    }

    // Validar que el usuario es el creador O es admin
    if (!esAdmin && solicitud.usuarioId !== usuarioId) {
      throw new Error('No tienes permiso para cancelar esta solicitud');
    }

    // Validar que el estado permite cancelación
    const estadosCancelables = ['pendiente_jefe', 'aprobada_jefe', 'aprobada_rrhh'];
    if (!estadosCancelables.includes(solicitud.estado)) {
      throw new Error(
        `No se puede cancelar una solicitud en estado: ${solicitud.estado}`
      );
    }

    // Devolver días al balance según el estado
    if ((solicitud.tipo === 'vacaciones' || (solicitud.tipo === 'permiso_salida' && solicitud.duracionPermiso === 'dia_completo')) && solicitud.diasSolicitados) {
      const dias = parseFloat(solicitud.diasSolicitados);

      if (solicitud.estado === 'aprobada_rrhh') {
        // Si ya estaba aprobada por RRHH, devolver de cantidad_usada a disponible
        await tx.execute(sql`
          UPDATE balances
          SET cantidad_usada = GREATEST(0, cantidad_usada - ${dias}),
              cantidad_disponible = cantidad_disponible + ${dias},
              updated_at = NOW()
          WHERE usuario_id = ${solicitud.usuarioId}
            AND ano_laboral_id = ${solicitud.anoLaboralId}
            AND tipo_ausencia = 'vacaciones'
        `);
      } else {
        // Si aún estaba pendiente, devolver de cantidad_pendiente a disponible
        await tx.execute(sql`
          UPDATE balances
          SET cantidad_pendiente = GREATEST(0, cantidad_pendiente - ${dias}),
              cantidad_disponible = cantidad_disponible + ${dias},
              updated_at = NOW()
          WHERE usuario_id = ${solicitud.usuarioId}
            AND ano_laboral_id = ${solicitud.anoLaboralId}
            AND tipo_ausencia = 'vacaciones'
        `);
      }
    }

    // Actualizar estado a cancelada
    const [updated] = await tx
      .update(solicitudes)
      .set({
        estado: 'cancelada',
        estadoAnterior: solicitud.estado,
        rechazadaPor: usuarioId,
        rechazadaFecha: new Date().toISOString(),
        motivoRechazo: motivo || 'Cancelada por el usuario',
        version: sql`${solicitudes.version} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(solicitudes.id, solicitudId))
      .returning();

    return updated;
  });
}
