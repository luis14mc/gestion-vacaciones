/**
 * Resolución del estado inicial y auto-aprobación al crear solicitudes.
 */

export const DEPARTAMENTO_DIRECCION_ADMINISTRATIVA = 'Dirección Administrativa';

export const FLUJO_ESPECIAL_JEFE_DIR_ADMIN =
  'jefe_direccion_administrativa_sin_director' as const;

export const COMENTARIO_JEFE_EXCEPCION_DIR_ADMIN =
  'Derivado directamente a RRHH por excepción temporal: Jefatura de Dirección Administrativa sin Director asignado.';

export type EstadoInicialSolicitud = 'aprobada_jefe' | 'pendiente_jefe';

export interface FlujoInicialSolicitud {
  estadoInicial: EstadoInicialSolicitud;
  autoAprobacionJefe?: {
    comentarioJefe: string;
  };
  metadataInicial: Record<string, unknown>;
}

export function normalizarNombreDepartamento(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function esDepartamentoDireccionAdministrativa(
  nombre: string | null | undefined
): boolean {
  if (!nombre) return false;
  return (
    normalizarNombreDepartamento(nombre) ===
    normalizarNombreDepartamento(DEPARTAMENTO_DIRECCION_ADMINISTRATIVA)
  );
}

/**
 * Determina el estado inicial y campos de auto-aprobación al crear una solicitud.
 *
 * Prioridad:
 * 1. Director → aprobada_jefe (flujo actual)
 * 2. Jefe en Dirección Administrativa → aprobada_jefe (excepción temporal sin Director)
 * 3. Resto → pendiente_jefe
 */
export function resolverFlujoInicialSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  departamentoNombre: string | null | undefined;
}): FlujoInicialSolicitud {
  if (params.esDirector) {
    return {
      estadoInicial: 'aprobada_jefe',
      autoAprobacionJefe: {
        comentarioJefe: 'Auto-aprobado (solicitud creada por Director)',
      },
      metadataInicial: {},
    };
  }

  if (
    params.esJefe &&
    esDepartamentoDireccionAdministrativa(params.departamentoNombre)
  ) {
    return {
      estadoInicial: 'aprobada_jefe',
      autoAprobacionJefe: {
        comentarioJefe: COMENTARIO_JEFE_EXCEPCION_DIR_ADMIN,
      },
      metadataInicial: {
        flujoEspecial: FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
        derivadoDirectoRrhh: true,
      },
    };
  }

  return {
    estadoInicial: 'pendiente_jefe',
    metadataInicial: {},
  };
}
