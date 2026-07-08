/**
 * Validaciones transversales al crear solicitudes (route + tests).
 */

export function esDirectorConFlujoVoBo(params: {
  esDirector: boolean;
  esSolicitudPropia: boolean;
  tipo: string;
}): boolean {
  if (!params.esDirector || !params.esSolicitudPropia) return false;
  if (params.tipo === 'dia_cumpleanos' || params.tipo === 'licencia_medica') return false;
  return true;
}

/**
 * VoBo obligatorio según flujo del director, tipo y duración del permiso de salida.
 * - permiso_salida 1-2h / medio día (2-4h): sin VoBo
 * - permiso_salida día completo: con VoBo si el flujo lo indica
 * - vacaciones: con VoBo si el flujo lo indica
 * - licencia_medica: solo constancia médica (sin VoBo)
 */
export function debeExigirVoBoMinistro(params: {
  requiereVoBoFlujo: boolean;
  tipo: string;
  duracionPermiso?: string | null;
}): boolean {
  if (!params.requiereVoBoFlujo) return false;
  if (params.tipo === 'permiso_salida') {
    return params.duracionPermiso === 'dia_completo';
  }
  return true;
}

export function requiereVoBoDirector(params: {
  esDirector: boolean;
  esSolicitudPropia: boolean;
  tipo: string;
  duracionPermiso?: string | null;
}): boolean {
  return (
    esDirectorConFlujoVoBo(params) &&
    debeExigirVoBoMinistro({
      requiereVoBoFlujo: true,
      tipo: params.tipo,
      duracionPermiso: params.duracionPermiso,
    })
  );
}

export function validarVoBoDirectorAdjunto(params: {
  esDirector: boolean;
  esSolicitudPropia: boolean;
  tipo: string;
  duracionPermiso?: string | null;
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
  duracionPermiso?: string | null;
  documentosAdjuntos?: unknown;
}): string | null {
  if (
    !requiereVoBoDirector({
      esDirector: params.esDirector,
      esSolicitudPropia: true,
      tipo: params.tipo,
      duracionPermiso: params.duracionPermiso,
    })
  ) {
    return null;
  }

  const adjuntos = Array.isArray(params.documentosAdjuntos) ? params.documentosAdjuntos : [];
  if (adjuntos.length === 0) {
    return 'Los Directores deben adjuntar obligatoriamente el correo con el VoBo del Ministro.';
  }

  return null;
}
