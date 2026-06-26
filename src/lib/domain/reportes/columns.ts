import type { TipoReporteCNI } from './filters';
export { filasACsv } from '@/lib/domain/exportacion/csv';

export interface ColumnaReporte {
  key: string;
  header: string;
}

/** Fuente única de columnas — pantalla, CSV, XLSX y PDF. */
export const COLUMNAS_REPORTE: Record<TipoReporteCNI, ColumnaReporte[]> = {
  balances: [
    { key: 'colaborador', header: 'Colaborador' },
    { key: 'email', header: 'Email' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'fecha_ingreso', header: 'Fecha de ingreso' },
    { key: 'ano_laboral', header: 'Año laboral' },
    { key: 'dias_vencidos', header: 'Días vencidos' },
    { key: 'dias_proporcionales', header: 'Días proporcionales' },
    { key: 'dias_usados', header: 'Días usados' },
    { key: 'dias_pendientes', header: 'Días pendientes' },
    { key: 'dias_disponibles', header: 'Días disponibles' },
    { key: 'ultima_actualizacion', header: 'Última actualización' },
  ],
  solicitudes: [
    { key: 'codigo', header: 'Código' },
    { key: 'colaborador', header: 'Colaborador' },
    { key: 'email', header: 'Email' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'tipo_solicitud', header: 'Tipo de solicitud' },
    { key: 'fecha_inicio', header: 'Fecha inicio' },
    { key: 'fecha_fin', header: 'Fecha fin' },
    { key: 'dias_solicitados', header: 'Días solicitados' },
    { key: 'duracion_permiso', header: 'Horas/duración' },
    { key: 'estado', header: 'Estado' },
    { key: 'jefe_aprobador', header: 'Jefe aprobador' },
    { key: 'aprobada_jefe_fecha', header: 'Fecha aprobación jefe' },
    { key: 'rrhh_aprobador', header: 'RRHH aprobador' },
    { key: 'aprobada_rrhh_fecha', header: 'Fecha aprobación RRHH' },
    { key: 'motivo', header: 'Motivo' },
    { key: 'observaciones', header: 'Observaciones' },
    { key: 'fecha_creacion', header: 'Fecha creación' },
  ],
  departamentos: [
    { key: 'departamento', header: 'Departamento' },
    { key: 'codigo', header: 'Código' },
    { key: 'total_colaboradores', header: 'Total colaboradores activos' },
    { key: 'total_vencidos', header: 'Total días vencidos' },
    { key: 'total_proporcionales', header: 'Total días proporcionales' },
    { key: 'total_usados', header: 'Total días usados' },
    { key: 'total_pendientes', header: 'Total días pendientes' },
    { key: 'total_disponibles', header: 'Total días disponibles' },
    { key: 'solicitudes_pendientes', header: 'Solicitudes pendientes' },
    { key: 'solicitudes_aprobadas', header: 'Solicitudes aprobadas' },
    { key: 'solicitudes_rechazadas', header: 'Solicitudes rechazadas' },
    { key: 'personas_en_vacaciones', header: 'Personas actualmente de vacaciones' },
    { key: 'porcentaje_uso', header: '% uso' },
  ],
  ausentismo: [
    { key: 'mes', header: 'Mes' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'total_solicitudes', header: 'Total solicitudes aprobadas/finalizadas' },
    { key: 'total_dias', header: 'Total días aprobados' },
    { key: 'colaboradores_distintos', header: 'Colaboradores distintos ausentes' },
    { key: 'promedio_dias', header: 'Promedio días por solicitud' },
    { key: 'tipo_mas_usado', header: 'Tipo más usado' },
  ],
  cumpleanos: [
    { key: 'colaborador', header: 'Colaborador' },
    { key: 'email', header: 'Email' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'fecha_nacimiento', header: 'Fecha nacimiento' },
    { key: 'mes_cumpleanos', header: 'Mes cumpleaños' },
    { key: 'fecha_solicitada', header: 'Fecha solicitada' },
    { key: 'estado', header: 'Estado' },
    { key: 'ano', header: 'Año' },
    { key: 'beneficio_usado', header: 'Ya utilizó beneficio' },
    { key: 'jefe_aprobador', header: 'Jefe aprobador' },
    { key: 'rrhh_aprobador', header: 'RRHH aprobador' },
  ],
  permisos_salida: [
    { key: 'colaborador', header: 'Colaborador' },
    { key: 'email', header: 'Email' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'fecha', header: 'Fecha' },
    { key: 'hora_salida', header: 'Hora salida' },
    { key: 'hora_regreso', header: 'Hora regreso' },
    { key: 'duracion_permiso', header: 'Duración' },
    { key: 'estado', header: 'Estado' },
    { key: 'motivo', header: 'Motivo' },
    { key: 'jefe_aprobador', header: 'Jefe aprobador' },
    { key: 'rrhh_aprobador', header: 'RRHH aprobador' },
  ],
  cierre_ano: [
    { key: 'colaborador', header: 'Colaborador' },
    { key: 'ano_laboral', header: 'Año laboral' },
    { key: 'dias_vencidos', header: 'Días vencidos' },
    { key: 'dias_proporcionales', header: 'Días proporcionales' },
    { key: 'dias_disponibles', header: 'Días disponibles' },
    { key: 'fecha_fin_ano_laboral', header: 'Fecha fin año laboral' },
    { key: 'dias_restantes_cierre', header: 'Días restantes para cierre' },
    { key: 'riesgo', header: 'Riesgo' },
  ],
};

export const DESCRIPCIONES_REPORTE: Record<TipoReporteCNI, string> = {
  balances:
    'Saldo de vacaciones por colaborador: días vencidos, proporcionales, usados, pendientes y disponibles.',
  solicitudes:
    'Historial de solicitudes de ausencia con flujo de aprobación jefe y RRHH.',
  departamentos:
    'Uso agregado de vacaciones y solicitudes por departamento.',
  ausentismo:
    'Ausentismo real basado solo en solicitudes aprobadas por RRHH o finalizadas.',
  cumpleanos:
    'Seguimiento del día libre por cumpleaños y quién ya utilizó el beneficio.',
  permisos_salida:
    'Permisos de salida por horas; no se suman como días completos salvo duración día completo.',
  cierre_ano:
    'Colaboradores con días disponibles antes del cierre del año laboral activo.',
};

export function filasReporte(data: unknown, tipo: TipoReporteCNI): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const payload = data as Record<string, unknown>;
  if (tipo === 'ausentismo') {
    return (payload.filas as Record<string, unknown>[]) ?? [];
  }
  return (payload.filas as Record<string, unknown>[]) ?? [];
}
