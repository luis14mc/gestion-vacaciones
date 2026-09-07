const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export function labelMes(mes: number): string {
  if (mes < 1 || mes > 12) return String(mes);
  return MESES[mes - 1] ?? String(mes);
}

export function labelOrigenAsignacion(
  origen: 'automatico' | 'manual' | 'sistema' | string
): string {
  switch (origen) {
    case 'automatico':
      return 'Automático';
    case 'manual':
      return 'Manual (RRHH/Admin)';
    case 'sistema':
      return 'Sistema (cron)';
    default:
      return origen;
  }
}

/** Etiqueta legible del tramo en devengo (año laboral en curso). */
export function labelTramoAsignacionMensual(aniosCumplidos: number): string {
  if (aniosCumplidos === 0) return '1.er año laboral en curso';
  if (aniosCumplidos === 1) return '2.º año laboral en curso';
  if (aniosCumplidos === 2) return '3.er año laboral en curso';
  if (aniosCumplidos === 3) return '4.º año laboral en curso';
  return '5.º año laboral en adelante';
}

/** Formato compacto de días mensuales para tablas de configuración. */
export function formatDiasMensualesRegla(dias: number): string {
  return dias.toFixed(4).replace(/\.?0+$/, '') || '0';
}
