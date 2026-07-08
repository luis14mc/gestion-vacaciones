const EMPTY = '—';

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function calendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  ) {
    return date;
  }
  return null;
}

/**
 * Parsea fechas de negocio sin desplazar el día por zona horaria.
 * Soporta: YYYY-MM-DD, ISO con T, timestamps PostgreSQL con espacio.
 */
export function parseSafeDate(value: unknown): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(ISO_DATE_PREFIX);
  if (match) {
    const calendar = calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (calendar) return calendar;
  }

  const matchDmy = trimmed.match(DMY_DATE);
  if (matchDmy) {
    const calendar = calendarDate(Number(matchDmy[3]), Number(matchDmy[2]), Number(matchDmy[1]));
    if (calendar) return calendar;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Fecha visible en tablas/cards: dd/MM/yyyy */
export function formatDate(value: unknown): string {
  const date = parseSafeDate(value);
  if (!date) return EMPTY;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

/** Fecha y hora para auditoría / metadatos: dd/MM/yyyy HH:mm (America/Tegucigalpa) */
export function formatDateTime(value: unknown): string {
  if (value == null || value === '') return EMPTY;

  let date: Date | null = null;

  if (value instanceof Date) {
    date = Number.isNaN(value.getTime()) ? null : value;
  } else if (typeof value === 'number') {
    const d = new Date(value);
    date = Number.isNaN(d.getTime()) ? null : d;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return EMPTY;

    const hasTime = /[T ]\d{2}:\d{2}/.test(trimmed);
    if (hasTime) {
      const normalized = trimmed.includes(' ') && !trimmed.includes('T')
        ? trimmed.replace(' ', 'T')
        : trimmed;
      const d = new Date(normalized);
      if (!Number.isNaN(d.getTime())) date = d;
    }

    if (!date) date = parseSafeDate(trimmed);
  }

  if (!date) return EMPTY;

  const parts = new Intl.DateTimeFormat('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** Valor para `<input type="date">` (yyyy-MM-dd) */
export function toIsoDateInput(value: unknown): string {
  const date = parseSafeDate(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DATE_KEYS = new Set([
  'fecha',
  'fecha_ingreso',
  'fecha_inicio',
  'fecha_fin',
  'fecha_nacimiento',
  'fecha_solicitada',
  'fecha_fin_ano_laboral',
]);

const DATETIME_KEYS = new Set([
  'ultima_actualizacion',
  'fecha_creacion',
  'aprobada_jefe_fecha',
  'aprobada_rrhh_fecha',
  'created_at',
  'updated_at',
]);

/** Formateo por nombre de columna (reportes/exportación). */
export function formatDateField(key: string, value: unknown): string | null {
  if (DATE_KEYS.has(key)) return formatDate(value);
  if (DATETIME_KEYS.has(key)) return formatDateTime(value);
  return null;
}
