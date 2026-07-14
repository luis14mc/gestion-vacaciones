/**
 * Resolución del estado inicial y auto-aprobación al crear solicitudes.
 *
 * Fase 2 (corrección):
 *   - Empleado → pendiente_jefe (luego RRHH; sin Director).
 *   - Jefe con Director → pendiente_director.
 *   - Jefe sin Director → pendiente_secretario_general
 *     (aprobador = Director de Secretaría General).
 *   - Director → pendiente_rrhh (VoBo Ministro).
 */

import type { TipoAprobadorSegundoNivel } from '@/lib/domain/aprobadores';

export type EstadoInicialSolicitud =
  | 'aprobada_jefe'
  | 'pendiente_jefe'
  | 'pendiente_director'
  | 'pendiente_secretario_general'
  | 'pendiente_rrhh';

export interface FlujoInicialSolicitud {
  estadoInicial: EstadoInicialSolicitud;
  autoAprobacionJefe?: {
    comentarioJefe: string;
  };
  metadataInicial: Record<string, unknown>;
}

/**
 * Determina el estado inicial al crear una solicitud.
 */
export function resolverFlujoInicialSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  aprobadorSegundoNivelTipo?: TipoAprobadorSegundoNivel | null;
}): FlujoInicialSolicitud {
  if (params.esDirector) {
    return {
      estadoInicial: 'pendiente_rrhh',
      metadataInicial: {
        flujoAprobacion: 'director_con_vobo_ministro',
        requiereVoBoMinistro: true,
      },
    };
  }

  if (params.esJefe) {
    if (params.aprobadorSegundoNivelTipo === 'director_secretaria_general') {
      return {
        estadoInicial: 'pendiente_secretario_general',
        metadataInicial: {
          flujoAprobacion: 'jefe_sin_director',
          aprobadorSegundoNivelTipo: 'director_secretaria_general',
        },
      };
    }
    return {
      estadoInicial: 'pendiente_director',
      metadataInicial: {
        flujoAprobacion: 'jefe_estandar',
        aprobadorSegundoNivelTipo: 'director',
      },
    };
  }

  return {
    estadoInicial: 'pendiente_jefe',
    metadataInicial: {
      flujoAprobacion: 'empleado_jefe_rrhh',
    },
  };
}
