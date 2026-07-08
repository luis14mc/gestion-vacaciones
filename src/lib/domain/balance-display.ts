import { formatDate } from '@/lib/utils/date-format';

/**
 * Mapper único para saldos de vacaciones (regla institucional CNI).
 *
 * - Días vencidos       → cantidad_inicial
 * - Días proporcionales → cantidad_acumulada
 * - Días asignados      → cantidad_inicial + cantidad_acumulada
 * - Días usados         → cantidad_usada
 * - Días pendientes     → cantidad_pendiente
 * - Días disponibles    → cantidad_disponible
 *
 * Validación: disponibles = vencidos + proporcionales − usados − pendientes
 */

export interface BalanceSaldo {
  diasVencidos: number;
  diasProporcionales: number;
  diasAsignados: number;
  diasUsados: number;
  diasPendientes: number;
  diasDisponibles: number;
}

export interface BalanceDiasFila extends BalanceSaldo {
  colaborador: string;
  fechaIngreso: string;
}

export interface BalanceHistorialUsuario extends BalanceSaldo {
  usuario: string;
}

export interface BalanceRegistroInput {
  cantidadInicial?: string | number | null;
  cantidadAcumulada?: string | number | null;
  cantidadUsada?: string | number | null;
  cantidadPendiente?: string | number | null;
  cantidadDisponible?: string | number | null;
}

const TOLERANCIA_ECUCION = 0.02;

function toNum(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** @deprecated Usar formatDate de @/lib/utils/date-format */
export function formatFechaIngreso(iso: string | null | undefined): string {
  return formatDate(iso);
}

export function formatDias(value: number): string {
  return value.toFixed(2);
}

/** Mapea columnas de balances a saldo institucional. */
export function mapBalanceRegistro(input: BalanceRegistroInput): BalanceSaldo {
  const diasVencidos = toNum(input.cantidadInicial);
  const diasProporcionales = toNum(input.cantidadAcumulada);
  const diasUsados = toNum(input.cantidadUsada);
  const diasPendientes = toNum(input.cantidadPendiente);
  const diasDisponibles = toNum(input.cantidadDisponible);

  return {
    diasVencidos,
    diasProporcionales,
    diasAsignados: diasVencidos + diasProporcionales,
    diasUsados,
    diasPendientes,
    diasDisponibles,
  };
}

/** Valida la ecuación institucional de saldo disponible. */
export function validarEcuacionBalance(
  saldo: BalanceSaldo,
  tolerancia = TOLERANCIA_ECUCION
): boolean {
  const esperado =
    saldo.diasVencidos +
    saldo.diasProporcionales -
    saldo.diasUsados -
    saldo.diasPendientes;
  return Math.abs(saldo.diasDisponibles - esperado) <= tolerancia;
}

/** Suma saldos de varios registros (p. ej. resumen departamental). */
export function sumarSaldos(registros: BalanceRegistroInput[]): BalanceSaldo {
  return registros.reduce<BalanceSaldo>(
    (acc, registro) => {
      const saldo = mapBalanceRegistro(registro);
      return {
        diasVencidos: acc.diasVencidos + saldo.diasVencidos,
        diasProporcionales: acc.diasProporcionales + saldo.diasProporcionales,
        diasAsignados: acc.diasAsignados + saldo.diasAsignados,
        diasUsados: acc.diasUsados + saldo.diasUsados,
        diasPendientes: acc.diasPendientes + saldo.diasPendientes,
        diasDisponibles: acc.diasDisponibles + saldo.diasDisponibles,
      };
    },
    {
      diasVencidos: 0,
      diasProporcionales: 0,
      diasAsignados: 0,
      diasUsados: 0,
      diasPendientes: 0,
      diasDisponibles: 0,
    }
  );
}

export function mapBalanceToFila(input: {
  nombre: string;
  apellido: string;
  fechaIngreso?: string | null;
} & BalanceRegistroInput): BalanceDiasFila {
  const saldo = mapBalanceRegistro(input);
  return {
    colaborador: `${input.nombre} ${input.apellido}`.trim().toUpperCase(),
    fechaIngreso: formatFechaIngreso(input.fechaIngreso),
    ...saldo,
  };
}

export function mapBalanceToHistorialUsuario(
  usuario: string,
  registro: BalanceRegistroInput
): BalanceHistorialUsuario {
  return {
    usuario,
    ...mapBalanceRegistro(registro),
  };
}

export function buildHistorialDesdeBalances(
  balances: Array<{ usuarioId: number } & BalanceRegistroInput>,
  usuariosMap: Map<number, string>
): BalanceHistorialUsuario[] {
  return balances
    .map((balance) =>
      mapBalanceToHistorialUsuario(
        usuariosMap.get(balance.usuarioId) || 'Usuario sin nombre',
        balance
      )
    )
    .filter(
      (item) =>
        item.diasAsignados > 0 ||
        item.diasUsados > 0 ||
        item.diasPendientes > 0 ||
        item.diasDisponibles > 0 ||
        item.diasVencidos > 0 ||
        item.diasProporcionales > 0
    )
    .sort(
      (a, b) =>
        b.diasUsados - a.diasUsados ||
        b.diasAsignados - a.diasAsignados ||
        a.usuario.localeCompare(b.usuario)
    );
}

export interface ResumenSaldosDepartamento extends BalanceSaldo {
  diasTotalesVencidos: number;
  diasTotalesProporcionales: number;
  diasTotalesAsignados: number;
  diasTotalesUsados: number;
  diasTotalesPendientes: number;
  diasTotalesDisponibles: number;
}

/** Totales con nombres esperados por el reporte de departamento. */
export function mapSaldosAResumenDepartamento(
  totales: BalanceSaldo
): ResumenSaldosDepartamento {
  return {
    ...totales,
    diasTotalesVencidos: totales.diasVencidos,
    diasTotalesProporcionales: totales.diasProporcionales,
    diasTotalesAsignados: totales.diasAsignados,
    diasTotalesUsados: totales.diasUsados,
    diasTotalesPendientes: totales.diasPendientes,
    diasTotalesDisponibles: totales.diasDisponibles,
  };
}
