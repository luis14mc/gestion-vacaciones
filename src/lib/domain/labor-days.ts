/**
 * Cálculo autoritativo de días hábiles (laborables) para vacaciones.
 *
 * Regla de negocio CNI: las vacaciones se cuentan en días LABORABLES, por
 * lo que sábados, domingos y feriados nacionales de Honduras NO se descuentan.
 * El servidor no confía en el número de días enviado por el cliente.
 */
import { esFeriadoHonduras } from '@/lib/domain/feriados-honduras';

/**
 * Parsea YYYY-MM-DD como fecha local (mediodía) para evitar el desfase
 * UTC de `new Date('YYYY-MM-DD')`, que en zonas UTC−N mueve el día al
 * anterior y hace que lunes→domingo cuente 0 días laborables.
 */
/** Parsea YYYY-MM-DD en zona local (mediodía) para evitar desfase UTC. */
export function parseFechaLocal(fecha: string): Date {
  const solo = fecha.slice(0, 10);
  return new Date(`${solo}T12:00:00`);
}

export function contarDiasHabiles(fechaInicio: string, fechaFin: string): number {
  const inicio = parseFechaLocal(fechaInicio);
  const fin = parseFechaLocal(fechaFin);

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
