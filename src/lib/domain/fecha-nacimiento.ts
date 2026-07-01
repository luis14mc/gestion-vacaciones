const FECHA_MINIMA = '1900-01-01';

export interface FechaNacimientoNormalizada {
  fecha: string | null;
  error?: string;
}

function fechaHoyLocal(referencia: Date): string {
  const year = referencia.getFullYear();
  const month = String(referencia.getMonth() + 1).padStart(2, '0');
  const day = String(referencia.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function construirFecha(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizarFechaNacimiento(
  value: unknown,
  referencia: Date = new Date()
): FechaNacimientoNormalizada {
  if (value === null || value === undefined || value === '') {
    return { fecha: null };
  }

  let fecha: string | null = null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    fecha = construirFecha(value.getFullYear(), value.getMonth() + 1, value.getDate());
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    fecha = construirFecha(
      excelDate.getUTCFullYear(),
      excelDate.getUTCMonth() + 1,
      excelDate.getUTCDate()
    );
  } else if (typeof value === 'string') {
    const raw = value.trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    const local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (iso) {
      fecha = construirFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    } else if (local) {
      fecha = construirFecha(Number(local[3]), Number(local[2]), Number(local[1]));
    }
  }

  if (!fecha) {
    return { fecha: null, error: 'Fecha de nacimiento inválida. Use YYYY-MM-DD o DD/MM/YYYY.' };
  }

  if (fecha < FECHA_MINIMA) {
    return { fecha: null, error: `La fecha de nacimiento no puede ser anterior a ${FECHA_MINIMA}.` };
  }

  if (fecha > fechaHoyLocal(referencia)) {
    return { fecha: null, error: 'La fecha de nacimiento no puede estar en el futuro.' };
  }

  return { fecha };
}

