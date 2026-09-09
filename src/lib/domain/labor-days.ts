/**
 * Cálculo autoritativo de días hábiles (laborables) para vacaciones.
 *
 * Regla de negocio CNI vigente: las vacaciones se cuentan en días laborables,
 * excluyendo únicamente sábados y domingos de forma automática.
 *
 * Los días festivos NO se descuentan automáticamente desde una lista hardcodeada.
 * Si en el futuro RRHH administra feriados/días no laborables en el sistema,
 * deberán incorporarse explícitamente desde esa fuente de datos.
 *
 * El servidor no confía en el número de días enviado por el cliente.
 */

/**
 * Parsea YYYY-MM-DD como fecha local (mediodía) para evitar el desfase
 * UTC de `new Date('YYYY-MM-DD')`, que en zonas UTC−N mueve el día al
 * anterior y puede alterar el cálculo de días laborables.
 */
export function parseFechaLocal(fecha: string): Date {
  const solo = fecha.slice(0, 10);
  return new Date(`${solo}T12:00:00`);
}

export function contarDiasHabiles(fechaInicio: string, fechaFin: string): number {
  const inicio = parseFechaLocal(fechaInicio);
  const fin = parseFechaLocal(fechaFin);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
  if (fin < inicio) return 0;

  let dias = 0;
  const actual = new Date(inicio);

  while (actual <= fin) {
    const diaSemana = actual.getDay(); // 0 = domingo, 6 = sábado
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!esFinDeSemana) {
      dias++;
    }

    actual.setDate(actual.getDate() + 1);
  }

  return dias;
}
