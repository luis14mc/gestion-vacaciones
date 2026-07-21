import { UseFormReturn } from 'react-hook-form';
import { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { CalendarDays } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils/date-format';
import {
    manejarCambioFechaSolicitud,
    validarRangoFechasFinDeSemana,
} from '@/lib/solicitudes/date-input-rules';

interface Props {
    form: UseFormReturn<SolicitudFormData>;
    titulo?: string;
    fechaMinima?: string;
    bloquearFinDeSemana?: boolean;
}

export function VacacionesSection({
    form,
    titulo,
    fechaMinima,
    bloquearFinDeSemana = true,
}: Props) {
    const fechaInicio = form.watch('fechaInicio');

    return (
        <div className="border border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-4 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2" />
                {titulo || 'PERÍODO DE AUSENCIA'}
            </h3>

            {fechaMinima && (
                <p className="text-xs text-muted-foreground mb-3">
                    Fecha mínima permitida: {formatDate(fechaMinima)}
                </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <FormField
                    control={form.control}
                    name="fechaInicio"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fecha de Inicio *</FormLabel>
                            <FormControl>
                                <Input
                                    type="date"
                                    min={fechaMinima}
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                        manejarCambioFechaSolicitud(form, 'fechaInicio', e.target.value, {
                                            bloquearFinDeSemana,
                                        });
                                        const fin = form.getValues('fechaFin');
                                        if (fin) {
                                            validarRangoFechasFinDeSemana(
                                                form,
                                                e.target.value,
                                                fin,
                                                bloquearFinDeSemana
                                            );
                                        }
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="fechaFin"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fecha de Fin *</FormLabel>
                            <FormControl>
                                <Input
                                    type="date"
                                    min={fechaInicio || fechaMinima || undefined}
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                        manejarCambioFechaSolicitud(form, 'fechaFin', e.target.value, {
                                            bloquearFinDeSemana: false,
                                        });
                                        const inicio = form.getValues('fechaInicio');
                                        if (inicio) {
                                            validarRangoFechasFinDeSemana(
                                                form,
                                                inicio,
                                                e.target.value,
                                                bloquearFinDeSemana
                                            );
                                        }
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
