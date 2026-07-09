/**
 * Helper central de requisitos de adjuntos por solicitud (Fase 3).
 *
 * Política CNI (VoBo obligatorio por auditoría institucional):
 *   - Empleado normal       → vobo_jefe
 *   - Jefe                  → vobo_director o vobo_secretario_general
 *                             (según disponibilidad del Director).
 *   - Director              → vobo_ministro.
 *   - Secretario General    → vobo_ministro (no se autoaprueba).
 *   - Licencia médica       → constancia_medica + el VoBo del rol/flujo.
 *
 * El frontend consume el resultado de este helper desde
 * GET /api/solicitudes/flujo-aprobacion — no debe duplicar reglas.
 */
import { esDirectorConFlujoVoBo, debeExigirVoBoMinistro } from '@/lib/domain/solicitud-adjuntos';

export type TipoAdjunto =
  | 'vobo_jefe'
  | 'vobo_director'
  | 'vobo_secretario_general'
  | 'vobo_ministro'
  | 'constancia_medica';

export interface AdjuntoRequerido {
  tipo: TipoAdjunto;
  etiqueta: string;
  /** Mensaje legible para mostrar cuando falta el adjunto. */
  mensajeFaltante: string;
  obligatorio: boolean;
  /** Sugerencia del tipo MIME aceptado (solo PDF o imágenes). */
  acepta?: string;
}

export interface RequisitosAdjuntos {
  requiereVoBo: boolean;
  tipoVoBoRequerido: TipoAdjunto | null;
  etiquetaVoBo: string | null;
  requiereConstanciaMedica: boolean;
  adjuntosRequeridos: AdjuntoRequerido[];
}

export const ETIQUETAS_ADJUNTO: Record<TipoAdjunto, { etiqueta: string; mensajeFaltante: string }> = {
  vobo_jefe: {
    etiqueta: 'VoBo del Jefe inmediato',
    mensajeFaltante: 'Debe adjuntar el VoBo del Jefe inmediato.',
  },
  vobo_director: {
    etiqueta: 'VoBo del Director de Área',
    mensajeFaltante: 'Debe adjuntar el VoBo del Director de Área.',
  },
  vobo_secretario_general: {
    etiqueta: 'VoBo del Secretario General',
    mensajeFaltante: 'Debe adjuntar el VoBo del Secretario General.',
  },
  vobo_ministro: {
    etiqueta: 'VoBo del Ministro',
    mensajeFaltante: 'Debe adjuntar el VoBo del Ministro.',
  },
  constancia_medica: {
    etiqueta: 'Constancia médica',
    mensajeFaltante: 'Debe adjuntar la constancia médica.',
  },
};

/**
 * Determina el VoBo de segundo nivel (Director o SG) esperado para un
 * Jefe. Si el flujo ya resolvió `aprobadorSegundoNivelTipo`, se usa esa
 * señal para evitar recalcular.
 */
function tipoVoBoParaJefe(
  aprobadorSegundoNivelTipo: 'director' | 'secretario_general' | null
): TipoAdjunto {
  return aprobadorSegundoNivelTipo === 'secretario_general'
    ? 'vobo_secretario_general'
    : 'vobo_director';
}

/**
 * Resuelve los adjuntos requeridos para la solicitud.
 *
 * No requiere BD; consume solo los flags del solicitante y la decisión
 * del flujo. La coherencia con el backend es contractual: cualquier
 * cambio debe replicarse aquí Y en `validarAdjuntosObligatorios`.
 */
export function resolverRequisitosAdjuntosSolicitud(params: {
  /** Solicitante (usuario que crea la solicitud). */
  usuarioSolicitante: {
    esDirector: boolean;
    esJefe: boolean;
    esSecretarioGeneral?: boolean;
  };
  /** Tipo de la solicitud (vacaciones, permiso_salida, etc.). */
  tipoSolicitud: string;
  /** Solo aplica a permiso_salida. */
  duracionPermiso?: string | null;
  /** Resultado del flujo institucional (aprobador de segundo nivel esperado). */
  flujoAprobacion: {
    requiereVoBoMinistro: boolean;
    aprobadorSegundoNivelTipo?: 'director' | 'secretario_general' | null;
  };
  fechaInicio?: string | null;
  fechaFin?: string | null;
}): RequisitosAdjuntos {
  const { usuarioSolicitante, tipoSolicitud, duracionPermiso, flujoAprobacion } = params;
  const esLicenciaMedica = tipoSolicitud === 'licencia_medica';
  const exigeVoBoMinistro = debeExigirVoBoMinistro({
    requiereVoBoFlujo: flujoAprobacion.requiereVoBoMinistro,
    tipo: tipoSolicitud,
    duracionPermiso,
  });

  const adjuntosRequeridos: AdjuntoRequerido[] = [];

  // 1. Determinar VoBo institucional por rol del solicitante.
  let tipoVoBo: TipoAdjunto | null = null;

  if (usuarioSolicitante.esSecretarioGeneral) {
    // Secretario General NO se autoaprueba: VoBo del Ministro.
    tipoVoBo = 'vobo_ministro';
  } else if (usuarioSolicitante.esDirector) {
    if (
      esDirectorConFlujoVoBo({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: tipoSolicitud,
      }) &&
      exigeVoBoMinistro
    ) {
      tipoVoBo = 'vobo_ministro';
    }
    // Si el Director está en un tipo que NO requiere VoBo (cumple, permiso
    // 1-2h/2-4h, etc.), no se exige ningún VoBo adicional más allá del
    // flujo. Si requiere VoBo por licencia médica, la lógica de
    // licencia médica a continuación lo agrega.
  } else if (usuarioSolicitante.esJefe) {
    tipoVoBo = tipoVoBoParaJefe(flujoAprobacion.aprobadorSegundoNivelTipo ?? null);
  } else {
    // Empleado normal.
    tipoVoBo = 'vobo_jefe';
  }

  // Director con licencia médica: VoBo también aplica aunque su tipo
  // esté excluido de la regla de duración.
  if (usuarioSolicitante.esDirector && esLicenciaMedica && !tipoVoBo) {
    tipoVoBo = 'vobo_ministro';
  }

  if (tipoVoBo) {
    const meta = ETIQUETAS_ADJUNTO[tipoVoBo];
    adjuntosRequeridos.push({
      tipo: tipoVoBo,
      etiqueta: meta.etiqueta,
      mensajeFaltante: meta.mensajeFaltante,
      obligatorio: true,
      acepta: '.pdf,image/*',
    });
  }

  // 2. Licencia médica: constancia adicional.
  let requiereConstanciaMedica = false;
  if (esLicenciaMedica) {
    requiereConstanciaMedica = true;
    const meta = ETIQUETAS_ADJUNTO.constancia_medica;
    adjuntosRequeridos.push({
      tipo: 'constancia_medica',
      etiqueta: meta.etiqueta,
      mensajeFaltante: meta.mensajeFaltante,
      obligatorio: true,
      acepta: '.pdf,image/*',
    });
  }

  return {
    requiereVoBo: tipoVoBo != null,
    tipoVoBoRequerido: tipoVoBo,
    etiquetaVoBo: tipoVoBo ? ETIQUETAS_ADJUNTO[tipoVoBo].etiqueta : null,
    requiereConstanciaMedica,
    adjuntosRequeridos,
  };
}

/**
 * Etiqueta legible de un adjunto por su tipo.
 */
export function etiquetaAdjunto(tipo: string): string {
  if (tipo in ETIQUETAS_ADJUNTO) {
    return ETIQUETAS_ADJUNTO[tipo as TipoAdjunto].etiqueta;
  }
  return tipo;
}

/**
 * Valida que los adjuntos provistos cubran todos los obligatorios.
 * Devuelve el mensaje del primer adjunto faltante o null si todo está OK.
 */
export function validarAdjuntosObligatorios(params: {
  requisitos: RequisitosAdjuntos;
  documentosAdjuntos: unknown;
}): string | null {
  if (!params.requisitos.adjuntosRequeridos.length) return null;
  const adjuntos = Array.isArray(params.documentosAdjuntos)
    ? (params.documentosAdjuntos as Array<{ tipo?: string; nombre?: string }>)
    : [];

  for (const req of params.requisitos.adjuntosRequeridos) {
    if (!req.obligatorio) continue;
    const tiene = adjuntos.some((a) => {
      const tipo = (a?.tipo ?? a?.nombre) as string | undefined;
      return tipo === req.tipo;
    });
    if (!tiene) return req.mensajeFaltante;
  }
  return null;
}

/**
 * Helper de compatibilidad: adjuntos antiguos solo traían `nombre`.
 * Si llega un adjunto con `nombre` pero sin `tipo`, se le asigna el tipo
 * por convención histórica (vobo_ministro / constancia_medica).
 * Esto preserva el render del visor y el backend existente.
 */
export function normalizarAdjuntosHistoricos(
  adjuntos: unknown
): Array<{ tipo: string; nombre: string; data: string }> {
  if (!Array.isArray(adjuntos)) return [];
  return adjuntos
    .filter((a: any) => a && typeof a === 'object' && typeof a.data === 'string')
    .map((a: any) => {
      const tipo =
        (typeof a.tipo === 'string' && a.tipo) ||
        (typeof a.nombre === 'string'
          ? a.nombre
          : 'adjunto_sin_tipo');
      const nombre = typeof a.nombre === 'string' ? a.nombre : tipo;
      return {
        tipo,
        nombre,
        data: a.data as string,
        mimeType: typeof a.mimeType === 'string' ? a.mimeType : undefined,
        size: typeof a.size === 'number' ? a.size : undefined,
        uploadedAt: typeof a.uploadedAt === 'string' ? a.uploadedAt : undefined,
        uploadedBy: typeof a.uploadedBy === 'number' ? a.uploadedBy : undefined,
      };
    });
}