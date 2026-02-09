/**
 * ============================================================
 * WORKFLOW SERVICE - Orquestador de State Machine + BD
 * ============================================================
 * @description Conecta la State Machine pura con la infraestructura.
 *   Ejecuta transiciones, aplica efectos laterales y registra historial.
 * @version 1.0
 * ============================================================
 */

import { db } from '@/lib/db';
import {
  solicitudes,
  balances,
  historialBalances,
  anosLaborales,
} from '@/lib/db/schema';
import { eq, and, sql, lte, gte } from 'drizzle-orm';
import {
  transicionar,
  obtenerAccionesDisponibles,
  puedeTransicionar,
  type AccionSolicitud,
  type TransicionContexto,
  type EfectoLateral,
  type ResultadoTransicion,
} from '@/lib/domain/state-machine';
import type { EstadoSolicitud } from '@/types';

// =====================================================
// TIPOS
// =====================================================

export interface EjecutarAccionParams {
  solicitudId: number;
  accion: AccionSolicitud;
  usuarioId: number;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
  comentario?: string;
  motivoRechazo?: string;
  motivoCancelacion?: string;
}

export interface ResultadoWorkflow {
  exito: boolean;
  solicitud?: any;
  transicion?: ResultadoTransicion;
  error?: string;
}

// =====================================================
// SERVICIO PRINCIPAL
// =====================================================

/**
 * Ejecutar una acción sobre una solicitud.
 * Orquesta: validación → transición → persistencia → efectos laterales
 */
export async function ejecutarAccion(
  params: EjecutarAccionParams
): Promise<ResultadoWorkflow> {
  const {
    solicitudId,
    accion,
    usuarioId,
    esJefe,
    esRrhh,
    esAdmin,
    comentario,
    motivoRechazo,
    motivoCancelacion,
  } = params;

  return await db.transaction(async (tx) => {
    // 1. Cargar solicitud con lock optimista
    const solicitud = await tx.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
    });

    if (!solicitud) {
      return { exito: false, error: 'Solicitud no encontrada' };
    }

    const diasSolicitados = solicitud.diasSolicitados
      ? parseFloat(solicitud.diasSolicitados)
      : 0;

    // 2. Construir contexto para la state machine
    const contexto: TransicionContexto = {
      usuarioId,
      solicitanteId: solicitud.usuarioId,
      esJefe,
      esRrhh,
      esAdmin,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      tipo: solicitud.tipo,
    };

    // 3. Ejecutar transición (pure)
    const resultado = transicionar(
      solicitud.estado as EstadoSolicitud,
      accion,
      contexto,
      diasSolicitados
    );

    if (!resultado.exito) {
      return { exito: false, error: resultado.error, transicion: resultado };
    }

    // 4. Preparar datos de actualización
    const updateData: Record<string, any> = {
      estado: resultado.estadoNuevo,
      estadoAnterior: resultado.estadoAnterior,
      version: sql`${solicitudes.version} + 1`,
      updatedAt: new Date().toISOString(),
    };

    // Campos específicos según acción
    switch (accion) {
      case 'aprobar_jefe':
        updateData.aprobadaJefePor = usuarioId;
        updateData.aprobadaJefeFecha = new Date().toISOString();
        updateData.comentarioJefe = comentario;
        break;
      case 'aprobar_rrhh':
        updateData.aprobadaRrhhPor = usuarioId;
        updateData.aprobadaRrhhFecha = new Date().toISOString();
        updateData.comentarioRrhh = comentario;
        break;
      case 'aprobar_ejecutiva':
        updateData.autorizadaEjecutivaPor = usuarioId;
        updateData.autorizadaEjecutivaFecha = new Date().toISOString();
        updateData.comentarioEjecutiva = comentario;
        break;
      case 'rechazar_jefe':
      case 'rechazar_rrhh':
      case 'rechazar_ejecutiva':
        updateData.rechazadaPor = usuarioId;
        updateData.rechazadaFecha = new Date().toISOString();
        updateData.motivoRechazo = motivoRechazo;
        break;
      case 'cancelar':
        updateData.metadata = sql`${solicitudes.metadata} || ${JSON.stringify({
          canceladoPor: usuarioId,
          canceladoFecha: new Date().toISOString(),
          motivoCancelacion: motivoCancelacion || 'Cancelada por el usuario',
        })}::jsonb`;
        break;
    }

    // 5. Persistir cambio de estado (optimistic locking)
    const [updated] = await tx
      .update(solicitudes)
      .set(updateData)
      .where(
        and(
          eq(solicitudes.id, solicitudId),
          eq(solicitudes.version, solicitud.version)
        )
      )
      .returning();

    if (!updated) {
      return {
        exito: false,
        error: 'Conflicto de concurrencia. La solicitud fue modificada por otro usuario.',
      };
    }

    // 6. Ejecutar efectos laterales
    await ejecutarEfectos(tx, resultado.efectos, {
      solicitudId,
      usuarioId: solicitud.usuarioId,
      anoLaboralId: solicitud.anoLaboralId,
      tipo: solicitud.tipo,
      realizadoPor: usuarioId,
    });

    return { exito: true, solicitud: updated, transicion: resultado };
  });
}

/**
 * Obtener acciones disponibles para un usuario sobre una solicitud
 */
export async function obtenerAccionesParaSolicitud(
  solicitudId: number,
  usuarioCtx: { id: number; esJefe: boolean; esRrhh: boolean; esAdmin: boolean }
): Promise<AccionSolicitud[]> {
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId),
  });

  if (!solicitud) return [];

  const estadoActual = solicitud.estado as EstadoSolicitud;
  const accionesDisponibles = obtenerAccionesDisponibles(estadoActual);

  const contexto: TransicionContexto = {
    usuarioId: usuarioCtx.id,
    solicitanteId: solicitud.usuarioId,
    esJefe: usuarioCtx.esJefe,
    esRrhh: usuarioCtx.esRrhh,
    esAdmin: usuarioCtx.esAdmin,
    tipo: solicitud.tipo,
  };

  // Filtrar solo las que el usuario puede ejecutar
  return accionesDisponibles.filter((accion) => {
    const { valido } = puedeTransicionar(estadoActual, accion, contexto);
    return valido;
  });
}

// =====================================================
// CRON: Transiciones automáticas por fecha
// =====================================================

/**
 * Procesa transiciones automáticas basadas en fecha.
 *  - aprobada_rrhh/aprobada_ejecutiva → finalizada (si fechaFin <= hoy)
 * Diseñado para ejecutarse diariamente via API/cron.
 */
export async function procesarTransicionesAutomaticas(): Promise<{
  procesadas: number;
  errores: Array<{ solicitudId: number; error: string }>;
}> {
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Solicitudes aprobadas cuya fecha fin ya pasó
  const pendientes = await db.query.solicitudes.findMany({
    where: and(
      sql`${solicitudes.estado} IN ('aprobada_rrhh', 'aprobada_ejecutiva')`,
      lte(solicitudes.fechaFin, hoy)
    ),
  });

  let procesadas = 0;
  const errores: Array<{ solicitudId: number; error: string }> = [];

  for (const sol of pendientes) {
    try {
      const resultado = await ejecutarAccion({
        solicitudId: sol.id,
        accion: 'iniciar_uso',
        usuarioId: 0, // Sistema
        esJefe: false,
        esRrhh: false,
        esAdmin: true, // El cron tiene privilegios de admin
      });

      if (resultado.exito) {
        procesadas++;
      } else {
        errores.push({ solicitudId: sol.id, error: resultado.error || 'Error desconocido' });
      }
    } catch (error) {
      errores.push({
        solicitudId: sol.id,
        error: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  }

  return { procesadas, errores };
}

// =====================================================
// EFECTOS LATERALES (privado)
// =====================================================

interface EfectoContexto {
  solicitudId: number;
  usuarioId: number;
  anoLaboralId: number;
  tipo: string;
  realizadoPor: number;
}

async function ejecutarEfectos(
  tx: any,
  efectos: EfectoLateral[],
  ctx: EfectoContexto
) {
  for (const efecto of efectos) {
    switch (efecto.tipo) {
      case 'RESERVAR_BALANCE':
        if (ctx.tipo === 'vacaciones' && efecto.dias > 0) {
          await tx.execute(sql`
            UPDATE balances
            SET cantidad_pendiente = cantidad_pendiente + ${efecto.dias},
                updated_at = NOW()
            WHERE usuario_id = ${ctx.usuarioId}
              AND ano_laboral_id = ${ctx.anoLaboralId}
              AND tipo_ausencia = 'vacaciones'
          `);
        }
        break;

      case 'CONFIRMAR_BALANCE':
        if (ctx.tipo === 'vacaciones' && efecto.dias > 0) {
          await tx.execute(sql`
            UPDATE balances
            SET cantidad_pendiente = cantidad_pendiente - ${efecto.dias},
                cantidad_usada = cantidad_usada + ${efecto.dias},
                updated_at = NOW()
            WHERE usuario_id = ${ctx.usuarioId}
              AND ano_laboral_id = ${ctx.anoLaboralId}
              AND tipo_ausencia = 'vacaciones'
          `);
        }
        break;

      case 'LIBERAR_BALANCE':
        if (ctx.tipo === 'vacaciones' && efecto.dias > 0) {
          await tx.execute(sql`
            UPDATE balances
            SET cantidad_pendiente = GREATEST(cantidad_pendiente - ${efecto.dias}, 0),
                updated_at = NOW()
            WHERE usuario_id = ${ctx.usuarioId}
              AND ano_laboral_id = ${ctx.anoLaboralId}
              AND tipo_ausencia = 'vacaciones'
          `);
        }
        break;

      case 'REGISTRAR_HISTORIAL':
        if (ctx.tipo === 'vacaciones') {
          // Obtener balance actual para historial
          const [balance] = await tx.execute(sql`
            SELECT id, cantidad_usada, cantidad_disponible
            FROM balances
            WHERE usuario_id = ${ctx.usuarioId}
              AND ano_laboral_id = ${ctx.anoLaboralId}
              AND tipo_ausencia = 'vacaciones'
            LIMIT 1
          `) as any[];

          if (balance) {
            await tx.insert(historialBalances).values({
              balanceId: balance.id,
              usuarioId: ctx.usuarioId,
              tipoMovimiento: efecto.movimiento as any,
              cantidad: '0',
              cantidadAnterior: balance.cantidad_disponible?.toString() || '0',
              cantidadNueva: balance.cantidad_disponible?.toString() || '0',
              solicitudId: ctx.solicitudId,
              referencia: `SOL-${ctx.solicitudId}`,
              descripcion: `Movimiento automático: ${efecto.movimiento}`,
              realizadoPor: ctx.realizadoPor,
              metadata: {},
            });
          }
        }
        break;

      case 'NOTIFICAR':
        // Las notificaciones se gestionan en la capa de presentación.
        // Aquí solo registramos en metadata si es necesario.
        break;
    }
  }
}
