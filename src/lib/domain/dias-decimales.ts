/**
 * Reglas institucionales para cantidades de días (asignación, saldos, reportes).
 * Almacenamiento: 4 decimales · Visualización: 2 decimales.
 */

export const MAX_DIAS_ASIGNABLES = 365;
export const DIAS_DECIMALES_ALMACENAMIENTO = 4;
export const DIAS_DECIMALES_VISUALIZACION = 2;

/** Valida que el número tenga como máximo 4 decimales (tolera ruido IEEE-754). */
export function tieneMaxCuatroDecimales(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = Math.round(value * 10_000);
  return Math.abs(value * 10_000 - scaled) < 1e-4;
}

/** Valida decimales desde texto (entrada de formularios). */
export function validarDecimalesEnTexto(texto: string, maxDecimales = DIAS_DECIMALES_ALMACENAMIENTO): boolean {
  const trimmed = texto.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  const fraction = trimmed.split('.')[1];
  return !fraction || fraction.length <= maxDecimales;
}

export function parseCantidadDias(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  const texto = String(input).trim();
  if (texto === '') return null;
  if (!validarDecimalesEnTexto(texto)) return null;
  const n = Number.parseFloat(texto);
  return Number.isFinite(n) ? n : null;
}

export function esCantidadDiasValida(value: number): boolean {
  return value >= 0 && value <= MAX_DIAS_ASIGNABLES && tieneMaxCuatroDecimales(value);
}

/** Persistencia en BD (numeric 10,4). */
export function formatDiasAlmacenamiento(value: number): string {
  return value.toFixed(DIAS_DECIMALES_ALMACENAMIENTO);
}

/** UI, exportaciones y reportes. */
export function formatDiasVisualizacion(value: number): string {
  return value.toFixed(DIAS_DECIMALES_VISUALIZACION);
}
