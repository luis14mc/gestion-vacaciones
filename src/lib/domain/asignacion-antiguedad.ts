/**
 * Reglas de asignación automática de días de vacaciones según antigüedad.
 * Fuente única compartida entre /api/admin/asignar-dias y la UI de configuración.
 */

export interface ReglaAsignacionAntiguedad {
  antiguedad: string;
  dias: number;
}

export const REGLAS_ASIGNACION_ANTIGUEDAD: readonly ReglaAsignacionAntiguedad[] = [
  { antiguedad: "Menos de 1 año", dias: 0 },
  { antiguedad: "1 año cumplido", dias: 10 },
  { antiguedad: "2 años cumplidos", dias: 12 },
  { antiguedad: "3 años cumplidos", dias: 15 },
  { antiguedad: "4 años o más", dias: 20 },
] as const;

export function calcularAnosCompletados(
  fechaIngreso: string,
  referencia: Date = new Date()
): number {
  const ingreso = new Date(fechaIngreso);
  let anos = referencia.getFullYear() - ingreso.getFullYear();
  const mes = referencia.getMonth() - ingreso.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < ingreso.getDate())) {
    anos--;
  }
  return anos;
}

export function calcularDiasSegunAntiguedad(
  fechaIngreso: string,
  referencia: Date = new Date()
): number {
  const anos = calcularAnosCompletados(fechaIngreso, referencia);

  if (anos < 1) return 0;
  if (anos === 1) return 10;
  if (anos === 2) return 12;
  if (anos === 3) return 15;
  return 20;
}
