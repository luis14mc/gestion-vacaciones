/**
 * Utilidades para presentar el balance de vacaciones en la vista de empleados.
 *
 * Mapeo CNI (referencia RRHH):
 * - Días vencidos      → cantidad_inicial (saldo arrastrado / asignación base del periodo)
 * - Días proporcionales → cantidad_acumulada (devengados en el periodo actual)
 * - Días disponibles   → cantidad_disponible (neto: inicial + acumulada − usada − pendiente)
 */

export interface BalanceDiasFila {
  colaborador: string;
  fechaIngreso: string;
  diasVencidos: number;
  diasProporcionales: number;
  diasDisponibles: number;
}

export function formatFechaIngreso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatDias(value: number): string {
  return value.toFixed(2);
}

export function mapBalanceToFila(input: {
  nombre: string;
  apellido: string;
  fechaIngreso?: string | null;
  cantidadInicial?: string | number | null;
  cantidadAcumulada?: string | number | null;
  cantidadDisponible?: string | number | null;
}): BalanceDiasFila {
  return {
    colaborador: `${input.nombre} ${input.apellido}`.trim().toUpperCase(),
    fechaIngreso: formatFechaIngreso(input.fechaIngreso),
    diasVencidos: Number(input.cantidadInicial ?? 0),
    diasProporcionales: Number(input.cantidadAcumulada ?? 0),
    diasDisponibles: Number(input.cantidadDisponible ?? 0),
  };
}
