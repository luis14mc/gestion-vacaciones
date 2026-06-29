/**
 * Validaciones transversales al crear solicitudes (route + tests).
 */

export function requiereVoBoDirector(params: {
  esDirector: boolean;
  esSolicitudPropia: boolean;
  tipo: string;
}): boolean {
  return params.esDirector && params.esSolicitudPropia && params.tipo !== 'dia_cumpleanos';
}

export function validarVoBoDirectorAdjunto(params: {
  esDirector: boolean;
  esSolicitudPropia: boolean;
  tipo: string;
  documentosAdjuntos?: unknown;
}): string | null {
  if (!requiereVoBoDirector(params)) return null;

  const adjuntos = Array.isArray(params.documentosAdjuntos) ? params.documentosAdjuntos : [];
  const tieneVoBo = adjuntos.some(
    (a) =>
      a &&
      typeof a === 'object' &&
      (a as { nombre?: string; data?: string }).nombre === 'vobo_ministro' &&
      typeof (a as { data?: string }).data === 'string' &&
      ((a as { data?: string }).data?.length ?? 0) > 0
  );

  if (!tieneVoBo) {
    return 'Para Directores es obligatorio adjuntar el VoBo del Ministro.';
  }

  return null;
}

export function validarVoBoDirectorService(params: {
  esDirector: boolean;
  tipo: string;
  documentosAdjuntos?: unknown;
}): string | null {
  if (!params.esDirector || params.tipo === 'dia_cumpleanos') return null;

  const adjuntos = Array.isArray(params.documentosAdjuntos) ? params.documentosAdjuntos : [];
  if (adjuntos.length === 0) {
    return 'Los Directores deben adjuntar obligatoriamente el correo con el VoBo del Ministro.';
  }

  return null;
}
