import { UseFormReturn } from 'react-hook-form';
import { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { Clock } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
    form: UseFormReturn<SolicitudFormData>;
}

export function PermisoHorasSection({ form }: Props) {
    const tipoPermiso = form.watch('tipoPermiso');

    return (
        <div className="border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                PERMISO DE SALIDA
            </h3>

            <FormField
                control={form.control}
                name="fechaInicio"
                render={({ field }) => (
                    <FormItem className="mb-4">
                        <FormLabel>Fecha del Permiso *</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
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
                                defaultValue={field.value}
                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="1-2hrs" />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">1-2 Horas</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="2-4hrs" />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">2-4 Horas</FormLabel>
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

            {tipoPermiso && tipoPermiso !== 'dia_completo' && (
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
