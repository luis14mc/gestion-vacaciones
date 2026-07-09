/**
 * Flujo de aprobación para nueva solicitud (UI + API).
 * Fuente única para no duplicar reglas en el frontend.
 *
 * Fase 2: se incorpora la figura del Secretario General como aprobador
 * sustituto del Director de Área.
 */
import { esDirectorConFlujoVoBo, debeExigirVoBoMinistro } from '@/lib/domain/solicitud-adjuntos';

export type FlujoEspecialNuevaSolicitud = never;

export type TipoAprobadorSegundoNivelUI = 'director' | 'secretario_general';

export interface FlujoAprobacionNuevaSolicitud {
  requiereVoBoMinistro: boolean;
  requiereAprobacionJefe: boolean;
  requiereAprobacionDirector: boolean;
  requiereAprobacionSecretarioGeneral: boolean;
  pasaDirectoRrhh: boolean;
  flujoEspecial?: FlujoEspecialNuevaSolicitud;
  mensajeFlujo: string;
  pasosProceso: string[];
  aprobadorSegundoNivelTipo?: TipoAprobadorSegundoNivelUI | null;
  aprobadorSegundoNivelNombre?: string | null;
}

const MENSAJE_DIRECTOR =
  'Como Director, debe adjuntar el VoBo del Ministro. La solicitud será revisada por Recursos Humanos.';

const MENSAJE_DIRECTOR_PERMISO_CORTO =
  'Su permiso de salida será revisado por Recursos Humanos. No se requiere VoBo del Ministro para permisos de 1–2 horas ni medio día.';

const MENSAJE_JEFE =
  'Su solicitud será enviada al Director de Área para aprobación y luego a Recursos Humanos.';

const MENSAJE_JEFE_SG =
  'Esta Dirección no tiene Director activo o asignado. Luego de la aprobación de su jefe inmediato, la solicitud pasará al Secretario General.';

const MENSAJE_EMPLEADO =
  'Su solicitud será enviada a su jefe inmediato para aprobación y luego a Recursos Humanos.';

const MENSAJE_EMPLEADO_SG =
  'Esta Dirección no tiene Director activo o asignado. Luego de la aprobación de su jefe inmediato, la solicitud pasará al Secretario General.';

const MENSAJE_CUMPLEANOS =
  'Su día libre por cumpleaños será revisado por su jefe o director y luego por Recursos Humanos.';

const PASO_NOTIFICACION = 'Notificación al solicitante';

/**
 * Resuelve el flujo de aprobación de una solicitud nueva.
 *
 * @param params.esDirector               Solicitante es Director.
 * @param params.esJefe                   Solicitante es Jefe (no Director).
 * @param params.aprobadorSegundoNivelTipo Tipo del aprobador de segundo nivel
 *                                          cuando el solicitante es Jefe.
 * @param params.aprobadorSegundoNivelNombre Nombre humano del aprobador.
 * @param params.tipo                     Tipo de solicitud.
 */
export function resolverFlujoAprobacionNuevaSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  aprobadorSegundoNivelTipo?: TipoAprobadorSegundoNivelUI | null;
  aprobadorSegundoNivelNombre?: string | null;
  tipo?: string;
}): FlujoAprobacionNuevaSolicitud {
  const tipo = params.tipo ?? 'vacaciones';
  const esCumpleanos = tipo === 'dia_cumpleanos';

  if (esDirectorConFlujoVoBo({ esDirector: params.esDirector, esSolicitudPropia: true, tipo })) {
    return {
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      mensajeFlujo: MENSAJE_DIRECTOR,
      pasosProceso: [
        'VoBo Ministro (mediante documento adjunto)',
        'Revisión y validación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  if (esCumpleanos) {
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_CUMPLEANOS,
      pasosProceso: [
        'Aprobación de Jefe Inmediato / Director de Área',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  if (params.esJefe) {
    if (params.aprobadorSegundoNivelTipo === 'secretario_general') {
      return {
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretarioGeneral: true,
        pasaDirectoRrhh: false,
        mensajeFlujo: MENSAJE_JEFE_SG,
        aprobadorSegundoNivelTipo: 'secretario_general',
        aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
        pasosProceso: [
          'Aprobación de Secretario General (aprobador sustituto)',
          'Revisión y aprobación de Recursos Humanos',
          PASO_NOTIFICACION,
        ],
      };
    }
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_JEFE,
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
      pasosProceso: [
        'Aprobación de Director de Área',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  // Empleado normal
  if (params.aprobadorSegundoNivelTipo === 'secretario_general') {
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: true,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_EMPLEADO_SG,
      aprobadorSegundoNivelTipo: 'secretario_general',
      aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
      pasosProceso: [
        'Aprobación de Jefe Inmediato',
        'Aprobación de Secretario General (aprobador sustituto)',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  return {
    requiereVoBoMinistro: false,
    requiereAprobacionJefe: true,
    requiereAprobacionDirector: false,
    requiereAprobacionSecretarioGeneral: false,
    pasaDirectoRrhh: false,
    mensajeFlujo: MENSAJE_EMPLEADO,
    aprobadorSegundoNivelTipo: 'director',
    aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
    pasosProceso: [
      'Aprobación de Jefe Inmediato',
      'Aprobación de Director de Área',
      'Revisión y aprobación de Recursos Humanos',
      PASO_NOTIFICACION,
    ],
  };
}

/** Mensaje de flujo según tipo y duración (VoBo condicionado en permiso de salida). */
export function mensajeFlujoVisible(params: {
  flujo: FlujoAprobacionNuevaSolicitud | null | undefined;
  tipo: string;
  duracionPermiso?: string | null;
}): string | undefined {
  if (!params.flujo?.mensajeFlujo) return undefined;

  const exigeVoBo = debeExigirVoBoMinistro({
    requiereVoBoFlujo: params.flujo.requiereVoBoMinistro,
    tipo: params.tipo,
    duracionPermiso: params.duracionPermiso,
  });

  if (params.flujo.requiereVoBoMinistro && params.tipo === 'permiso_salida' && !exigeVoBo) {
    return MENSAJE_DIRECTOR_PERMISO_CORTO;
  }

  return params.flujo.mensajeFlujo;
}