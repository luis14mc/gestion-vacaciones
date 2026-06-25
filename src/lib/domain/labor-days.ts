/**
 * Cálculo autoritativo de días hábiles (laborables) para vacaciones.
 *
 * Regla de negocio CNI: las vacaciones se cuentan en días LABORABLES, por
 * lo que sábados, domingos y feriados nacionales de Honduras NO se descuentan.
 * El servidor no confía en el número de días enviado por el cliente.
 */
import { esFeriadoHonduras } from '@/lib/domain/feriados-honduras';

export function contarDiasHabiles(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`);
  const fin = new Date(`${fechaFin.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
  if (fin < inicio) return 0;

  const feriadosCache = new Map<number, Set<string>>();
  let dias = 0;
  const actual = new Date(inicio);
  while (actual <= fin) {
    const diaSemana = actual.getDay(); // 0 = domingo, 6 = sábado
    const ymd = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}`;
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const esFeriado = esFeriadoHonduras(ymd, feriadosCache);
    if (!esFinDeSemana && !esFeriado) {
      dias++;
    }
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
}
