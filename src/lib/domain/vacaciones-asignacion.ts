/**
 * Fase 5 — Asignación mensual automática de vacaciones según
 * antigüedad y Código de Trabajo.
 *
 * Regla institucional (devengo mes a mes del tramo del año laboral en curso):
 *   Años cumplidos 0 (1.er año en curso)  → 10 anuales → 0.8333/mes
 *   Años cumplidos 1 (2.º año en curso)   → 12 anuales → 1.0000/mes
 *   Años cumplidos 2 (3.er año en curso)  → 15 anuales → 1.2500/mes
 *   Años cumplidos 3 (4.º año en curso)   → 20 anuales → 1.6667/mes
 *   Años cumplidos ≥ 4 (5.º año en adelante) → 20 anuales → 1.6667/mes
 *
 * Precisión: 4 decimales en BD para evitar pérdida por redondeo mensual.
 * Display: máximo 2 decimales.
 */
import { calcularAnosCompletados } from '@/lib/domain/asignacion-antiguedad';

const DIAS_ANUALES = {
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

function parseFechaIngresoLocal(fechaIngreso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIngreso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** true si la fecha de referencia es el día de ingreso o posterior. */
function estaContratadoEnReferencia(
  fechaIngreso: string,
  fechaReferencia: Date
): boolean {
  const ingreso = parseFechaIngresoLocal(fechaIngreso);
  if (!ingreso) return false;
  const ref = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    fechaReferencia.getDate()
  );
  return ref >= ingreso;
}

/**
 * Días anuales del tramo que se devenga mes a mes según años cumplidos.
 * Cada año laboral en curso usa el tope del tramo correspondiente (no el anterior).
 */
export function calcularDiasAnualesPorAntiguedad(
  fechaIngreso: string | null | undefined,
  fechaReferencia: Date = new Date()
): number {
  if (!fechaIngreso) return 0;
  if (!estaContratadoEnReferencia(fechaIngreso, fechaReferencia)) return 0;

  const anos = calcularAnosCompletados(fechaIngreso, fechaReferencia);
  if (anos === 0) return DIAS_ANUALES.unAnio;
  if (anos === 1) return DIAS_ANUALES.dosAnios;
  if (anos === 2) return DIAS_ANUALES.tresAnios;
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
 * Extrae el día del mes (1-31) de una fecha de ingreso almacenada como
 * 'YYYY-MM-DD' (o ISO). Se parsea de la cadena para evitar corrimientos
 * de zona horaria (`new Date('YYYY-MM-DD')` interpreta UTC).
 */
function diaDelMesDeIngreso(fechaIngreso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIngreso.trim());
  if (!m) return null;
  const dia = Number(m[3]);
  return dia >= 1 && dia <= 31 ? dia : null;
}

/**
 * Determina si `hoy` es el día de acreditación mensual para un empleado
 * que ingresó en `fechaIngreso`. La acreditación ocurre el mismo día del
 * mes que el ingreso (ingresó el 04 → acredita el 04 de cada mes).
 *
 * Si el mes en curso no tiene ese día (ingresó el 31 y estamos en un mes
 * de 30 días, o en febrero), la acreditación se realiza el último día del
 * mes para no perder el devengo.
 */
export function esDiaDeAsignacionMensual(
  fechaIngreso: string | null | undefined,
  hoy: Date = new Date()
): boolean {
  if (!fechaIngreso) return false;
  const diaIngreso = diaDelMesDeIngreso(fechaIngreso);
  if (diaIngreso == null) return false;
  const ultimoDiaMesActual = new Date(
    hoy.getFullYear(),
    hoy.getMonth() + 1,
    0
  ).getDate();
  const diaObjetivo = Math.min(diaIngreso, ultimoDiaMesActual);
  return hoy.getDate() === diaObjetivo;
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
    'La asignación de vacaciones se realiza mensualmente, de forma proporcional al tramo anual del año laboral en curso (1.er año: 10, 2.º: 12, 3.er: 15, 4.º en adelante: 20).',
  reglas: [
    {
      aniosCumplidos: 0,
      diasAnuales: 10,
      diasMensuales: 0.8333,
      nota: '1.er año laboral en curso',
    },
    { aniosCumplidos: 1, diasAnuales: 12, diasMensuales: 1.0, nota: '2.º año laboral en curso' },
    { aniosCumplidos: 2, diasAnuales: 15, diasMensuales: 1.25, nota: '3.er año laboral en curso' },
    {
      aniosCumplidos: 3,
      diasAnuales: 20,
      diasMensuales: 1.6667,
      nota: '4.º año laboral en curso',
    },
    {
      aniosCumplidos: 4,
      diasAnuales: 20,
      diasMensuales: 1.6667,
      nota: '5.º año laboral en adelante',
    },
  ],
} as const;