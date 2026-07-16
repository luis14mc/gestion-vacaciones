import type { SessionUser } from '@/types';

export interface SolicitudAdjuntosAcceso {
  usuarioId: number;
  aprobadaJefePor?: number | null;
  aprobadaDirectorPor?: number | null;
  aprobadaSecretarioPor?: number | null;
  aprobadaRrhhPor?: number | null;
}

interface AdjuntoAcceso {
  uploadedBy?: number | null;
}

function participoEnFlujoAprobacion(
  sessionId: number,
  solicitud: SolicitudAdjuntosAcceso
): boolean {
  return (
    solicitud.aprobadaJefePor === sessionId ||
    solicitud.aprobadaDirectorPor === sessionId ||
    solicitud.aprobadaSecretarioPor === sessionId ||
    solicitud.aprobadaRrhhPor === sessionId
  );
}

function tieneRolAprobadorActivo(
  session: Pick<
    SessionUser,
    'esJefe' | 'esDirector' | 'esSecretarioGeneral'
  >
): boolean {
  return Boolean(session.esJefe || session.esDirector || session.esSecretarioGeneral);
}

export function usuarioSubioAdjunto(
  sessionId: number,
  adjunto: AdjuntoAcceso | null | undefined
): boolean {
  return (
    typeof adjunto?.uploadedBy === 'number' && adjunto.uploadedBy === sessionId
  );
}

export function usuarioSubioAlgúnAdjunto(
  sessionId: number,
  documentosAdjuntos: unknown
): boolean {
  if (!Array.isArray(documentosAdjuntos)) return false;
  return documentosAdjuntos.some((a) =>
    usuarioSubioAdjunto(sessionId, a as AdjuntoAcceso)
  );
}

/**
 * Determina si el usuario puede ver la sección de adjuntos institucionales.
 */
export function puedeVerAdjuntosSolicitud(
  session: Pick<
    SessionUser,
    'id' | 'esAdmin' | 'esRrhh' | 'esJefe' | 'esDirector' | 'esSecretarioGeneral'
  > | null | undefined,
  solicitud: SolicitudAdjuntosAcceso,
  documentosAdjuntos?: unknown
): boolean {
  if (!session) return false;
  if (solicitud.usuarioId === session.id) return true;
  if (session.esAdmin || session.esRrhh) return true;
  if (usuarioSubioAlgúnAdjunto(session.id, documentosAdjuntos)) return true;
  if (participoEnFlujoAprobacion(session.id, solicitud)) return true;
  return tieneRolAprobadorActivo(session);
}

export interface EvaluacionAccesoAdjunto {
  autorizado: boolean;
  visualizadorEsSolicitante: boolean;
  visualizadorEsUploader: boolean;
  visualizadorEsAprobador: boolean;
  uploadedBy?: number;
}

/**
 * Evalúa acceso a un adjunto concreto (visor + auditoría).
 */
export function evaluarAccesoAdjuntoInstitucional(params: {
  session: Pick<
    SessionUser,
    'id' | 'esAdmin' | 'esRrhh' | 'esJefe' | 'esDirector' | 'esSecretarioGeneral'
  >;
  solicitud: SolicitudAdjuntosAcceso;
  adjunto: AdjuntoAcceso;
  enBandejaAprobacion?: boolean;
}): EvaluacionAccesoAdjunto {
  const { session, solicitud, adjunto, enBandejaAprobacion = false } = params;

  const visualizadorEsSolicitante = solicitud.usuarioId === session.id;
  const uploadedBy =
    typeof adjunto.uploadedBy === 'number' ? adjunto.uploadedBy : undefined;
  const visualizadorEsUploader = uploadedBy === session.id;
  const esRrhhAdmin = session.esAdmin || session.esRrhh;
  const visualizadorEsAprobador =
    enBandejaAprobacion ||
    participoEnFlujoAprobacion(session.id, solicitud) ||
    tieneRolAprobadorActivo(session) ||
    esRrhhAdmin;

  const autorizado =
    visualizadorEsSolicitante ||
    visualizadorEsUploader ||
    visualizadorEsAprobador;

  return {
    autorizado,
    visualizadorEsSolicitante,
    visualizadorEsUploader,
    visualizadorEsAprobador,
    uploadedBy,
  };
}
