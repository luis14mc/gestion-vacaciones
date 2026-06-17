/**
 * Cálculo autoritativo de días hábiles para vacaciones.
 *
 * El servidor NO debe confiar en el número de días enviado por el cliente
 * (era manipulable: permitía descontar menos balance del real). Esta función
 * recalcula los días a partir del rango de fechas.
 *
 * Nota: los feriados nacionales aún no se modelan en el sistema (no hay
 * fuente de datos). Por ahora solo se excluyen fines de semana, salvo que
 * la configuración indique incluirlos. Cuando exista un catálogo de
 * feriados, debe restarse aquí.
 */
export function contarDiasHabiles(
  fechaInicio: string,
  fechaFin: string,
  incluirFinesSemana = false
): number {
  const inicio = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`);
  const fin = new Date(`${fechaFin.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
  if (fin < inicio) return 0;

  let dias = 0;
  const actual = new Date(inicio);
  while (actual <= fin) {
    const diaSemana = actual.getDay(); // 0 = domingo, 6 = sábado
    if (incluirFinesSemana || (diaSemana !== 0 && diaSemana !== 6)) {
      dias++;
    }
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
}
