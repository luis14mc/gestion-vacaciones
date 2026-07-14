/**
 * Bandeja /aprobar-solicitudes — estados y reglas accionables.
 *
 * Fase 2 (corrección):
 *   - Empleado: Jefe → RRHH
 *   - Jefe: Director (o Dir. Secretaría General) → RRHH
 * Cada rol ve exclusivamente las solicitudes que le corresponde aprobar.
 */

export const ESTADOS_PENDIENTE_JEFE = ['pendiente_jefe'] as const;
export const ESTADOS_PENDIENTE_DIRECTOR = ['pendiente_director'] as const;
export const ESTADOS_PENDIENTE_SECRETARIO = ['pendiente_secretario_general'] as const;
export const ESTADOS_PENDIENTE_RRHH = ['pendiente_rrhh', 'aprobada_jefe'] as const;

export const ESTADOS_ACCIONABLES_APROBACION = [
  ...ESTADOS_PENDIENTE_JEFE,
  ...ESTADOS_PENDIENTE_DIRECTOR,
  ...ESTADOS_PENDIENTE_SECRETARIO,
  ...ESTADOS_PENDIENTE_RRHH,
] as const;

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
  return (ESTADOS_ACCIONABLES_APROBACION as readonly string[]).includes(estado as any);
}

export interface SolicitudBandejaInput {
  usuarioId: number;
  estado: string;
}

/**
 * Determina si una solicitud debe aparecer en la bandeja de aprobación del
 * usuario de la sesión. Reglas (Fase 2 corrección):
 *   - Jefe/Director: ve `pendiente_jefe` de su equipo directo.
 *   - Director: ve `pendiente_director` cuando él es el aprobador esperado.
 *   - Director de Secretaría General: ve `pendiente_secretario_general`
 *     asignadas a él como sustituto (filtrado por query SQL).
 *   - RRHH/Admin: ve `pendiente_rrhh` y legacy `aprobada_jefe`.
 *   - Nunca ve sus propias solicitudes.
 */
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

  // RRHH / Admin: solo lo que ya pasó al tramo de RRHH.
  if (context.roles.esRrhh || context.roles.esAdmin) {
    if (
      solicitud.estado === 'pendiente_rrhh' ||
      solicitud.estado === 'aprobada_jefe' // legacy
    ) {
      return true;
    }
  }

  // Admin bypass para jefe/director/sg pendiente.
  if (context.roles.esAdmin) {
    if (solicitud.estado === 'pendiente_jefe') return true;
    if (solicitud.estado === 'pendiente_director') return true;
    if (solicitud.estado === 'pendiente_secretario_general') return true;
  }

  // Jefe: solo pendiente_jefe de su equipo directo.
  if (
    (context.roles.esJefe || context.roles.esDirector) &&
    solicitud.estado === 'pendiente_jefe' &&
    context.equipoIds.includes(solicitud.usuarioId)
  ) {
    return true;
  }

  // Director: pendiente_director se filtra por query SQL.
  if (context.roles.esDirector && solicitud.estado === 'pendiente_director') {
    return true;
  }

  // Director de Secretaría General (sustituto): filtrado por query SQL
  // vía aprobadaSecretarioPor. Es un Director del depto Secretaría General.
  if (context.roles.esDirector && solicitud.estado === 'pendiente_secretario_general') {
    return true;
  }

  return false;
}

/**
 * Determina la acción backend correspondiente al botón "Aprobar" / "Rechazar"
 * según el estado actual.
 */
export function determinarAccionAprobacion(
  tipoAccion: 'aprobar' | 'rechazar',
  estadoSolicitud: string
): string {
  if (!esEstadoAccionableAprobacion(estadoSolicitud)) {
    throw new Error('La solicitud ya no está pendiente de aprobación');
  }

  if (tipoAccion === 'rechazar') {
    if (estadoSolicitud === 'pendiente_jefe') return 'rechazar_jefe';
    if (estadoSolicitud === 'pendiente_director') return 'rechazar_director';
    if (estadoSolicitud === 'pendiente_secretario_general')
      return 'rechazar_secretario_general';
    return 'rechazar_rrhh';
  }

  if (estadoSolicitud === 'pendiente_jefe') return 'aprobar_jefe';
  if (estadoSolicitud === 'pendiente_director') return 'aprobar_director';
  if (estadoSolicitud === 'pendiente_secretario_general')
    return 'aprobar_secretario_general';
  return 'aprobar_rrhh';
}

export function etiquetaBotonAprobacion(estado: string): string {
  if (estado === 'pendiente_rrhh' || estado === 'aprobada_jefe') return 'Aprobar RRHH';
  if (estado === 'pendiente_director') return 'Aprobar Director';
  if (estado === 'pendiente_secretario_general') return 'Aprobar Dir. Sec. General';
  return 'Aprobar';
}

export function etiquetaEstadoBandeja(estado: string): string {
  if (estado === 'pendiente_jefe') return 'Pend. Jefe';
  if (estado === 'pendiente_director') return 'Pend. Director';
  if (estado === 'pendiente_secretario_general') return 'Pend. Dir. Sec. General';
  if (estado === 'pendiente_rrhh') return 'Pend. RRHH';
  if (estado === 'aprobada_jefe') return 'Pend. RRHH';
  return estado;
}
