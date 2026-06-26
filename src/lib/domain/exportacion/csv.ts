/**
 * CSV seguro con BOM UTF-8 y protección contra CSV injection.
 */

const CSV_INJECTION_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: unknown): string {
  if (value == null) return '""';

  let text = String(value);
  if (CSV_INJECTION_PREFIX.test(text)) {
    text = `'${text}`;
  }

  const needsQuotes = /[",\n\r]/.test(text);
  if (needsQuotes) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return `"${text}"`;
}

export interface ColumnaCsv {
  key: string;
  header: string;
}

export function filasACsv(
  filas: Record<string, unknown>[],
  columnas: ColumnaCsv[],
  options?: { sinDatos?: boolean }
): string {
  const header = columnas.map((c) => escapeCsvValue(c.header)).join(',');
  if (options?.sinDatos || filas.length === 0) {
    const nota = escapeCsvValue('Sin datos para los filtros seleccionados');
    return `${header}\n${nota}`;
  }
  const body = filas
    .map((fila) => columnas.map((c) => escapeCsvValue(fila[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

export function csvConBom(content: string): string {
  return `\uFEFF${content}`;
}
