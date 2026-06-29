import { db } from '@/lib/db';
import { solicitudes, usuarios, usuariosRoles, roles } from '@/lib/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { notificarAprobacionJefeARRHH, notificarResolucionAEmpleado } from './email.service';
import { obtenerConfigs, asBool } from '@/lib/config/service';
import {
  type AccionSolicitud,
  type EstadoSolicitud,
  obtenerAccionesDisponibles,
  transicionar,
} from '@/lib/domain/state-machine';
import {
  confirmarBalanceVacaciones,
  liberarBalancePendiente,
  liberarBalanceUsada,
  reservarBalanceVacaciones,
} from '@/lib/domain/balance-effects';

function solicitudConsumeBalance(solicitud: { tipo: string; duracionPermiso?: string | null }): boolean {
  return solicitud.tipo === 'vacaciones' || (solicitud.tipo === 'permiso_salida' && solicitud.duracionPermiso === 'dia_completo');
}

interface UsuarioAccion {
  id: number;
  esDirector: boolean;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
  departamentoId?: number | null;
}

interface EjecutarAccionParams {
  solicitudId: number;
  accion: AccionSolicitud;
  usuarioId: number;
  esDirector: boolean;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
  departamentoId?: number | null;
  comentario?: string;
  motivoRechazo?: string;
  motivoCancelacion?: string;
}

interface ResultadoAccion {
  exito: boolean;
  solicitud?: any;
  transicion?: { estadoAnterior: string; estadoNuevo: string };
  error?: string;
}

export async function obtenerAccionesParaSolicitud(
  solicitudId: number,
  usuario: UsuarioAccion
): Promise<{ accion: AccionSolicitud; label: string }[]> {
  const [solicitud] = await db
    .select({ estado: solicitudes.estado, usuarioId: solicitudes.usuarioId })
    .from(solicitudes)
    .where(and(eq(solicitudes.id, solicitudId), isNull(solicitudes.deletedAt)))
    .limit(1);

  if (!solicitud) return [];

  // Departamento y nivel del solicitante para validar alcance y jerarquía
  const [solicitanteInfo] = await db
    .select({
      departamentoId: usuarios.departamentoId,
      esJefe: usuarios.esJefe,
      jefeSuperiorId: usuarios.jefeSuperiorId,
    })
    .from(usuarios)
    .where(eq(usuarios.id, solicitud.usuarioId))
    .limit(1);

  let directorSinSubordinadosDirectos = false;
  if (usuario.esDirector) {
    const [jerarquia] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usuarios)
      .where(and(
        eq(usuarios.jefeSuperiorId, usuario.id),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      ));
    directorSinSubordinadosDirectos = (jerarquia?.count || 0) === 0;
  }

  const estadoActual = solicitud.estado as EstadoSolicitud;
  const acciones = obtenerAccionesDisponibles(estadoActual);

  const labels: Record<string, string> = {
    enviar: 'Enviar solicitud',
    aprobar_jefe: 'Aprobar (Jefe)',
    rechazar_jefe: 'Rechazar (Jefe)',
    aprobar_rrhh: 'Aprobar (RRHH)',
    rechazar_rrhh: 'Rechazar (RRHH)',
    cancelar: 'Cancelar solicitud',
    finalizar: 'Finalizar',
  };

  const ctx = {
    usuarioId: usuario.id,
    solicitanteId: solicitud.usuarioId,
    esDirector: usuario.esDirector,
    esJefe: usuario.esJefe,
    esRrhh: usuario.esRrhh,
    esAdmin: usuario.esAdmin,
    departamentoAprobador: usuario.departamentoId ?? null,
    departamentoSolicitante: solicitanteInfo?.departamentoId ?? null,
    esSubordinadoDirecto: solicitanteInfo?.jefeSuperiorId === usuario.id,
    directorSinSubordinadosDirectos,
    solicitanteEsJefe: solicitanteInfo?.esJefe ?? false,
  };

  return acciones
    .filter(accion => {
      const result = transicionar(estadoActual, accion, ctx, 0);
      return result.exito;
    })
    .map(accion => ({
      accion,
      label: labels[accion] || accion,
    }));
}

export async function ejecutarAccion(params: EjecutarAccionParams): Promise<ResultadoAccion> {
  const { solicitudId, accion, usuarioId, esDirector, esJefe, esRrhh, esAdmin, departamentoId, comentario, motivoRechazo, motivoCancelacion } = params;

  const [solicitud] = await db
    .select()
    .from(solicitudes)
    .where(and(eq(solicitudes.id, solicitudId), isNull(solicitudes.deletedAt)))
    .limit(1);

  if (!solicitud) {
    return { exito: false, error: 'Solicitud no encontrada' };
  }

  // Departamento y nivel del solicitante para validar alcance y jerarquía
  const [solicitanteInfo] = await db
    .select({
      departamentoId: usuarios.departamentoId,
      esJefe: usuarios.esJefe,
      jefeSuperiorId: usuarios.jefeSuperiorId,
    })
    .from(usuarios)
    .where(eq(usuarios.id, solicitud.usuarioId))
    .limit(1);

  let directorSinSubordinadosDirectos = false;
  if (esDirector) {
    const [jerarquia] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usuarios)
      .where(and(
        eq(usuarios.jefeSuperiorId, usuarioId),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      ));
    directorSinSubordinadosDirectos = (jerarquia?.count || 0) === 0;
  }

  const estadoActual = solicitud.estado as EstadoSolicitud;
  const dias = Number(solicitud.diasSolicitados ?? 0);

  const resultado = transicionar(estadoActual, accion, {
    usuarioId,
    solicitanteId: solicitud.usuarioId,
    esDirector,
    esJefe,
    esRrhh,
    esAdmin,
    departamentoAprobador: departamentoId ?? null,
    departamentoSolicitante: solicitanteInfo?.departamentoId ?? null,
    esSubordinadoDirecto: solicitanteInfo?.jefeSuperiorId === usuarioId,
    directorSinSubordinadosDirectos,
    solicitanteEsJefe: solicitanteInfo?.esJefe ?? false,
  }, dias);

  if (!resultado.exito || !resultado.estadoNuevo) {
    return { exito: false, error: resultado.error || 'Transición no válida' };
  }

  const nuevoEstado = resultado.estadoNuevo;
  const ahora = new Date().toISOString();

  // Histórico de comentarios en metadata
  const metadataActual = (solicitud.metadata as any) || {};
  const comentariosHist = Array.isArray(metadataActual.comentarios) ? [...metadataActual.comentarios] : [];
  
  if (comentario || motivoRechazo || motivoCancelacion) {
    comentariosHist.push({
      usuarioId,
      accion,
      comentario: comentario || motivoRechazo || motivoCancelacion,
      fecha: ahora
    });
  }

  const updateData: Record<string, any> = {
    estado: nuevoEstado,
    estadoAnterior: estadoActual,
    version: solicitud.version + 1,
    updatedAt: ahora,
    metadata: { ...metadataActual, comentarios: comentariosHist }
  };

  if (accion === 'aprobar_jefe') {
    updateData.aprobadaJefePor = usuarioId;
    updateData.aprobadaJefeFecha = ahora;
    if (comentario) updateData.comentarioJefe = comentario;
  } else if (accion === 'aprobar_rrhh') {
    updateData.aprobadaRrhhPor = usuarioId;
    updateData.aprobadaRrhhFecha = ahora;
    if (comentario) updateData.comentarioRrhh = comentario;
  } else if (accion.startsWith('rechazar')) {
    updateData.rechazadaPor = usuarioId;
    updateData.rechazadaFecha = ahora;
    updateData.motivoRechazo = motivoRechazo || comentario || null;
  } else if (accion === 'cancelar') {
    updateData.motivoRechazo = motivoCancelacion || comentario || 'Cancelada por el usuario';
  }

  // Persistir el cambio de estado y APLICAR los efectos de balance de la
  // máquina de estados de forma ATÓMICA (misma transacción). Antes el
  // balance se ajustaba fuera de transacción y los efectos declarados
  // (RESERVAR/CONFIRMAR/LIBERAR) nunca se ejecutaban: el paso a usada en
  // aprobar_rrhh no ocurría. Ahora la máquina de estados es la autoridad.
  let conflicto = false;
  await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(solicitudes)
      .set(updateData)
      .where(and(eq(solicitudes.id, solicitudId), eq(solicitudes.version, solicitud.version)))
      .returning({ id: solicitudes.id });

    if (updateResult.length === 0) {
      conflicto = true;
      return;
    }

    await aplicarEfectos(tx, resultado.efectos, solicitud, estadoActual);
  });

  if (conflicto) {
    return { exito: false, error: 'Conflicto de versión: la solicitud fue modificada por otro usuario' };
  }

  const [updated] = await db.select().from(solicitudes).where(eq(solicitudes.id, solicitudId)).limit(1);

  // NOTIFICACIONES POR CORREO (respetan los toggles de Configuración)
  try {
    const [solicitante] = await db.select().from(usuarios).where(eq(usuarios.id, solicitud.usuarioId)).limit(1);

    if (solicitante && solicitante.email) {
      const flags = await obtenerConfigs([
        'notificaciones.notificar_rrhh_aprobacion_jefe',
        'notificaciones.notificar_empleado_aprobacion',
        'notificaciones.notificar_empleado_rechazo',
      ]);

      if (accion === 'aprobar_jefe') {
        if (asBool(flags['notificaciones.notificar_rrhh_aprobacion_jefe'])) {
          // Buscar correos de RRHH
          const rrhhUsers = await db.select({ email: usuarios.email })
            .from(usuarios)
            .innerJoin(usuariosRoles, eq(usuarios.id, usuariosRoles.usuarioId))
            .innerJoin(roles, eq(usuariosRoles.rolId, roles.id))
            .where(and(eq(roles.codigo, 'RRHH'), eq(usuarios.activo, true)));

          for (const rrhh of rrhhUsers) {
            if (rrhh.email) {
              notificarAprobacionJefeARRHH(rrhh.email, `${solicitante.nombre} ${solicitante.apellido}`, solicitud.tipo, dias).catch(e => console.error('Error email RRHH', e));
            }
          }
        }
      } else if (accion === 'aprobar_rrhh') {
        if (asBool(flags['notificaciones.notificar_empleado_aprobacion'])) {
          notificarResolucionAEmpleado(solicitante.email, solicitante.nombre, nuevoEstado, solicitud.tipo, dias, motivoRechazo || comentario).catch(e => console.error('Error email empleado', e));
        }
      } else if (accion.startsWith('rechazar')) {
        if (asBool(flags['notificaciones.notificar_empleado_rechazo'])) {
          notificarResolucionAEmpleado(solicitante.email, solicitante.nombre, nuevoEstado, solicitud.tipo, dias, motivoRechazo || comentario).catch(e => console.error('Error email empleado', e));
        }
      }
    }
  } catch (error) {
    console.error('Error procesando notificaciones de correo:', error);
  }

  return {
    exito: true,
    solicitud: updated,
    transicion: { estadoAnterior: estadoActual, estadoNuevo: nuevoEstado },
  };
}

/**
 * Aplica los efectos de balance declarados por la máquina de estados,
 * dentro de la transacción recibida. Es la ÚNICA autoridad sobre los
 * movimientos de balance del workflow, eliminando la lógica duplicada.
 *
 * Convención de columnas:
 * - RESERVAR_BALANCE  (al enviar): disponible → pendiente
 * - CONFIRMAR_BALANCE (aprobar_rrhh): pendiente → usada
 * - LIBERAR_BALANCE   (rechazar/cancelar): devuelve a disponible desde
 *   usada (si ya estaba confirmada) o desde pendiente (si seguía en curso)
 */
async function aplicarEfectos(
  tx: any,
  efectos: { tipo: string; dias?: number }[],
  solicitud: any,
  estadoOrigen: string
) {
  if (!solicitudConsumeBalance(solicitud)) return;

  const estadosConUsada = ['aprobada_rrhh', 'finalizada'];
  const params = {
    usuarioId: solicitud.usuarioId,
    anoLaboralId: solicitud.anoLaboralId,
    dias: 0,
  };

  for (const efecto of efectos) {
    const dias = Number(efecto.dias ?? 0);
    if (dias <= 0) continue;
    params.dias = dias;

    if (efecto.tipo === 'RESERVAR_BALANCE') {
      await reservarBalanceVacaciones(tx, params);
    } else if (efecto.tipo === 'CONFIRMAR_BALANCE') {
      await confirmarBalanceVacaciones(tx, params);
    } else if (efecto.tipo === 'LIBERAR_BALANCE') {
      if (estadosConUsada.includes(estadoOrigen)) {
        await liberarBalanceUsada(tx, params);
      } else {
        await liberarBalancePendiente(tx, params);
      }
    }
  }
}

export async function procesarTransicionesAutomaticas(): Promise<{
  procesadas: number;
  errores: number;
}> {
  const hoy = new Date().toISOString().split('T')[0];
  let procesadas = 0;
  let errores = 0;

  try {
    const paraFinalizar = await db
      .select()
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} = 'aprobada_rrhh'`,
          sql`${solicitudes.fechaFin} < ${hoy}`,
          isNull(solicitudes.deletedAt)
        )
      );

    for (const sol of paraFinalizar) {
      try {
        // Validar la transición vía la máquina de estados (no UPDATE crudo)
        const resultado = transicionar(
          sol.estado as EstadoSolicitud,
          'finalizar',
          {
            usuarioId: 0,
            solicitanteId: sol.usuarioId,
            esDirector: false,
            esJefe: false,
            esRrhh: false,
            esAdmin: false,
            esSistema: true,
          },
          Number(sol.diasSolicitados ?? 0)
        );

        if (!resultado.exito || !resultado.estadoNuevo) {
          errores++;
          continue;
        }

        await db
          .update(solicitudes)
          .set({
            estado: resultado.estadoNuevo,
            estadoAnterior: sol.estado,
            version: sol.version + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(and(
            eq(solicitudes.id, sol.id),
            eq(solicitudes.version, sol.version)
          ));

        procesadas++;
      } catch {
        errores++;
      }
    }
  } catch {
    errores++;
  }

  return { procesadas, errores };
}
