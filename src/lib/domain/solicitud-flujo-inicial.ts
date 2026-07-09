/**
 * Resolución del estado inicial y auto-aprobación al crear solicitudes.
 *
 * Fase 2: cuando el solicitante es un Jefe, el aprobador de segundo nivel
 * lo decide `resolverAprobadorSegundoNivel()` (Director o Secretario General).
 * Ya NO hay excepción hardcoded por nombre de departamento.
 */

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
 * Determina el estado inicial y campos de auto-aprobación al crear una solicitud.
 *
 * Reglas (Fase 2):
 *   - Director que solicita vacaciones → pendiente_rrhh (VoBo Ministro
 *     validado por RRHH).
 *   - Jefe (no Director) → pendiente_director o pendiente_secretario_general
 *     según `aprobadorSegundoNivelTipo`.
 *   - Empleado normal → pendiente_jefe.
 *
 * No auto-aprueba solicitudes de Jefe (la jerarquía institucional requiere
 * siempre una aprobación de segundo nivel).
 */
export function resolverFlujoInicialSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  aprobadorSegundoNivelTipo?: 'director' | 'secretario_general' | null;
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
    if (params.aprobadorSegundoNivelTipo === 'secretario_general') {
      return {
        estadoInicial: 'pendiente_secretario_general',
        metadataInicial: {
          flujoAprobacion: 'jefe_sin_director',
          aprobadorSegundoNivelTipo: 'secretario_general',
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
    metadataInicial: {},
  };
}