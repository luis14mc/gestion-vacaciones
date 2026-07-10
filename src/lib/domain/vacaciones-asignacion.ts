/**
 * Fase 5 — Asignación mensual automática de vacaciones según
 * antigüedad y Código de Trabajo.
 *
 * Regla institucional:
 *   < 1 año         → 0 días anuales (no asigna).
 *   1 año cumplido   → 10 días anuales.
 *   2 años          → 12 días anuales.
 *   3 años          → 15 días anuales.
 *   ≥ 4 años        → 20 días anuales.
 *
 * Los días se acreditan proporcionalmente cada mes:
 *   10 / 12 = 0.8333
 *   12 / 12 = 1.0000
 *   15 / 12 = 1.2500
 *   20 / 12 = 1.6667
 *
 * Precisión: 4 decimales en BD para evitar pérdida por redondeo mensual.
 * Display: máximo 2 decimales.
 */
import { calcularAnosCompletados } from '@/lib/domain/asignacion-antiguedad';

const DIAS_ANUALES = {
  menosDeUnAnio: 0,
  unAnio: 10,
  dosAnios: 12,
  tresAnios: 15,
  cuatroOmás: 20,
} as const;

export interface ResultadoAsignacionMensual {
  aniosCumplidos: number;
  diasAnuales: number;
  diasMensuales: number;
  mes: number;
  anio: number;
  /** true cuando corresponde asignar (>0) según antigüedad. */
  asignable: boolean;
}

/** Redondea a 4 decimales (precisión para acumular 12 meses). */
function redondearA4Decimales(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Días anuales por antigüedad. Devuelve 0 para menos de 1 año.
 * Wrapper sobre la regla institucional (mismas constantes que
 * `REGLAS_ASIGNACION_ANTIGUEDAD`).
 */
export function calcularDiasAnualesPorAntiguedad(
  fechaIngreso: string | null | undefined,
  fechaReferencia: Date = new Date()
): number {
  if (!fechaIngreso) return 0;
  const anos = calcularAnosCompletados(fechaIngreso, fechaReferencia);
  if (anos < 1) return DIAS_ANUALES.menosDeUnAnio;
  if (anos === 1) return DIAS_ANUALES.unAnio;
  if (anos === 2) return DIAS_ANUALES.dosAnios;
  if (anos === 3) return DIAS_ANUALES.tresAnios;
  return DIAS_ANUALES.cuatroOmás;
}

/**
 * Días mensuales por antigüedad. Resultado: diasAnuales / 12,
 * redondeado a 4 decimales.
 */
export function calcularDiasMensualesPorAntiguedad(
  fechaIngreso: string | null | undefined,
  fechaReferencia: Date = new Date()
): number {
  const anuales = calcularDiasAnualesPorAntiguedad(fechaIngreso, fechaReferencia);
  if (anuales === 0) return 0;
  return redondearA4Decimales(anuales / 12);
}

/**
 * Resuelve la asignación que corresponde para un (año, mes) y un usuario
 * específico. Devuelve también la antigüedad calculada para auditoría.
 */
export function resolverMesAsignacion(params: {
  fechaIngreso: string | null | undefined;
  anio: number;
  mes: number;
  fechaReferencia?: Date;
}): ResultadoAsignacionMensual {
  const referencia = params.fechaReferencia ?? new Date(params.anio, params.mes - 1, 1);
  const aniosCumplidos = params.fechaIngreso
    ? calcularAnosCompletados(params.fechaIngreso, referencia)
    : 0;
  const diasAnuales = calcularDiasAnualesPorAntiguedad(params.fechaIngreso, referencia);
  const diasMensuales = calcularDiasMensualesPorAntiguedad(params.fechaIngreso, referencia);
  return {
    aniosCumplidos,
    diasAnuales,
    diasMensuales,
    mes: params.mes,
    anio: params.anio,
    asignable: diasMensuales > 0,
  };
}

/**
 * Calcula la antigüedad laboral en años cumplidos a una fecha dada.
 * Re-exporta la función de `asignacion-antiguedad.ts` con un nombre
 * coherente con este módulo (Fase 5).
 */
export function calcularAntiguedadLaboral(
  fechaIngreso: string,
  fechaReferencia: Date = new Date()
): number {
  return calcularAnosCompletados(fechaIngreso, fechaReferencia);
}

/**
 * Reglas textuales de la Fase 5 (para mostrar en UI/Configuración).
 * Se exporta para que la UI no duplique la constante.
 */
export const REGLAS_ASIGNACION_MENSUAL_VACACIONES = {
  titulo: 'Asignación mensual de vacaciones',
  descripcion:
    'La asignación de vacaciones se realiza mensualmente, de forma proporcional, según la antigüedad del colaborador.',
  reglas: [
    { aniosCumplidos: 0, diasAnuales: 0, diasMensuales: 0 },
    { aniosCumplidos: 1, diasAnuales: 10, diasMensuales: 0.8333 },
    { aniosCumplidos: 2, diasAnuales: 12, diasMensuales: 1.0 },
    { aniosCumplidos: 3, diasAnuales: 15, diasMensuales: 1.25 },
    { aniosCumplidos: 4, diasAnuales: 20, diasMensuales: 1.6667 },
  ],
} as const;