import { UseFormReturn } from 'react-hook-form';
import { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { CalendarDays } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface Props {
    form: UseFormReturn<SolicitudFormData>;
    titulo?: string;
}

export function VacacionesSection({ form, titulo }: Props) {
    return (
        <div className="border border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-4 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2" />
                {titulo || 'PERÍODO DE AUSENCIA'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <FormField
                    control={form.control}
                    name="fechaInicio"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fecha de Inicio *</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
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
                                    min={form.watch('fechaInicio') || undefined}
                                    {...field}
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
