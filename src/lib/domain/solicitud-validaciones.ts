/**
 * Reglas de validación de fechas, anticipación, fines de semana y horas
 * para solicitudes. Usadas en backend y frontend para mantener paridad.
 */
import { parseFechaLocal } from '@/lib/domain/labor-days';
import { formatDate } from '@/lib/utils/date-format';

export type TipoSolicitudValidacion =
  | 'vacaciones'
  | 'permiso_salida'
  | 'licencia_medica'
  | 'permiso_personal'
  | 'dia_cumpleanos';

export type DuracionPermisoSalida = '1-2h' | '2-4h' | 'dia_completo';

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
}

/** Licencia médica puede abarcar fines de semana (constancias reales). */
export function tipoPermiteFinDeSemana(tipo: TipoSolicitudValidacion): boolean {
  return tipo === 'licencia_medica';
}

export function tipoDescuentaSaldo(
  tipo: TipoSolicitudValidacion,
  duracionPermiso?: DuracionPermisoSalida | string | null
): boolean {
  return (
    tipo === 'vacaciones' ||
    (tipo === 'permiso_salida' && duracionPermiso === 'dia_completo')
  );
}

export function esFinDeSemana(fecha: string): boolean {
  const dia = parseFechaLocal(fecha).getDay();
  return dia === 0 || dia === 6;
}

export function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inicioDeDiaLocal(ref?: Date): Date {
  const hoy = ref ? new Date(ref) : new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

/**
 * Fecha mínima permitida para iniciar una solicitud.
 *
 * Regla: `diasAnticipacion = N` → la fecha de inicio debe ser >= hoy + N días
 * calendario (inclusive). Ej.: N=2 y hoy 17/07 → mínimo 19/07.
 */
export function calcularFechaMinimaSolicitud(hoy: Date, diasAnticipacion: number): string {
  const base = inicioDeDiaLocal(hoy);
  base.setDate(base.getDate() + Math.max(0, diasAnticipacion));
  return toIsoDateLocal(base);
}

export function compararFechasYmd(a: string, b: string): number {
  const da = parseFechaLocal(a).getTime();
  const db = parseFechaLocal(b).getTime();
  return da - db;
}

export function iterarDiasEnRango(fechaInicio: string, fechaFin: string): string[] {
  const inicio = parseFechaLocal(fechaInicio);
  const fin = parseFechaLocal(fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) {
    return [];
  }
  const dias: string[] = [];
  const actual = new Date(inicio);
  while (actual <= fin) {
    dias.push(toIsoDateLocal(actual));
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
}

export function validarFechaNoPasada(
  fechaInicio: string,
  hoy: Date = inicioDeDiaLocal()
): ResultadoValidacion {
  if (compararFechasYmd(fechaInicio, toIsoDateLocal(hoy)) < 0) {
    return {
      valido: false,
      error: 'No puede solicitar permisos para fechas anteriores a la fecha actual.',
    };
  }
  return { valido: true };
}

export function validarOrdenFechas(
  fechaInicio: string,
  fechaFin: string
): ResultadoValidacion {
  if (compararFechasYmd(fechaFin, fechaInicio) < 0) {
    return {
      valido: false,
      error: 'La fecha fin no puede ser anterior a la fecha inicio.',
    };
  }
  return { valido: true };
}

export function validarAnticipacionMinima(
  fechaInicio: string,
  diasAnticipacion: number,
  hoy: Date = inicioDeDiaLocal()
): ResultadoValidacion {
  if (diasAnticipacion <= 0) {
    return { valido: true };
  }
  const fechaMinima = calcularFechaMinimaSolicitud(hoy, diasAnticipacion);
  if (compararFechasYmd(fechaInicio, fechaMinima) < 0) {
    return {
      valido: false,
      error: `Debe solicitar con al menos ${diasAnticipacion} día(s) de anticipación. Fecha mínima permitida: ${formatDate(fechaMinima)}.`,
    };
  }
  return { valido: true };
}

export function validarRangoSinFinDeSemana(
  tipo: TipoSolicitudValidacion,
  fechaInicio: string,
  fechaFin: string
): ResultadoValidacion {
  if (tipoPermiteFinDeSemana(tipo)) {
    return { valido: true };
  }
  for (const dia of iterarDiasEnRango(fechaInicio, fechaFin)) {
    if (esFinDeSemana(dia)) {
      return {
        valido: false,
        error: 'No se pueden solicitar permisos para sábado o domingo.',
      };
    }
  }
  return { valido: true };
}

function parseMinutosDesdeMedianoche(hora: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function validarHorasPermisoSalida(
  duracionPermiso: DuracionPermisoSalida | string | undefined,
  horaSalida?: string | null,
  horaRegreso?: string | null
): ResultadoValidacion {
  if (!duracionPermiso || duracionPermiso === 'dia_completo') {
    return { valido: true };
  }

  if (!horaSalida?.trim() || !horaRegreso?.trim()) {
    return {
      valido: false,
      error: 'La hora de salida y la hora de regreso son obligatorias para este permiso.',
    };
  }

  const salida = parseMinutosDesdeMedianoche(horaSalida);
  const regreso = parseMinutosDesdeMedianoche(horaRegreso);

  if (salida == null || regreso == null) {
    return {
      valido: false,
      error: 'Las horas de salida y regreso deben tener un formato válido (HH:MM).',
    };
  }

  if (regreso <= salida) {
    return {
      valido: false,
      error: 'La hora de regreso debe ser posterior a la hora de salida.',
    };
  }

  const diffHoras = (regreso - salida) / 60;

  if (duracionPermiso === '1-2h' && diffHoras > 2) {
    return {
      valido: false,
      error: 'El permiso 1–2 horas no puede exceder 2 horas.',
    };
  }

  if (duracionPermiso === '2-4h' && diffHoras > 4) {
    return {
      valido: false,
      error: 'El permiso de medio día no puede exceder 4 horas.',
    };
  }

  return { valido: true };
}

export interface ValidarReglasFechasParams {
  tipo: TipoSolicitudValidacion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  duracionPermiso?: DuracionPermisoSalida | string | null;
  horaSalida?: string | null;
  horaRegreso?: string | null;
  diasAnticipacion?: number;
  hoy?: Date;
}

/**
 * Orden canónico de validación de fechas/horas antes de saldo y adjuntos.
 */
export function validarReglasFechasSolicitud(
  params: ValidarReglasFechasParams
): ResultadoValidacion {
  const {
    tipo,
    fechaInicio,
    fechaFin,
    duracionPermiso,
    horaSalida,
    horaRegreso,
    diasAnticipacion = 0,
    hoy = inicioDeDiaLocal(),
  } = params;

  if (tipo === 'dia_cumpleanos') {
    if (!fechaInicio) {
      return { valido: false, error: 'Debe seleccionar la fecha del día libre por cumpleaños.' };
    }
    const fin = fechaFin ?? fechaInicio;
    const pasada = validarFechaNoPasada(fechaInicio, hoy);
    if (!pasada.valido) return pasada;
    const orden = validarOrdenFechas(fechaInicio, fin);
    if (!orden.valido) return orden;
    const anticipacion = validarAnticipacionMinima(fechaInicio, diasAnticipacion, hoy);
    if (!anticipacion.valido) return anticipacion;
    return validarRangoSinFinDeSemana(tipo, fechaInicio, fin);
  }

  if (!fechaInicio) {
    return { valido: false, error: 'La fecha de inicio es requerida.' };
  }

  const fin = fechaFin ?? fechaInicio;

  const pasada = validarFechaNoPasada(fechaInicio, hoy);
  if (!pasada.valido) return pasada;

  const orden = validarOrdenFechas(fechaInicio, fin);
  if (!orden.valido) return orden;

  const anticipacion = validarAnticipacionMinima(fechaInicio, diasAnticipacion, hoy);
  if (!anticipacion.valido) return anticipacion;

  const finDeSemana = validarRangoSinFinDeSemana(tipo, fechaInicio, fin);
  if (!finDeSemana.valido) return finDeSemana;

  if (tipo === 'permiso_salida') {
    return validarHorasPermisoSalida(duracionPermiso ?? undefined, horaSalida, horaRegreso);
  }

  return { valido: true };
}
