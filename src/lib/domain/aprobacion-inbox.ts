/**
 * Bandeja /aprobar-solicitudes — estados y reglas accionables.
 */

export const ESTADOS_ACCIONABLES_APROBACION = ['pendiente_jefe', 'aprobada_jefe'] as const;

export type EstadoAccionableAprobacion = (typeof ESTADOS_ACCIONABLES_APROBACION)[number];

export interface RolBandejaAprobacion {
  esAdmin: boolean;
  esRrhh: boolean;
  esJefe: boolean;
  esDirector: boolean;
}

export function puedeAccederBandejaAprobacion(roles: RolBandejaAprobacion): boolean {
  return roles.esAdmin || roles.esRrhh || roles.esJefe || roles.esDirector;
}

export function esEstadoAccionableAprobacion(estado: string): estado is EstadoAccionableAprobacion {
  return (ESTADOS_ACCIONABLES_APROBACION as readonly string[]).includes(estado);
}

export interface SolicitudBandejaInput {
  usuarioId: number;
  estado: string;
}

export function solicitudVisibleEnBandeja(
  solicitud: SolicitudBandejaInput,
  context: {
    sessionId: number;
    equipoIds: number[];
    roles: RolBandejaAprobacion;
  }
): boolean {
  if (solicitud.usuarioId === context.sessionId) return false;
  if (!esEstadoAccionableAprobacion(solicitud.estado)) return false;

  const opciones: boolean[] = [];

  if (context.roles.esJefe || context.roles.esDirector || context.roles.esAdmin) {
    if (
      solicitud.estado === 'pendiente_jefe' &&
      context.equipoIds.includes(solicitud.usuarioId)
    ) {
      opciones.push(true);
    }
    if (context.roles.esAdmin && solicitud.estado === 'pendiente_jefe') {
      opciones.push(true);
    }
  }

  if ((context.roles.esRrhh || context.roles.esAdmin) && solicitud.estado === 'aprobada_jefe') {
    opciones.push(true);
  }

  return opciones.some(Boolean);
}

export function determinarAccionAprobacion(
  tipoAccion: 'aprobar' | 'rechazar',
  estadoSolicitud: string
): string {
  if (!esEstadoAccionableAprobacion(estadoSolicitud)) {
    throw new Error('La solicitud ya no está pendiente de aprobación');
  }

  if (tipoAccion === 'rechazar') {
    if (estadoSolicitud === 'pendiente_jefe') return 'rechazar_jefe';
    return 'rechazar_rrhh';
  }

  if (estadoSolicitud === 'pendiente_jefe') return 'aprobar_jefe';
  return 'aprobar_rrhh';
}

export function etiquetaBotonAprobacion(estado: string): string {
  if (estado === 'aprobada_jefe') return 'Aprobar RRHH';
  return 'Aprobar';
}

export function etiquetaEstadoBandeja(estado: string): string {
  if (estado === 'pendiente_jefe') return 'Pend. Jefe';
  if (estado === 'aprobada_jefe') return 'Pend. RRHH';
  return estado;
}
