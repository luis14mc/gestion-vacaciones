import type { SessionUser } from '@/types';

interface SolicitudAdjuntosAcceso {
  usuarioId: number;
  aprobadaJefePor?: number | null;
  aprobadaDirectorPor?: number | null;
  aprobadaSecretarioPor?: number | null;
  aprobadaRrhhPor?: number | null;
}

/**
 * Determina si el usuario puede ver los adjuntos institucionales de una solicitud.
 */
export function puedeVerAdjuntosSolicitud(
  session: Pick<
    SessionUser,
    'id' | 'esAdmin' | 'esRrhh' | 'esJefe' | 'esDirector' | 'esSecretarioGeneral'
  > | null | undefined,
  solicitud: SolicitudAdjuntosAcceso
): boolean {
  if (!session) return false;
  if (solicitud.usuarioId === session.id) return true;
  if (session.esAdmin || session.esRrhh) return true;

  const participoEnFlujo =
    solicitud.aprobadaJefePor === session.id ||
    solicitud.aprobadaDirectorPor === session.id ||
    solicitud.aprobadaSecretarioPor === session.id ||
    solicitud.aprobadaRrhhPor === session.id;

  if (participoEnFlujo) return true;

  // Jefe/Director/SG activos en flujos de aprobación (bandeja).
  return Boolean(session.esJefe || session.esDirector || session.esSecretarioGeneral);
}
