/**
 * Flujo de aprobación para nueva solicitud (UI + API).
 * Fuente única para no duplicar reglas en el frontend.
 *
 * Fase 2 (corrección): el aprobador sustituto es el Director del
 * departamento Secretaría General — no un rol/flag aparte.
 */
import { esDirectorConFlujoVoBo, debeExigirVoBoMinistro } from '@/lib/domain/solicitud-adjuntos';
import type {
  AprobadorInicialTipo,
  TipoAprobadorSegundoNivel,
} from '@/lib/domain/aprobadores';

export type FlujoEspecialNuevaSolicitud = never;

export type TipoAprobadorSegundoNivelUI = TipoAprobadorSegundoNivel;

export interface FlujoAprobacionNuevaSolicitud {
  requiereVoBoMinistro: boolean;
  requiereAprobacionJefe: boolean;
  requiereAprobacionDirector: boolean;
  /** Alias institucional: Director de Secretaría General (sustituto). */
  requiereAprobacionSecretariaGeneral: boolean;
  /** @deprecated Preferir requiereAprobacionSecretariaGeneral */
  requiereAprobacionSecretarioGeneral: boolean;
  pasaDirectoRrhh: boolean;
  flujoEspecial?: FlujoEspecialNuevaSolicitud;
  mensajeFlujo: string;
  pasosProceso: string[];
  aprobadorInicialTipo?: AprobadorInicialTipo | null;
  siguienteDespuesDeAprobacion?: 'rrhh' | null;
  aprobadorSegundoNivelTipo?: TipoAprobadorSegundoNivelUI | null;
  aprobadorSegundoNivelNombre?: string | null;
  aprobadorInicialId?: number | null;
  errorFlujo?: boolean;
}

const MENSAJE_DIRECTOR =
  'Como Director, debe adjuntar el VoBo del Ministro. La solicitud será revisada por Recursos Humanos.';

const MENSAJE_DIRECTOR_PERMISO_CORTO =
  'Su permiso de salida será revisado por Recursos Humanos. No se requiere VoBo del Ministro para permisos de 1–2 horas ni medio día.';

const MENSAJE_JEFE =
  'Su solicitud será revisada por su Director y luego pasará a Recursos Humanos.';

const MENSAJE_JEFE_SG =
  'Su departamento no tiene Director asignado. Su solicitud será revisada por el Director de Secretaría General y luego pasará a Recursos Humanos.';

const MENSAJE_EMPLEADO =
  'Su solicitud será revisada por su jefe superior y luego pasará a Recursos Humanos.';

const MENSAJE_CUMPLEANOS =
  'Su día libre por cumpleaños será revisado por su jefe y luego por Recursos Humanos.';

const PASO_NOTIFICACION = 'Notificación al solicitante';

/**
 * Resuelve el flujo de aprobación de una solicitud nueva (puro, sin BD).
 * Preferir `resolverFlujoAprobacionSolicitud` en aprobadores.ts para el
 * camino canónico con resolución de aprobadores.
 */
export function resolverFlujoAprobacionNuevaSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  aprobadorSegundoNivelTipo?: TipoAprobadorSegundoNivelUI | null;
  aprobadorSegundoNivelNombre?: string | null;
  aprobadorInicialId?: number | null;
  tipo?: string;
}): FlujoAprobacionNuevaSolicitud {
  const tipo = params.tipo ?? 'vacaciones';
  const esCumpleanos = tipo === 'dia_cumpleanos';

  if (esDirectorConFlujoVoBo({ esDirector: params.esDirector, esSolicitudPropia: true, tipo })) {
    return {
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      aprobadorInicialTipo: 'rrhh',
      siguienteDespuesDeAprobacion: null,
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
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      aprobadorInicialTipo: 'jefe',
      siguienteDespuesDeAprobacion: 'rrhh',
      mensajeFlujo: MENSAJE_CUMPLEANOS,
      pasosProceso: [
        'Aprobación de Jefe Inmediato / Director de Área',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  if (params.esJefe) {
    if (params.aprobadorSegundoNivelTipo === 'director_secretaria_general') {
      return {
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: true,
        requiereAprobacionSecretarioGeneral: true,
        pasaDirectoRrhh: false,
        mensajeFlujo: MENSAJE_JEFE_SG,
        aprobadorInicialTipo: 'director_secretaria_general',
        siguienteDespuesDeAprobacion: 'rrhh',
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
        aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
        aprobadorInicialId: params.aprobadorInicialId ?? null,
        pasosProceso: [
          'Aprobación del Director de Secretaría General (aprobador sustituto)',
          'Revisión y aprobación de Recursos Humanos',
          PASO_NOTIFICACION,
        ],
      };
    }
    return {
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: MENSAJE_JEFE,
      aprobadorInicialTipo: 'director',
      siguienteDespuesDeAprobacion: 'rrhh',
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: params.aprobadorSegundoNivelNombre ?? null,
      aprobadorInicialId: params.aprobadorInicialId ?? null,
      pasosProceso: [
        'Aprobación de Director de Área',
        'Revisión y aprobación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
    };
  }

  // Empleado normal: Jefe → RRHH (sin Director / Secretaría General).
  return {
    requiereVoBoMinistro: false,
    requiereAprobacionJefe: true,
    requiereAprobacionDirector: false,
    requiereAprobacionSecretariaGeneral: false,
    requiereAprobacionSecretarioGeneral: false,
    pasaDirectoRrhh: false,
    mensajeFlujo: MENSAJE_EMPLEADO,
    aprobadorInicialTipo: 'jefe',
    siguienteDespuesDeAprobacion: 'rrhh',
    aprobadorSegundoNivelTipo: null,
    aprobadorSegundoNivelNombre: null,
    aprobadorInicialId: params.aprobadorInicialId ?? null,
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
