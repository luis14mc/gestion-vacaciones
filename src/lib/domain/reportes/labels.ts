/** Etiquetas legibles para reportes CNI */

export const ESTADO_SOLICITUD_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_jefe: 'Pendiente de aprobación de jefe',
  aprobada_jefe: 'Aprobada por jefe / pendiente RRHH',
  pendiente_rrhh: 'Pendiente de aprobación RRHH',
  aprobada_rrhh: 'Aprobada por RRHH',
  rechazada_jefe: 'Rechazada por jefe',
  rechazada_rrhh: 'Rechazada por RRHH',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
};

export const TIPO_SOLICITUD_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  permiso_salida: 'Permiso de salida',
  licencia_medica: 'Licencia médica',
  permiso_personal: 'Permiso personal',
  licencia_paternidad: 'Licencia de paternidad',
  licencia_maternidad: 'Licencia de maternidad',
  compensacion: 'Compensación',
  dia_cumpleanos: 'Día libre por cumpleaños',
};

export const DURACION_PERMISO_LABELS: Record<string, string> = {
  '1-2h': '1 a 2 horas',
  '2-4h': '2 a 4 horas',
  dia_completo: 'Día completo',
};

export function labelEstado(estado: string | null | undefined): string {
  if (!estado) return '—';
  return ESTADO_SOLICITUD_LABELS[estado] ?? estado;
}

export function labelTipo(tipo: string | null | undefined): string {
  if (!tipo) return '—';
  return TIPO_SOLICITUD_LABELS[tipo] ?? tipo;
}

export function labelDuracionPermiso(duracion: string | null | undefined): string {
  if (!duracion) return '—';
  return DURACION_PERMISO_LABELS[duracion] ?? duracion;
}
