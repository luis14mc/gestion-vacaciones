/**
 * Reglas de negocio: día libre por cumpleaños (1 día al año, solo en el mes de cumpleaños).
 */

export const ESTADOS_DIA_CUMPLEANOS_ACTIVOS = [
  'pendiente_jefe',
  'aprobada_jefe',
  'pendiente_rrhh',
  'aprobada_rrhh',
  'finalizada',
] as const;

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseFechaLocal(fecha: string): Date {
  const soloFecha = fecha.includes('T') ? fecha.slice(0, 10) : fecha;
  return new Date(`${soloFecha}T12:00:00`);
}

function formatearFechaISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nombreMes(mes: number): string {
  return MESES_ES[mes - 1] ?? String(mes);
}

export function obtenerMesCumpleanos(fechaNacimiento: string): number {
  return parseFechaLocal(fechaNacimiento).getMonth() + 1;
}

export function obtenerDiaCumpleanos(fechaNacimiento: string): number {
  return parseFechaLocal(fechaNacimiento).getDate();
}

export function obtenerRangoMesCumpleanos(
  fechaNacimiento: string,
  referencia: Date = new Date()
): { fechaMinimaPermitida: string; fechaMaximaPermitida: string } {
  const anio = referencia.getFullYear();
  const mesIndex = obtenerMesCumpleanos(fechaNacimiento) - 1;
  const inicio = new Date(anio, mesIndex, 1, 12, 0, 0, 0);
  const fin = new Date(anio, mesIndex + 1, 0, 12, 0, 0, 0);

  return {
    fechaMinimaPermitida: formatearFechaISO(inicio),
    fechaMaximaPermitida: formatearFechaISO(fin),
  };
}

export function esMesCumpleanos(
  fechaNacimiento: string,
  referencia: Date = new Date()
): boolean {
  return obtenerMesCumpleanos(fechaNacimiento) === referencia.getMonth() + 1;
}

export function validarFechaSolicitudCumpleanos(
  fechaNacimiento: string,
  fechaSolicitud: string
): { valido: boolean; error?: string } {
  if (!fechaNacimiento) {
    return {
      valido: false,
      error: 'No tiene registrada su fecha de nacimiento. Registre su fecha de nacimiento con RRHH para habilitar el día libre por cumpleaños.',
    };
  }

  const mesNacimiento = obtenerMesCumpleanos(fechaNacimiento);
  const mesSolicitud = parseFechaLocal(fechaSolicitud).getMonth() + 1;

  if (mesSolicitud !== mesNacimiento) {
    return {
      valido: false,
      error: `El día libre por cumpleaños solo puede solicitarse en ${nombreMes(mesNacimiento)}.`,
    };
  }

  const anioSolicitud = parseFechaLocal(fechaSolicitud).getFullYear();
  const anioActual = new Date().getFullYear();
  if (anioSolicitud !== anioActual) {
    return {
      valido: false,
      error: 'Solo puede solicitar el día de cumpleaños del año en curso.',
    };
  }

  return { valido: true };
}

export interface ElegibilidadCumpleanos {
  tieneFechaNacimiento: boolean;
  mesCumpleanos: number | null;
  nombreMesCumpleanos: string | null;
  esMesActual: boolean;
  yaTomado: boolean;
  puedeSolicitar: boolean;
  mensaje: string;
  fechaMinimaPermitida: string | null;
  fechaMaximaPermitida: string | null;
}

export function calcularElegibilidadCumpleanos(input: {
  fechaNacimiento?: string | null;
  yaTomado: boolean;
  referencia?: Date;
}): ElegibilidadCumpleanos {
  const referencia = input.referencia ?? new Date();

  if (!input.fechaNacimiento) {
    return {
      tieneFechaNacimiento: false,
      mesCumpleanos: null,
      nombreMesCumpleanos: null,
      esMesActual: false,
      yaTomado: false,
      puedeSolicitar: false,
      mensaje: 'Registre su fecha de nacimiento con RRHH para habilitar el día libre por cumpleaños.',
      fechaMinimaPermitida: null,
      fechaMaximaPermitida: null,
    };
  }

  const mes = obtenerMesCumpleanos(input.fechaNacimiento);
  const rango = obtenerRangoMesCumpleanos(input.fechaNacimiento, referencia);
  const esMesActual = esMesCumpleanos(input.fechaNacimiento, referencia);

  if (input.yaTomado) {
    return {
      tieneFechaNacimiento: true,
      mesCumpleanos: mes,
      nombreMesCumpleanos: nombreMes(mes),
      esMesActual,
      yaTomado: true,
      puedeSolicitar: false,
      mensaje: `Ya utilizó su día libre por cumpleaños en ${referencia.getFullYear()}.`,
      ...rango,
    };
  }

  if (!esMesActual) {
    return {
      tieneFechaNacimiento: true,
      mesCumpleanos: mes,
      nombreMesCumpleanos: nombreMes(mes),
      esMesActual: false,
      yaTomado: false,
      puedeSolicitar: false,
      mensaje: `Su día libre por cumpleaños solo puede tomarse en ${nombreMes(mes)}.`,
      ...rango,
    };
  }

  return {
    tieneFechaNacimiento: true,
    mesCumpleanos: mes,
    nombreMesCumpleanos: nombreMes(mes),
    esMesActual: true,
    yaTomado: false,
    puedeSolicitar: true,
    mensaje: 'Tiene derecho a 1 día libre por cumpleaños este mes. Solo puede usarlo una vez al año.',
    ...rango,
  };
}
