/**
 * Feriados nacionales de Honduras (días no laborables para vacaciones).
 * Fuentes: calendario oficial CNI — fechas fijas + Semana Santa móvil.
 */

const FERIADOS_FIJOS_MM_DD = [
  '01-01', // Año Nuevo
  '04-14', // Día de las Américas
  '05-01', // Día del Trabajador
  '09-15', // Independencia
  '10-03', // Día de Francisco Morazán
  '10-12', // Día de la Raza / Descubrimiento de América
  '12-25', // Navidad
] as const;

function parseFechaLocal(fecha: string): Date {
  const soloFecha = fecha.includes('T') ? fecha.slice(0, 10) : fecha;
  return new Date(`${soloFecha}T12:00:00`);
}

function formatearYmd(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Domingo de Pascua (calendario gregoriano). */
export function calcularDomingoPascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00`);
}

function feriadosMovilesSemanaSanta(anio: number): string[] {
  const pascua = calcularDomingoPascua(anio);
  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(juevesSanto.getDate() - 3);
  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(viernesSanto.getDate() - 2);
  return [formatearYmd(juevesSanto), formatearYmd(viernesSanto)];
}

/**
 * Feriado puente (Honduras): si el feriado cae entre semana, se agrega
 * el lunes anterior (mar–jue) o el lunes siguiente (vie–dom).
 */
function aplicarFeriadosPuente(feriados: Set<string>): void {
  const puente = new Set<string>();

  for (const ymd of feriados) {
    const fecha = parseFechaLocal(ymd);
    const dow = fecha.getDay(); // 0=dom … 6=sáb

    if (dow >= 2 && dow <= 4) {
      const lunesAnterior = new Date(fecha);
      lunesAnterior.setDate(lunesAnterior.getDate() - (dow - 1));
      puente.add(formatearYmd(lunesAnterior));
    } else if (dow === 5 || dow === 6 || dow === 0) {
      const lunesSiguiente = new Date(fecha);
      const diasHastaLunes = dow === 0 ? 1 : 8 - dow;
      lunesSiguiente.setDate(lunesSiguiente.getDate() + diasHastaLunes);
      puente.add(formatearYmd(lunesSiguiente));
    }
  }

  for (const ymd of puente) {
    feriados.add(ymd);
  }
}

/** Conjunto YYYY-MM-DD de feriados para un año. */
export function obtenerFeriadosHonduras(anio: number): Set<string> {
  const feriados = new Set<string>();

  for (const mmdd of FERIADOS_FIJOS_MM_DD) {
    feriados.add(`${anio}-${mmdd}`);
  }
  for (const movil of feriadosMovilesSemanaSanta(anio)) {
    feriados.add(movil);
  }

  aplicarFeriadosPuente(feriados);

  return feriados;
}

export function esFeriadoHonduras(fecha: string, feriadosPorAnio?: Map<number, Set<string>>): boolean {
  const parsed = parseFechaLocal(fecha);
  if (Number.isNaN(parsed.getTime())) return false;

  const anio = parsed.getFullYear();
  const ymd = formatearYmd(parsed);
  const cache = feriadosPorAnio ?? new Map<number, Set<string>>();
  if (!cache.has(anio)) {
    cache.set(anio, obtenerFeriadosHonduras(anio));
  }
  return cache.get(anio)!.has(ymd);
}
