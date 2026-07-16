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
