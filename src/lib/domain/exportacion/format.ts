import {
  labelDuracionPermiso,
  labelEstado,
  labelTipo,
} from '@/lib/domain/reportes/labels';

/** Formateo único para pantalla, CSV, XLSX y PDF. */
export function formatearValorExport(key: string, value: unknown): unknown {
  if (value == null || value === '') return '';
  if (key === 'estado') return labelEstado(String(value));
  if (key === 'tipo_solicitud' || key === 'tipo_mas_usado') return labelTipo(String(value));
  if (key === 'duracion_permiso') return labelDuracionPermiso(String(value));
  if (key === 'beneficio_usado') return value ? 'Sí' : 'No';
  if (key === 'porcentaje_uso') return `${value}%`;
  if (key === 'riesgo') {
    const map: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
    return map[String(value)] ?? String(value);
  }
  if (
    key === 'ultima_actualizacion' ||
    key === 'fecha_creacion' ||
    key === 'aprobada_jefe_fecha' ||
    key === 'aprobada_rrhh_fecha'
  ) {
    const d = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' });
    }
  }
  if (key === 'fecha_ingreso' || key === 'fecha_inicio' || key === 'fecha_fin' || key === 'fecha') {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, d] = raw.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
  }
  return value;
}
