/**
 * Errores de validación de negocio esperados al crear una solicitud (crearSolicitud).
 * No incluye fallos técnicos de BD, red o bugs internos.
 */

const PATRONES_VALIDACION_NEGOCIO = [
  /^Las vacaciones requieren fecha de inicio y fin$/,
  /^El rango de fechas no contiene días hábiles para descontar$/,
  /^La solicitud debe ser de al menos \d+ día\(s\) hábil\(es\)\.$/,
  /^No puede solicitar más de \d+ días consecutivos\.$/,
  /^Las vacaciones deben solicitarse con al menos \d+ día\(s\) de anticipación\.$/,
  /^Para permisos de salida es obligatorio indicar un motivo de al menos 5 caracteres\.$/,
  /^La fecha de inicio no puede ser posterior a la fecha de fin$/,
  /^Usuario no encontrado o inactivo$/,
  /^No tiene registrada su fecha de nacimiento\./,
  /^Fecha no válida para día de cumpleaños$/,
  /^Ya utilizó su día libre por cumpleaños este año\.$/,
  /^Debe seleccionar la fecha del día libre por cumpleaños\.$/,
  /^El día libre por cumpleaños debe iniciar y finalizar en la misma fecha\.$/,
  /^El beneficio de cumpleaños corresponde exactamente a 1 día\.$/,
  /^El día libre por cumpleaños solo puede solicitarse/,
  /^Solo puede solicitar el día de cumpleaños del año en curso\.$/,
  /^Ya tiene una solicitud activa que se superpone con las fechas seleccionadas\.$/,
  /^El departamento ya alcanzó el máximo de \d+ ausencia\(s\) simultánea\(s\) en esas fechas\.$/,
  /^No hay año laboral activo$/,
  /^No se encontró balance de vacaciones para el usuario$/,
  /^Balance insuficiente\./,
  /^Los Directores deben adjuntar obligatoriamente el correo con el VoBo del Ministro\.$/,
  /^Para Directores es obligatorio adjuntar el VoBo del Ministro\.$/,
  /^El empleado no tiene jefe superior asignado\. Contacte a RRHH\/Admin\.$/,
  /^No hay Director asignado al departamento Secretaría General para aprobación sustituta\.$/,
] as const;

const PATRONES_ERROR_TECNICO = [
  /^ECONNREFUSED$/,
  /connection (?:refused|terminated|timeout)/i,
  /syntax error at or near/i,
  /duplicate key value violates unique constraint/i,
  /relation ".+" does not exist/i,
  /invalid input syntax for type/i,
  /deadlock detected/i,
] as const;

function tieneCodigoErrorPostgres(error: Error): boolean {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code);
}

/** Identifica errores de negocio esperados de crearSolicitud (respuesta HTTP 400). */
export function esErrorValidacionNegocioCrearSolicitud(
  error: unknown
): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  if (tieneCodigoErrorPostgres(error)) {
    return false;
  }

  if (PATRONES_ERROR_TECNICO.some((patron) => patron.test(error.message))) {
    return false;
  }

  return PATRONES_VALIDACION_NEGOCIO.some((patron) => patron.test(error.message));
}
