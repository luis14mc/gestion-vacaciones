import { UseFormReturn, Path } from 'react-hook-form';
import { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { esFinDeSemana } from '@/lib/domain/solicitud-validaciones';

const MSG_FIN_DE_SEMANA = 'No se pueden solicitar permisos para sábado o domingo.';

export function manejarCambioFechaSolicitud(
  form: UseFormReturn<SolicitudFormData>,
  fieldName: Path<SolicitudFormData>,
  value: string,
  options: { bloquearFinDeSemana?: boolean }
): void {
  if (value && options.bloquearFinDeSemana && esFinDeSemana(value)) {
    form.setError(fieldName, { type: 'manual', message: MSG_FIN_DE_SEMANA });
    return;
  }
  form.clearErrors(fieldName);
  form.setValue(fieldName, value, { shouldValidate: true, shouldDirty: true });
}

export function validarRangoFechasFinDeSemana(
  form: UseFormReturn<SolicitudFormData>,
  fechaInicio: string,
  fechaFin: string,
  bloquearFinDeSemana: boolean
): void {
  if (!bloquearFinDeSemana || !fechaInicio || !fechaFin) return;

  const inicio = new Date(`${fechaInicio.slice(0, 10)}T12:00:00`);
  const fin = new Date(`${fechaFin.slice(0, 10)}T12:00:00`);
  if (fin < inicio) return;

  const actual = new Date(inicio);
  while (actual <= fin) {
    const ymd = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}`;
    if (esFinDeSemana(ymd)) {
      form.setError('fechaInicio', { type: 'manual', message: MSG_FIN_DE_SEMANA });
      return;
    }
    actual.setDate(actual.getDate() + 1);
  }
  form.clearErrors('fechaInicio');
}
