/**
 * Cálculo de consumo de balance a partir de solicitudes.
 * Debe coincidir con scripts/reconciliar-balances.mjs y workflow.service.
 */

export interface SolicitudConsumoInput {
  estado: string;
  diasSolicitados: string | number | null;
  tipo: string;
  duracionPermiso?: string | null;
}

export function solicitudConsumeBalance(solicitud: {
  tipo: string;
  duracionPermiso?: string | null;
}): boolean {
  return (
    solicitud.tipo === 'vacaciones' ||
    (solicitud.tipo === 'permiso_salida' && solicitud.duracionPermiso === 'dia_completo')
  );
}

const ESTADOS_USADA = new Set(['aprobada_rrhh', 'finalizada']);
const ESTADOS_PENDIENTE = new Set(['pendiente_jefe', 'aprobada_jefe']);

export function calcularConsumoBalance(solicitudes: SolicitudConsumoInput[]): {
  usada: number;
  pendiente: number;
} {
  let usada = 0;
  let pendiente = 0;

  for (const solicitud of solicitudes) {
    if (!solicitudConsumeBalance(solicitud)) continue;

    const dias = Number(solicitud.diasSolicitados ?? 0);
    if (!Number.isFinite(dias) || dias <= 0) continue;

    if (ESTADOS_USADA.has(solicitud.estado)) {
      usada += dias;
    } else if (ESTADOS_PENDIENTE.has(solicitud.estado)) {
      pendiente += dias;
    }
  }

  return { usada, pendiente };
}

export function calcularDisponibleBalance(
  base: number,
  usada: number,
  pendiente: number
): number {
  return Math.max(0, base - usada - pendiente);
}
