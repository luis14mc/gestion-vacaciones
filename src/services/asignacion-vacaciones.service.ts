/**
 * Servicio de asignación mensual automática de vacaciones (Fase 5).
 *
 * Reglas:
 *   - Solo empleados activos (activo = true, deletedAt IS NULL).
 *   - Empleados sin `fechaIngreso` se omiten.
 *   - Empleados con antigüedad < 1 año no reciben asignación.
 *   - Una asignación por (usuarioId, anio, mes) — restricción UNIQUE
 *     evita duplicados al re-ejecutar.
 *   - Atomicidad transaccional: si falla cualquier fila, no queda
 *     asignación parcial.
 *   - Auditoría:
 *       - Evento `asignacion_vacaciones_mensual` por usuario.
 *       - Evento `asignacion_vacaciones_mensual_batch` (resumen).
 *   - Notificación interna: cada asignación crea un registro en
 *     `notificaciones` (sistema in-app).
 */
import { db } from '@/lib/db';
import {
  usuarios,
  balances,
  anosLaborales,
  historialAsignacionesMensuales,
  notificaciones,
} from '@/lib/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { calcularDiasMensualesPorAntiguedad, calcularAntiguedadLaboral } from '@/lib/domain/vacaciones-asignacion';
import { acreditarBalanceMensualVacaciones } from '@/lib/domain/balance-effects';
import {
  registrarAuditoria,
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';

export interface ResultadoAsignacionUsuario {
  usuarioId: number;
  nombreCompleto: string;
  fechaIngreso: string | null;
  aniosAntiguedad: number;
  diasAnuales: number;
  diasAsignados: number;
  balanceAnterior: number;
  balanceNuevo: number;
  estado: 'asignado' | 'omitido_sin_ingreso' | 'omitido_sin_antiguedad' | 'omitido_duplicado' | 'omitido_sin_balance' | 'omitido_inactivo' | 'omitido_eliminado';
  motivoOmision?: string;
}

export interface ResumenAsignacionMensual {
  anio: number;
  mes: number;
  origen: 'automatico' | 'manual' | 'sistema';
  ejecutadoPor: number;
  usuariosProcesados: number;
  asignacionesCreadas: number;
  usuariosOmitidos: number;
  totalDiasAsignados: number;
  detalles: ResultadoAsignacionUsuario[];
}

interface OpcionesEjecucion {
  anio: number;
  mes: number;
  origen?: 'automatico' | 'manual' | 'sistema';
  ejecutadoPor: number;
  ipAddress?: string;
  userAgent?: string;
}

const FORMATO_NOTIFICACION_TITULO = 'Asignación mensual de vacaciones';
const FORMATO_NOTIFICACION_MENSAJE = (
  dias: number,
  mes: number,
  nuevo: number
) =>
  `Se le han asignado ${dias.toFixed(4).replace(/\.?0+$/, '')} días correspondientes al mes ${mes}. Su nuevo total disponible es ${nuevo.toFixed(2)} días.`;

/**
 * Aplica la asignación a un usuario individual dentro de una
 * transacción. Devuelve el resultado parcial (asignado u omitido).
 */
async function aplicarAsignacionAUsuarioTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: { usuarioId: number; anio: number; mes: number; anioLaboralId: number }
): Promise<ResultadoAsignacionUsuario> {
  const [usuario] = await tx
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      fechaIngreso: usuarios.fechaIngreso,
      activo: usuarios.activo,
      deletedAt: usuarios.deletedAt,
    })
    .from(usuarios)
    .where(eq(usuarios.id, params.usuarioId))
    .limit(1);

  if (!usuario) {
    return {
      usuarioId: params.usuarioId,
      nombreCompleto: 'Desconocido',
      fechaIngreso: null,
      aniosAntiguedad: 0,
      diasAnuales: 0,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_eliminado',
    };
  }

  if (usuario.deletedAt) {
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: usuario.fechaIngreso,
      aniosAntiguedad: 0,
      diasAnuales: 0,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_eliminado',
    };
  }

  if (!usuario.activo) {
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: usuario.fechaIngreso,
      aniosAntiguedad: 0,
      diasAnuales: 0,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_inactivo',
    };
  }

  if (!usuario.fechaIngreso) {
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: null,
      aniosAntiguedad: 0,
      diasAnuales: 0,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_sin_ingreso',
    };
  }

  const referencia = new Date(params.anio, params.mes - 1, 1);
  const aniosCumplidos = calcularAntiguedadLaboral(usuario.fechaIngreso, referencia);
  const diasMensuales = calcularDiasMensualesPorAntiguedad(usuario.fechaIngreso, referencia);

  if (diasMensuales <= 0) {
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: usuario.fechaIngreso,
      aniosAntiguedad: aniosCumplidos,
      diasAnuales: 0,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_sin_antiguedad',
    };
  }

  // Calcular diasAnuales (display) a partir del proporcional mensual.
  const diasAnuales = Math.round(diasMensuales * 12 * 100) / 100;

  // Verificar si ya existe asignación para este mes.
  const [existente] = await tx
    .select({ id: historialAsignacionesMensuales.id })
    .from(historialAsignacionesMensuales)
    .where(
      and(
        eq(historialAsignacionesMensuales.usuarioId, usuario.id),
        eq(historialAsignacionesMensuales.anio, params.anio),
        eq(historialAsignacionesMensuales.mes, params.mes)
      )
    )
    .limit(1);

  if (existente) {
    const [balanceActual] = await tx
      .select({ cantidadDisponible: balances.cantidadDisponible })
      .from(balances)
      .where(
        and(
          eq(balances.usuarioId, usuario.id),
          eq(balances.anoLaboralId, params.anioLaboralId),
          eq(balances.tipoAusencia, 'vacaciones')
        )
      )
      .limit(1);
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: usuario.fechaIngreso,
      aniosAntiguedad: aniosCumplidos,
      diasAnuales,
      diasAsignados: 0,
      balanceAnterior: parseFloat(balanceActual?.cantidadDisponible ?? '0'),
      balanceNuevo: parseFloat(balanceActual?.cantidadDisponible ?? '0'),
      estado: 'omitido_duplicado',
    };
  }

  // Verificar balance existente; si no, crearlo con cantidad_inicial
  // proporcional al primer mes (regla: si no hay balance previo, se
  // considera asignación inicial implícita para no romper el flujo).
  const [balanceExistente] = await tx
    .select()
    .from(balances)
    .where(
      and(
        eq(balances.usuarioId, usuario.id),
        eq(balances.anoLaboralId, params.anioLaboralId),
        eq(balances.tipoAusencia, 'vacaciones')
      )
    )
    .limit(1);

  if (!balanceExistente) {
    // Sin balance no se puede acreditar. El endpoint legacy
    // /api/admin/asignar-dias crea el balance inicial. Aquí omitimos
    // para mantener simple la ruta de Fase 5.
    return {
      usuarioId: usuario.id,
      nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
      fechaIngreso: usuario.fechaIngreso,
      aniosAntiguedad: aniosCumplidos,
      diasAnuales,
      diasAsignados: 0,
      balanceAnterior: 0,
      balanceNuevo: 0,
      estado: 'omitido_sin_balance',
    };
  }

  const balanceAnterior = parseFloat(balanceExistente.cantidadDisponible);

  // Acreditar el proporcional a cantidad_acumulada.
  await acreditarBalanceMensualVacaciones(tx, {
    usuarioId: usuario.id,
    anoLaboralId: params.anioLaboralId,
    dias: diasMensuales,
  });

  // Releer balance nuevo (el trigger recalcula disponible).
  const [balanceNuevoRow] = await tx
    .select({ cantidadDisponible: balances.cantidadDisponible })
    .from(balances)
    .where(eq(balances.id, balanceExistente.id))
    .limit(1);

  const balanceNuevo = parseFloat(balanceNuevoRow?.cantidadDisponible ?? '0');

  // Insertar fila de historial.
  const [histRow] = await tx
    .insert(historialAsignacionesMensuales)
    .values({
      usuarioId: usuario.id,
      anio: params.anio,
      mes: params.mes,
      diasAsignados: diasMensuales.toFixed(4),
      balanceAnterior: balanceAnterior.toFixed(4),
      balanceNuevo: balanceNuevo.toFixed(4),
      diasAnualesAplicados: diasAnuales.toFixed(2),
      aniosAntiguedad: aniosCumplidos,
      origen: 'automatico',
      ejecutadoPor: null,
      observacion: null,
    })
    .returning({ id: historialAsignacionesMensuales.id });

  // Notificación interna al empleado.
  try {
    await tx.insert(notificaciones).values({
      usuarioId: usuario.id,
      tipo: 'asignacion_vacaciones',
      titulo: FORMATO_NOTIFICACION_TITULO,
      mensaje: FORMATO_NOTIFICACION_MENSAJE(diasMensuales, params.mes, balanceNuevo),
      referencia: histRow ? `asignacion:${histRow.id}` : `asignacion:${usuario.id}:${params.anio}-${params.mes}`,
      leida: false,
    });
  } catch (err) {
    // Si el sistema de notificaciones no existe aún, se ignora para
    // no romper la asignación. (Fase 5 entrega robusta.)
    console.warn('[asignacion] No se pudo crear notificación interna:', err);
  }

  return {
    usuarioId: usuario.id,
    nombreCompleto: `${usuario.nombre} ${usuario.apellido}`.trim(),
    fechaIngreso: usuario.fechaIngreso,
    aniosAntiguedad: aniosCumplidos,
    diasAnuales,
    diasAsignados: diasMensuales,
    balanceAnterior,
    balanceNuevo,
    estado: 'asignado',
  };
}

/**
 * Ejecuta la asignación mensual para todos los usuarios activos.
 */
export async function asignarVacacionesMensuales(
  opciones: OpcionesEjecucion
): Promise<ResumenAsignacionMensual> {
  const origen = opciones.origen ?? 'automatico';

  // Año laboral activo (la regla actual es 1 año laboral = 1 año
  // calendario institucional). Mantenemos el contrato de "año activo".
  const [anoLaboral] = await db
    .select()
    .from(anosLaborales)
    .where(eq(anosLaborales.activo, true))
    .limit(1);

  if (!anoLaboral) {
    throw new Error('No hay un año laboral activo para acreditar asignaciones mensuales.');
  }

  // Traer todos los usuarios activos no eliminados.
  const usuariosActivos = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

  const detalles: ResultadoAsignacionUsuario[] = [];
  let asignacionesCreadas = 0;
  let usuariosOmitidos = 0;
  let totalDiasAsignados = 0;

  await db.transaction(async (tx) => {
    for (const u of usuariosActivos) {
      const resultado = await aplicarAsignacionAUsuarioTx(tx, {
        usuarioId: u.id,
        anio: opciones.anio,
        mes: opciones.mes,
        anioLaboralId: anoLaboral.id,
      });
      detalles.push(resultado);
      if (resultado.estado === 'asignado') {
        asignacionesCreadas++;
        totalDiasAsignados += resultado.diasAsignados;
      } else {
        usuariosOmitidos++;
      }
    }

    // Actualizar ejecutado_por y origen en las filas creadas en este
    // batch.
    if (asignacionesCreadas > 0) {
      await tx.execute(sql`
        UPDATE historial_asignaciones_mensuales
        SET ejecutado_por = ${opciones.ejecutadoPor},
            origen = ${origen},
            updated_at = NOW()
        WHERE anio = ${opciones.anio}
          AND mes = ${opciones.mes}
          AND ejecutado_por IS NULL
      `);
    }
  });

  // Auditoría: batch + cada asignación individual.
  const datosRed = datosPeticionFromOptions(opciones);
  await registrarEventoAuditoria({
    usuarioId: opciones.ejecutadoPor,
    modulo: 'vacaciones',
    evento: 'asignacion_vacaciones_mensual_batch',
    severidad: 'info',
    resultado: 'exito',
    accion: 'asignacion_vacaciones_mensual_batch',
    tablaAfectada: 'historial_asignaciones_mensuales',
    detalles: {
      anio: opciones.anio,
      mes: opciones.mes,
      origen,
      usuariosProcesados: usuariosActivos.length,
      asignacionesCreadas,
      usuariosOmitidos,
      totalDiasAsignados: Math.round(totalDiasAsignados * 10000) / 10000,
    },
    ...datosRed,
  });

  for (const d of detalles) {
    if (d.estado !== 'asignado') continue;
    await registrarAuditoria({
      usuarioId: opciones.ejecutadoPor,
      accion: 'asignacion_vacaciones_mensual',
      tablaAfectada: 'historial_asignaciones_mensuales',
      registroId: d.usuarioId,
      detalles: {
        evento: 'asignacion_vacaciones_mensual',
        anio: opciones.anio,
        mes: opciones.mes,
        diasAsignados: d.diasAsignados,
        balanceAnterior: d.balanceAnterior,
        balanceNuevo: d.balanceNuevo,
        aniosAntiguedad: d.aniosAntiguedad,
        origen,
      },
      ...datosRed,
    });
  }

  return {
    anio: opciones.anio,
    mes: opciones.mes,
    origen,
    ejecutadoPor: opciones.ejecutadoPor,
    usuariosProcesados: usuariosActivos.length,
    asignacionesCreadas,
    usuariosOmitidos,
    totalDiasAsignados: Math.round(totalDiasAsignados * 10000) / 10000,
    detalles,
  };
}

/**
 * Asigna el proporcional mensual a un solo usuario. Útil para
 * reintentos manuales o para una API administrativa puntual.
 */
export async function asignarVacacionesMensualesAUsuario(params: {
  usuarioId: number;
  anio: number;
  mes: number;
  origen?: 'automatico' | 'manual' | 'sistema';
  ejecutadoPor: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ResultadoAsignacionUsuario> {
  const [anoLaboral] = await db
    .select()
    .from(anosLaborales)
    .where(eq(anosLaborales.activo, true))
    .limit(1);

  if (!anoLaboral) {
    throw new Error('No hay un año laboral activo para acreditar asignaciones mensuales.');
  }

  let resultado: ResultadoAsignacionUsuario = {
    usuarioId: params.usuarioId,
    nombreCompleto: 'Desconocido',
    fechaIngreso: null,
    aniosAntiguedad: 0,
    diasAnuales: 0,
    diasAsignados: 0,
    balanceAnterior: 0,
    balanceNuevo: 0,
    estado: 'omitido_sin_balance',
  };

  await db.transaction(async (tx) => {
    resultado = await aplicarAsignacionAUsuarioTx(tx, {
      usuarioId: params.usuarioId,
      anio: params.anio,
      mes: params.mes,
      anioLaboralId: anoLaboral.id,
    });
  });

  const datosRed = datosPeticionFromOptions(params);

  if (resultado.estado === 'asignado') {
    await registrarAuditoria({
      usuarioId: params.ejecutadoPor,
      accion: 'asignacion_vacaciones_mensual',
      tablaAfectada: 'historial_asignaciones_mensuales',
      registroId: params.usuarioId,
      detalles: {
        evento: 'asignacion_vacaciones_mensual',
        anio: params.anio,
        mes: params.mes,
        diasAsignados: resultado.diasAsignados,
        balanceAnterior: resultado.balanceAnterior,
        balanceNuevo: resultado.balanceNuevo,
        aniosAntiguedad: resultado.aniosAntiguedad,
        origen: params.origen ?? 'manual',
      },
      ...datosRed,
    });
  }

  return resultado;
}

/**
 * Devuelve el historial de asignaciones de un usuario (todos los
 * meses). Útil para la consulta individual o el panel RRHH.
 */
export async function obtenerHistorialAsignacionesUsuario(
  usuarioId: number,
  opciones?: { anio?: number; limite?: number }
): Promise<
  Array<{
    id: number;
    anio: number;
    mes: number;
    diasAsignados: number;
    balanceAnterior: number;
    balanceNuevo: number;
    diasAnualesAplicados: number;
    aniosAntiguedad: number;
    origen: 'automatico' | 'manual' | 'sistema';
    ejecutadoPor: number | null;
    ejecutadoEn: string;
    observacion: string | null;
  }>
> {
  const where = opciones?.anio
    ? and(
        eq(historialAsignacionesMensuales.usuarioId, usuarioId),
        eq(historialAsignacionesMensuales.anio, opciones.anio)
      )
    : eq(historialAsignacionesMensuales.usuarioId, usuarioId);

  const rows = await db
    .select()
    .from(historialAsignacionesMensuales)
    .where(where)
    .orderBy(
      sql`${historialAsignacionesMensuales.anio} DESC, ${historialAsignacionesMensuales.mes} DESC`
    )
    .limit(opciones?.limite ?? 36);

  return rows.map((r) => ({
    id: r.id,
    anio: r.anio,
    mes: r.mes,
    diasAsignados: parseFloat(r.diasAsignados),
    balanceAnterior: parseFloat(r.balanceAnterior),
    balanceNuevo: parseFloat(r.balanceNuevo),
    diasAnualesAplicados: parseFloat(r.diasAnualesAplicados),
    aniosAntiguedad: r.aniosAntiguedad,
    origen: r.origen,
    ejecutadoPor: r.ejecutadoPor,
    ejecutadoEn: r.ejecutadoEn,
    observacion: r.observacion,
  }));
}

/**
 * Devuelve un resumen batch de un (anio, mes) específico.
 */
export async function obtenerResumenAsignacionesMensuales(params: {
  anio: number;
  mes: number;
}) {
  const rows = await db
    .select({
      usuarioId: historialAsignacionesMensuales.usuarioId,
      anio: historialAsignacionesMensuales.anio,
      mes: historialAsignacionesMensuales.mes,
      diasAsignados: historialAsignacionesMensuales.diasAsignados,
      aniosAntiguedad: historialAsignacionesMensuales.aniosAntiguedad,
      origen: historialAsignacionesMensuales.origen,
      ejecutadoEn: historialAsignacionesMensuales.ejecutadoEn,
      ejecutadoPor: historialAsignacionesMensuales.ejecutadoPor,
    })
    .from(historialAsignacionesMensuales)
    .where(
      and(
        eq(historialAsignacionesMensuales.anio, params.anio),
        eq(historialAsignacionesMensuales.mes, params.mes)
      )
    );

  const totalAsignados = rows.reduce(
    (acc, r) => acc + parseFloat(r.diasAsignados),
    0
  );

  return {
    anio: params.anio,
    mes: params.mes,
    asignaciones: rows.length,
    totalDiasAsignados: Math.round(totalAsignados * 10000) / 10000,
    detalles: rows.map((r) => ({
      usuarioId: r.usuarioId,
      diasAsignados: parseFloat(r.diasAsignados),
      aniosAntiguedad: r.aniosAntiguedad,
      origen: r.origen,
      ejecutadoEn: r.ejecutadoEn,
      ejecutadoPor: r.ejecutadoPor,
    })),
  };
}

function datosPeticionFromOptions(opts: { ipAddress?: string; userAgent?: string }): {
  ipAddress?: string;
  userAgent?: string;
} {
  const out: { ipAddress?: string; userAgent?: string } = {};
  if (opts.ipAddress) out.ipAddress = opts.ipAddress;
  if (opts.userAgent) out.userAgent = opts.userAgent;
  return out;
}

// Marcar uso explícito de imports necesarios.
void datosPeticion;