import { UseFormReturn } from 'react-hook-form';
import { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { Clock } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatDate } from '@/lib/utils/date-format';
import { manejarCambioFechaSolicitud } from '@/lib/solicitudes/date-input-rules';

interface Props {
    form: UseFormReturn<SolicitudFormData>;
    fechaMinima?: string;
    bloquearFinDeSemana?: boolean;
}

export function PermisoHorasSection({ form, fechaMinima, bloquearFinDeSemana = true }: Props) {
    const tipoPermiso = form.watch('tipoPermiso');
    const requiereHoras = tipoPermiso === '1-2h' || tipoPermiso === '2-4h';

    return (
        <div className="border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                PERMISO DE SALIDA
            </h3>

            {fechaMinima && (
                <p className="text-xs text-muted-foreground mb-3">
                    Fecha mínima permitida: {formatDate(fechaMinima)}
                </p>
            )}

            <FormField
                control={form.control}
                name="fechaInicio"
                render={({ field }) => (
                    <FormItem className="mb-4">
                        <FormLabel>Fecha del Permiso *</FormLabel>
                        <FormControl>
                            <Input
                                type="date"
                                min={fechaMinima}
                                value={field.value ?? ''}
                                onChange={(e) =>
                                    manejarCambioFechaSolicitud(form, 'fechaInicio', e.target.value, {
                                        bloquearFinDeSemana,
                                    })
                                }
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
                name="tipoPermiso"
                render={({ field }) => (
                    <FormItem className="mb-4">
                        <FormLabel>Duración *</FormLabel>
                        <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="1-2h" />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">1-2 Horas</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="2-4h" />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Medio Día</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="dia_completo" />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Día Completo</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {tipoPermiso === '1-2h' || tipoPermiso === '2-4h' ? (
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                    Este permiso no descuenta días disponibles.
                </p>
            ) : tipoPermiso === 'dia_completo' ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                    Este permiso descuenta 1 día disponible.
                </p>
            ) : null}

            {requiereHoras && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="horaSalida"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Hora de Salida *</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="horaRegreso"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Hora de Regreso *</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            )}
        </div>
    );
}
