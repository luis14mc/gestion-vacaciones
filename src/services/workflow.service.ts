import { db } from '@/lib/db';
import { solicitudes, balances, usuarios, usuariosRoles, roles } from '@/lib/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { notificarAprobacionJefeARRHH, notificarResolucionAEmpleado } from './email.service';
import {
  type AccionSolicitud,
  type EstadoSolicitud,
  obtenerAccionesDisponibles,
  transicionar,
} from '@/lib/domain/state-machine';

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

  // Departamento del solicitante para validar alcance de aprobación
  const [solicitanteInfo] = await db
    .select({ departamentoId: usuarios.departamentoId })
    .from(usuarios)
    .where(eq(usuarios.id, solicitud.usuarioId))
    .limit(1);

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

  // Departamento del solicitante para validar alcance de aprobación
  const [solicitanteInfo] = await db
    .select({ departamentoId: usuarios.departamentoId })
    .from(usuarios)
    .where(eq(usuarios.id, solicitud.usuarioId))
    .limit(1);

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

  const updateResult = await db
    .update(solicitudes)
    .set(updateData)
    .where(and(eq(solicitudes.id, solicitudId), eq(solicitudes.version, solicitud.version)))
    .returning({ id: solicitudes.id });

  if (updateResult.length === 0) {
    return { exito: false, error: 'Conflicto de versión: la solicitud fue modificada por otro usuario' };
  }

  if (['rechazada_jefe', 'rechazada_rrhh', 'cancelada'].includes(nuevoEstado) && solicitudConsumeBalance(solicitud)) {
    await devolverDiasBalance({ ...solicitud, estadoAnterior: estadoActual });
  }

  const [updated] = await db.select().from(solicitudes).where(eq(solicitudes.id, solicitudId)).limit(1);

  // NOTIFICACIONES POR CORREO
  try {
    const [solicitante] = await db.select().from(usuarios).where(eq(usuarios.id, solicitud.usuarioId)).limit(1);
    
    if (solicitante && solicitante.email) {
      if (accion === 'aprobar_jefe') {
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
      } else if (accion === 'aprobar_rrhh' || accion.startsWith('rechazar')) {
        notificarResolucionAEmpleado(solicitante.email, solicitante.nombre, nuevoEstado, solicitud.tipo, dias, motivoRechazo || comentario).catch(e => console.error('Error email empleado', e));
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

async function devolverDiasBalance(solicitud: any) {
  if (!solicitud.diasSolicitados || Number(solicitud.diasSolicitados) <= 0) return;
  if (!solicitudConsumeBalance(solicitud)) return;

  const dias = Number(solicitud.diasSolicitados);
  const estadoOrigen = solicitud.estadoAnterior || solicitud.estado;

  const [balance] = await db
    .select()
    .from(balances)
    .where(
      and(
        eq(balances.usuarioId, solicitud.usuarioId),
        eq(balances.anoLaboralId, solicitud.anoLaboralId),
        eq(balances.tipoAusencia, 'vacaciones')
      )
    )
    .limit(1);

  if (!balance) return;

  const updateData: Record<string, any> = {
    cantidadDisponible: (Number(balance.cantidadDisponible ?? 0) + dias).toFixed(2),
    version: balance.version + 1,
    updatedAt: new Date().toISOString(),
  };

  const estadosConUsada = ['aprobada_rrhh', 'finalizada'];
  if (estadosConUsada.includes(estadoOrigen)) {
    updateData.cantidadUsada = Math.max(0, Number(balance.cantidadUsada ?? 0) - dias).toFixed(2);
  } else {
    updateData.cantidadPendiente = Math.max(0, Number(balance.cantidadPendiente ?? 0) - dias).toFixed(2);
  }

  await db
    .update(balances)
    .set(updateData)
    .where(eq(balances.id, balance.id));
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
        await db
          .update(solicitudes)
          .set({
            estado: 'finalizada',
            estadoAnterior: sol.estado,
            version: sol.version + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(solicitudes.id, sol.id));

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
