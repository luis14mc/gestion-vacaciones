'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sileo } from 'sileo';
import Swal from 'sweetalert2';
import { Loader2 } from 'lucide-react';

import { solicitudSchema, type SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { useTiposAusencia } from '@/hooks/useTiposAusencia';
import { useBalances } from '@/hooks/useBalances';
import { useLaborDays } from '@/hooks/useLaborDays';

import { VacacionesSection } from './solicitudes/VacacionesSection';
import { PermisoHorasSection } from './solicitudes/PermisoHorasSection';
import { BalanceViewer } from './solicitudes/BalanceViewer';

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface FormularioSolicitudProps {
  usuarioId: number;
  esDirector?: boolean;
  esJefe?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FormularioSolicitud({ usuarioId, esDirector, esJefe, onSuccess, onCancel }: FormularioSolicitudProps) {
  const [submitting, setSubmitting] = useState(false);
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null);

  // Initializing React Query Hooks
  const { data: tiposAusencia = [], isLoading: loadingTipos } = useTiposAusencia();
  const { data: balances = [], isLoading: loadingBalances } = useBalances(usuarioId);

  // Initializing Form
  const form = useForm<SolicitudFormData>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      tipoAusenciaId: '',
      unidad: 'dias',
      tipoPermiso: '',
      fechaInicio: '',
      fechaFin: '',
      horaSalida: '',
      horaRegreso: '',
      cantidad: '',
      motivo: '',
      observaciones: '',
    },
  });

  const tipoAusenciaId = form.watch('tipoAusenciaId');
  const fechaInicio = form.watch('fechaInicio');
  const fechaFin = form.watch('fechaFin');

  // Logic Selectors
  const tipoSeleccionado = tiposAusencia.find((t: any) => String(t.id) === tipoAusenciaId);
  const esPermiso = tipoSeleccionado?.permiteHoras === true;
  const esVacaciones = tipoSeleccionado?.tipo === 'vacaciones';
  const esLicenciaMedica = tipoSeleccionado?.tipo === 'licencia_medica';
  const necesitaFechas = !!tipoSeleccionado && !esPermiso;
  const requiereAdjunto = esDirector || esLicenciaMedica;

  const tiposPermitidos = ['vacaciones', 'permiso_salida', 'licencia_medica'];
  const tiposFiltrados = tiposAusencia.filter((t: any) => tiposPermitidos.includes(t.tipo));

  // Balance & Days Calculators
  const { diasLaborables } = useLaborDays(fechaInicio, fechaFin);

  const balanceActual = balances.find(
    (b: any) =>
      b.tipoAusencia === (tipoSeleccionado?.tipo || tipoAusenciaId) ||
      b.tipo_ausencia === (tipoSeleccionado?.tipo || tipoAusenciaId)
  );

  const diasDisponibles = balanceActual
    ? Number.parseFloat(balanceActual.cantidadDisponible ?? balanceActual.cantidad_disponible ?? '0')
    : 0;

  const diasRestantes = diasDisponibles - diasLaborables;
  
  const mostrarBalances = esVacaciones || esLicenciaMedica;

  // Set unit default depending on selection
  useEffect(() => {
    if (tipoSeleccionado) {
      form.setValue('unidad', tipoSeleccionado.permiteHoras ? 'horas' : 'dias');
    }
  }, [tipoSeleccionado, form]);

  const onSubmit = async (data: SolicitudFormData) => {
    if ((esVacaciones || esLicenciaMedica) && balanceActual && diasRestantes < 0) {
      sileo.error({ title: 'Error', description: 'No tienes suficientes días disponibles.' });
      return;
    }

    if (requiereAdjunto && !archivoBase64) {
      const errorMsg = esLicenciaMedica 
        ? 'Debe adjuntar el certificado médico.' 
        : 'Debe adjuntar el correo con el VoBo del Ministro.';
      sileo.error({ title: 'Adjunto requerido', description: errorMsg });
      return;
    }

    setSubmitting(true);

    try {
      const fechaInicioVal = data.fechaInicio || undefined;
      const fechaFinVal = esPermiso ? fechaInicioVal : (data.fechaFin || undefined);

      const payload = {
        usuarioId,
        tipo: tipoSeleccionado?.tipo || data.tipoAusenciaId,
        fechaInicio: fechaInicioVal,
        fechaFin: fechaFinVal,
        diasSolicitados: esPermiso ? 1 : diasLaborables,
        horaSalida: data.horaSalida || undefined,
        horaRegreso: data.horaRegreso || undefined,
        motivo: data.motivo || null,
        observaciones: data.observaciones || null,
        duracionPermiso: (data.tipoPermiso as '1-2h' | '2-4h' | 'dia_completo') || undefined,
        documentosAdjuntos: archivoBase64 ? [{ nombre: esLicenciaMedica ? 'constancia_medica' : 'vobo_ministro', data: archivoBase64 }] : [],
      };

      const response = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        Swal.fire({
          title: '¡Solicitud Enviada!',
          text: 'Tu solicitud ha sido creada exitosamente y está pendiente de aprobación por tu jefe inmediato.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
        });
        form.reset();
        onSuccess?.();
      } else {
        sileo.error({ title: 'Error', description: result.error || 'No se pudo crear la solicitud.' });
      }
    } catch (error) {
      console.error('Error creating request:', error);
      sileo.error({ title: 'Error', description: 'Error de Conexión, por favor intenta de nuevo.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTipos || loadingBalances) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto border-none shadow-none bg-transparent">
      <CardHeader className="text-center px-0">
        <CardTitle className="text-2xl tracking-tight">SOLICITUD DE PERMISO / VACACIONES</CardTitle>
        <CardDescription>
          Fecha de solicitud: {new Date().toLocaleDateString('es-HN')}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            <FormField
              control={form.control}
              name="tipoAusenciaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Tipo de Solicitud *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Seleccione un tipo de solicitud" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tiposFiltrados.map((tipo: any) => (
                        <SelectItem key={tipo.id} value={String(tipo.id)}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {esPermiso && <PermisoHorasSection form={form} />}
            {necesitaFechas && (
              <VacacionesSection
                form={form}
                titulo={esVacaciones ? 'VACACIONES' : tipoSeleccionado?.nombre?.toUpperCase()}
              />
            )}

            {mostrarBalances && (
              <BalanceViewer
                diasDisponibles={diasDisponibles}
                diasSolicitados={diasLaborables}
                diasRestantes={diasRestantes}
              />
            )}

            {tipoAusenciaId && (
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      Motivo / Justificación {esPermiso || !esVacaciones ? '*' : '(Opcional)'}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa el motivo de su solicitud"
                        className="resize-none min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {esVacaciones && (
              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Observaciones (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observaciones adicionales"
                        className="resize-none min-h-[80px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {requiereAdjunto && (
              <div className="space-y-2 border border-dashed border-primary/30 rounded-lg p-6 bg-primary/5">
                <FormLabel className="text-base font-semibold block">
                  {esLicenciaMedica ? 'Constancia Médica (Obligatorio)' : 'VoBo del Ministro (Obligatorio)'}
                </FormLabel>
                <p className="text-sm text-muted-foreground mb-4">
                  {esLicenciaMedica 
                    ? 'Por favor adjunte el certificado médico que valide esta solicitud.'
                    : 'Por favor adjunte una captura o el archivo PDF del correo con el VoBo del Ministro para esta solicitud.'}
                </p>
                <Input 
                  type="file" 
                  accept=".pdf,image/*" 
                  className="bg-background"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setArchivoBase64(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setArchivoBase64(null);
                    }
                  }}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || (esVacaciones && balanceActual && diasRestantes < 0)}
                className="w-full sm:w-auto"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Solicitud
              </Button>
            </div>

          </form>
        </Form>
      </CardContent>

      <CardFooter className="bg-muted/30 rounded-xl mt-6">
        <div className="w-full text-xs text-muted-foreground p-2">
          <p className="font-semibold mb-2">Proceso de aprobación:</p>
          <ul className="list-disc list-inside space-y-1">
            {esDirector ? (
              <>
                <li>1. VoBo Ministro (Mediante documento adjunto)</li>
                <li>2. Revisión y validación de Recursos Humanos</li>
              </>
            ) : esJefe ? (
              <>
                <li>1. Aprobación de Director de Área</li>
                <li>2. Revisión y aprobación de Recursos Humanos</li>
              </>
            ) : (
              <>
                <li>1. Aprobación de Jefe Inmediato</li>
                <li>2. Revisión y aprobación de Recursos Humanos</li>
              </>
            )}
            <li>Último paso: Notificación al solicitante</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
}
