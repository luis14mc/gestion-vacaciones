import { Cake } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { SolicitudFormData } from '@/lib/validations/solicitud.schema';
import type { ElegibilidadCumpleanos } from '@/lib/domain/cumpleanos';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  form: UseFormReturn<SolicitudFormData>;
  elegibilidad: ElegibilidadCumpleanos | null;
}

export function CumpleanosSection({ form, elegibilidad }: Props) {
  return (
    <div className="border border-pink-200 bg-pink-50/50 dark:bg-pink-950/20 dark:border-pink-900 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 space-y-4">
      <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-300 flex items-center">
        <Cake className="w-5 h-5 mr-2" />
        DÍA LIBRE POR CUMPLEAÑOS
      </h3>

      <Alert className="border-pink-200 bg-white/70 dark:bg-background/60">
        <AlertDescription className="text-sm">
          {elegibilidad?.mensaje ??
            'Tiene derecho a 1 día libre al año, únicamente durante el mes en que cumple años.'}
        </AlertDescription>
      </Alert>

      <FormField
        control={form.control}
        name="fechaInicio"
        render={({ field }) => (
          <FormItem className="max-w-sm">
            <FormLabel>Fecha del día libre *</FormLabel>
            <FormControl>
              <Input
                type="date"
                disabled={!elegibilidad?.puedeSolicitar}
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  form.setValue('fechaFin', event.target.value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
