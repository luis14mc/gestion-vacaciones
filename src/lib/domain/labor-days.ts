/**
 * Cálculo autoritativo de días hábiles (laborables) para vacaciones.
 *
 * Regla de negocio CNI: las vacaciones se cuentan en días LABORABLES, por
 * lo que sábados y domingos NUNCA se descuentan. El servidor no confía en
 * el número de días enviado por el cliente (era manipulable): siempre
 * recalcula a partir del rango de fechas.
 *
 * Nota: los feriados nacionales aún no se modelan (no hay fuente de datos).
 * Cuando exista un catálogo de feriados, deben restarse aquí.
 */
export function contarDiasHabiles(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`);
  const fin = new Date(`${fechaFin.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
  if (fin < inicio) return 0;

  let dias = 0;
  const actual = new Date(inicio);
  while (actual <= fin) {
    const diaSemana = actual.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias++;
    }
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
}
