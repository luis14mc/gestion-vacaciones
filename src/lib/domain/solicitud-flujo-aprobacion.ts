/**
 * Flujo de aprobación para nueva solicitud (UI + API).
 * Fuente única para no duplicar reglas en el frontend.
 */

import { esDirectorConFlujoVoBo, debeExigirVoBoMinistro } from '@/lib/domain/solicitud-adjuntos';
import {
  FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
  esDepartamentoDireccionAdministrativa,
} from '@/lib/domain/solicitud-flujo-inicial';

export type FlujoEspecialNuevaSolicitud = typeof FLUJO_ESPECIAL_JEFE_DIR_ADMIN;

export interface FlujoAprobacionNuevaSolicitud {
  requiereVoBoMinistro: boolean;
  requiereAprobacionJefe: boolean;
  requiereAprobacionDirector: boolean;
  pasaDirectoRrhh: boolean;
  flujoEspecial?: FlujoEspecialNuevaSolicitud;
  mensajeFlujo: string;
  pasosProceso: string[];
}

const MENSAJE_JEFE_DIR_ADMIN =
  'Esta solicitud será derivada directamente a Recursos Humanos por excepción temporal: Jefatura de Dirección Administrativa sin Director asignado.';

const MENSAJE_DIRECTOR =
  'Como Director, debe adjuntar el VoBo del Ministro. La solicitud será revisada por Recursos Humanos.';

const MENSAJE_DIRECTOR_PERMISO_CORTO =
  'Su permiso de salida será revisado por Recursos Humanos. No se requiere VoBo del Ministro para permisos de 1–2 horas ni medio día.';

const MENSAJE_JEFE =
  'Su solicitud será enviada al Director de Área para aprobación y luego a Recursos Humanos.';

const MENSAJE_EMPLEADO =
  'Su solicitud será enviada a su jefe inmediato para aprobación y luego a Recursos Humanos.';

const MENSAJE_CUMPLEANOS =
  'Su día libre por cumpleaños será revisado por su jefe o director y luego por Recursos Humanos.';

const PASO_NOTIFICACION = 'Notificación al solicitante';

export function resolverFlujoAprobacionNuevaSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  departamentoNombre: string | null | undefined;
  tipo?: string;
}): FlujoAprobacionNuevaSolicitud {
  const tipo = params.tipo ?? 'vacaciones';
  const esCumpleanos = tipo === 'dia_cumpleanos';

  const esJefeDirAdmin =
    params.esJefe &&
    !params.esDirector &&
    esDepartamentoDireccionAdministrativa(params.departamentoNombre);

  if (esJefeDirAdmin && !esCumpleanos) {
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      pasaDirectoRrhh: true,
      flujoEspecial: FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
      mensajeFlujo: MENSAJE_JEFE_DIR_ADMIN,
      pasosProceso: [
        'Derivación directa a Recursos Humanos por excepción temporal',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  if (esDirectorConFlujoVoBo({ esDirector: params.esDirector, esSolicitudPropia: true, tipo })) {
    return {
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_DIRECTOR,
      pasosProceso: [
        'VoBo Ministro (Mediante documento adjunto)',
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
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_JEFE,
      pasosProceso: [
        'Aprobación de Director de Área',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  return {
    requiereVoBoMinistro: false,
    requiereAprobacionJefe: true,
    requiereAprobacionDirector: false,
    pasaDirectoRrhh: false,
    mensajeFlujo: MENSAJE_EMPLEADO,
    pasosProceso: [
      'Aprobación de Jefe Inmediato',
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
