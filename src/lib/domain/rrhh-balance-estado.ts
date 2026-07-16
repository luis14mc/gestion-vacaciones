import {
  mapBalanceRegistro,
  validarEcuacionBalance,
  type BalanceRegistroInput,
  type BalanceSaldo,
} from '@/lib/domain/balance-display';
import {
  calcularDiasAnualesPorAntiguedad,
  calcularDiasMensualesPorAntiguedad,
  calcularAntiguedadLaboral,
} from '@/lib/domain/vacaciones-asignacion';

export type EstadoAsignacionMesActual =
  | 'asignado'
  | 'pendiente'
  | 'no_aplica'
  | 'inconsistente';

export interface ValidacionBalanceInstitucional {
  consistente: boolean;
  diferencia: number;
  mensaje: string | null;
}

export function validarConsistenciaBalance(
  registro: BalanceRegistroInput
): ValidacionBalanceInstitucional {
  const saldo = mapBalanceRegistro(registro);
  const esperado =
    saldo.diasVencidos +
    saldo.diasProporcionales -
    saldo.diasUsados -
    saldo.diasPendientes;
  const diferencia = Math.round((saldo.diasDisponibles - esperado) * 10000) / 10000;
  const consistente = validarEcuacionBalance(saldo);

  return {
    consistente,
    diferencia,
    mensaje: consistente
      ? null
      : 'El balance no coincide con la regla institucional.',
  };
}

export interface ResolverEstadoAsignacionParams {
  activo: boolean;
  eliminado: boolean;
  fechaIngreso: string | null | undefined;
  tieneAsignacionMesActual: boolean;
  balanceConsistente: boolean;
  fechaReferencia?: Date;
}

export function resolverEstadoAsignacionMesActual(
  params: ResolverEstadoAsignacionParams
): EstadoAsignacionMesActual {
  if (!params.balanceConsistente) return 'inconsistente';
  if (!params.activo || params.eliminado) return 'no_aplica';
  if (!params.fechaIngreso) return 'no_aplica';

  const ref = params.fechaReferencia ?? new Date();
  const anios = calcularAntiguedadLaboral(params.fechaIngreso, ref);
  const diasMensuales = calcularDiasMensualesPorAntiguedad(params.fechaIngreso, ref);

  if (anios < 1 || diasMensuales <= 0) return 'no_aplica';
  if (params.tieneAsignacionMesActual) return 'asignado';
  return 'pendiente';
}

export function mapBalanceInstitucional(registro: BalanceRegistroInput): BalanceSaldo {
  return mapBalanceRegistro(registro);
}

export function reglaVacacionesDesdeIngreso(
  fechaIngreso: string | null | undefined,
  fechaReferencia: Date = new Date()
) {
  return {
    diasAnualesAplicables: calcularDiasAnualesPorAntiguedad(fechaIngreso, fechaReferencia),
    diasMensualesAplicables: calcularDiasMensualesPorAntiguedad(
      fechaIngreso,
      fechaReferencia
    ),
  };
}
