/**
 * Antigüedad laboral desglosada (años, meses, días).
 */
export interface AntiguedadDetallada {
  anios: number;
  meses: number;
  dias: number;
}

export function calcularAntiguedadDetallada(
  fechaIngreso: string | null | undefined,
  fechaReferencia: Date = new Date()
): AntiguedadDetallada {
  if (!fechaIngreso) return { anios: 0, meses: 0, dias: 0 };

  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return { anios: 0, meses: 0, dias: 0 };

  let anios = fechaReferencia.getFullYear() - ingreso.getFullYear();
  let meses = fechaReferencia.getMonth() - ingreso.getMonth();
  let dias = fechaReferencia.getDate() - ingreso.getDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoDiaMesAnterior = new Date(
      fechaReferencia.getFullYear(),
      fechaReferencia.getMonth(),
      0
    ).getDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return { anios: Math.max(0, anios), meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

export function formatearAntiguedad(detalle: AntiguedadDetallada): string {
  const partes: string[] = [];
  if (detalle.anios > 0) partes.push(`${detalle.anios}a`);
  if (detalle.meses > 0) partes.push(`${detalle.meses}m`);
  if (detalle.dias > 0 || partes.length === 0) partes.push(`${detalle.dias}d`);
  return partes.join(' ');
}
