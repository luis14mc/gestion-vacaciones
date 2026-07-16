/** Estados finales por rechazo antes de llegar a RRHH (BLOQUE 3). */
export const ESTADOS_RECHAZO_PREVIO_RRHH = [
  'rechazada_jefe',
  'rechazada_director',
  'rechazada_secretario_general',
] as const;

export type EstadoRechazoPrevioRRHH = (typeof ESTADOS_RECHAZO_PREVIO_RRHH)[number];

export const ESTADOS_RECHAZO_TODOS = [
  ...ESTADOS_RECHAZO_PREVIO_RRHH,
  'rechazada_rrhh',
] as const;

export function esRechazoPrevioRRHH(estado: string): estado is EstadoRechazoPrevioRRHH {
  return (ESTADOS_RECHAZO_PREVIO_RRHH as readonly string[]).includes(estado);
}

export function esEstadoRechazado(estado: string): boolean {
  return (ESTADOS_RECHAZO_TODOS as readonly string[]).includes(estado);
}

/** Nivel institucional legible a partir del estado de rechazo. */
export function nivelRechazoDesdeEstado(estado: string): string | null {
  switch (estado) {
    case 'rechazada_jefe':
      return 'Jefe inmediato';
    case 'rechazada_director':
      return 'Director de Área';
    case 'rechazada_secretario_general':
      return 'Director de Secretaría General';
    case 'rechazada_rrhh':
      return 'Recursos Humanos';
    default:
      return null;
  }
}

export function nivelRechazoAuditoriaDesdeEstado(estado: string): string | null {
  switch (estado) {
    case 'rechazada_jefe':
      return 'jefe';
    case 'rechazada_director':
      return 'director';
    case 'rechazada_secretario_general':
      return 'secretario_general';
    case 'rechazada_rrhh':
      return 'rrhh';
    default:
      return null;
  }
}
