import {
  labelDuracionPermiso,
  labelEstado,
  labelTipo,
} from '@/lib/domain/reportes/labels';
import { formatDateField } from '@/lib/utils/date-format';

/** Formateo único para pantalla, CSV, XLSX y PDF. */
export function formatearValorExport(key: string, value: unknown): unknown {
  if (value == null || value === '') return '';

  const formattedDate = formatDateField(key, value);
  if (formattedDate != null) return formattedDate;

  if (key === 'estado') return labelEstado(String(value));
  if (key === 'tipo_solicitud' || key === 'tipo_mas_usado') return labelTipo(String(value));
  if (key === 'duracion_permiso') return labelDuracionPermiso(String(value));
  if (key === 'beneficio_usado') return value ? 'Sí' : 'No';
  if (key === 'porcentaje_uso') return `${value}%`;
  if (key === 'riesgo') {
    const map: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
    return map[String(value)] ?? String(value);
  }

  return value;
}
