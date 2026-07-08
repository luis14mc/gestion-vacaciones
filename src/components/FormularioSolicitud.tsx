'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sileo } from 'sileo';
import { notify } from '@/lib/swal';
import { formatDate } from '@/lib/utils/date-format';
import { debeExigirVoBoMinistro } from '@/lib/domain/solicitud-adjuntos';
import { mensajeFlujoVisible } from '@/lib/domain/solicitud-flujo-aprobacion';
import { Loader2 } from 'lucide-react';

import { solicitudSchema, type SolicitudFormData } from '@/lib/validations/solicitud.schema';
import { useTiposAusencia } from '@/hooks/useTiposAusencia';
import { useBalances } from '@/hooks/useBalances';
import { useLaborDays } from '@/hooks/useLaborDays';

import { VacacionesSection } from './solicitudes/VacacionesSection';
import { PermisoHorasSection } from './solicitudes/PermisoHorasSection';
import { CumpleanosSection } from './solicitudes/CumpleanosSection';
import { BalanceViewer } from './solicitudes/BalanceViewer';
import type { ElegibilidadCumpleanos } from '@/lib/domain/cumpleanos';
import type { FlujoAprobacionNuevaSolicitud } from '@/lib/domain/solicitud-flujo-aprobacion';

const TIPO_DIA_CUMPLEANOS = {
  id: 'dia_cumpleanos',
  nombre: 'Día libre por cumpleaños',
  tipo: 'dia_cumpleanos',
  activo: true,
  permiteHoras: false,
} as const;

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface FormularioSolicitudProps {
  usuarioId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FormularioSolicitud({ usuarioId, onSuccess, onCancel }: FormularioSolicitudProps) {
  const [submitting, setSubmitting] = useState(false);
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null);
  const [elegibilidadCumpleanos, setElegibilidadCumpleanos] = useState<ElegibilidadCumpleanos | null>(null);
  const [flujoAprobacion, setFlujoAprobacion] = useState<FlujoAprobacionNuevaSolicitud | null>(null);
  const [cargandoFlujo, setCargandoFlujo] = useState(true);

  // Initializing React Query Hooks
  const { data: tiposAusencia = [], isLoading: loadingTipos } = useTiposAusencia();
  const { data: balances = [] } = useBalances(usuarioId);

  // Initializing Form
  const form = useForm<SolicitudFormData>({
    resolver: zodResolver(solicitudSchema) as any,
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
      requiereMotivo: false,
    },
  });

  const tipoAusenciaId = form.watch('tipoAusenciaId');
  const tipoPermiso = form.watch('tipoPermiso');
  const fechaInicio = form.watch('fechaInicio');
  const fechaFin = form.watch('fechaFin');

  // Logic Selectors
  const tipoSeleccionado = tiposAusencia.find((t: any) => String(t.id) === tipoAusenciaId);
  const esPermiso = tipoSeleccionado?.permiteHoras === true;
  const esVacaciones = tipoSeleccionado?.tipo === 'vacaciones';
  const esLicenciaMedica = tipoSeleccionado?.tipo === 'licencia_medica';
  const esCumpleanos = tipoSeleccionado?.tipo === 'dia_cumpleanos';
  const necesitaFechas = !!tipoSeleccionado && !esPermiso && !esCumpleanos;
  const requiereVoBoMinistro = debeExigirVoBoMinistro({
    requiereVoBoFlujo: flujoAprobacion?.requiereVoBoMinistro ?? false,
    tipo: tipoSeleccionado?.tipo ?? '',
    duracionPermiso: esPermiso ? tipoPermiso : undefined,
  });
  const requiereAdjunto = requiereVoBoMinistro || esLicenciaMedica;
  const pasosProcesoVisibles = (flujoAprobacion?.pasosProceso ?? []).filter(
    (paso) => requiereVoBoMinistro || !/VoBo Ministro/i.test(paso)
  );
  const mensajeFlujo = mensajeFlujoVisible({
    flujo: flujoAprobacion,
    tipo: tipoSeleccionado?.tipo ?? '',
    duracionPermiso: esPermiso ? tipoPermiso : undefined,
  });

  const tiposPermitidos = ['vacaciones', 'permiso_salida', 'licencia_medica', 'dia_cumpleanos'];
  const tiposFiltradosBase = tiposAusencia.filter((t: any) => tiposPermitidos.includes(t.tipo));
  const tipoCumpleanosApi = tiposFiltradosBase.find((t: any) => t.tipo === 'dia_cumpleanos');
  const tiposFiltrados = [
    ...tiposFiltradosBase.filter((t: any) => t.tipo !== 'dia_cumpleanos'),
    tipoCumpleanosApi ?? TIPO_DIA_CUMPLEANOS,
  ];

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
  
  const mostrarBalances = esVacaciones;

  // Set unit and requiereMotivo default depending on selection
  useEffect(() => {
    if (tipoSeleccionado) {
      form.setValue('unidad', tipoSeleccionado.permiteHoras ? 'horas' : 'dias');

      const esVacacionesTemp = tipoSeleccionado.tipo === 'vacaciones';
      const esPermisoTemp = tipoSeleccionado.permiteHoras;
      const esCumpleanosTemp = tipoSeleccionado.tipo === 'dia_cumpleanos';
      form.setValue('requiereMotivo', esPermisoTemp || (!esVacacionesTemp && !esCumpleanosTemp));

      if (esCumpleanosTemp) {
        form.setValue('motivo', '');
        form.setValue('fechaFin', form.getValues('fechaInicio') || '');
        setArchivoBase64(null);
      }
    }
  }, [tipoSeleccionado, form]);

  useEffect(() => {
    fetch('/api/solicitudes/cumpleanos-elegibilidad', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setElegibilidadCumpleanos(json.data);
        }
      })
      .catch(() => setElegibilidadCumpleanos(null));
  }, []);

  useEffect(() => {
    const tipoFlujo = tipoSeleccionado?.tipo ?? 'vacaciones';
    setCargandoFlujo(true);

    fetch(`/api/solicitudes/flujo-aprobacion?tipo=${encodeURIComponent(tipoFlujo)}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setFlujoAprobacion(json.data);
        } else {
          setFlujoAprobacion(null);
        }
      })
      .catch(() => setFlujoAprobacion(null))
      .finally(() => setCargandoFlujo(false));
  }, [tipoSeleccionado?.tipo]);

  useEffect(() => {
    if (!requiereAdjunto) {
      setArchivoBase64(null);
    }
  }, [requiereAdjunto]);

  const onSubmit = async (data: SolicitudFormData) => {
    if (esCumpleanos && !elegibilidadCumpleanos?.puedeSolicitar) {
      sileo.error({
        title: 'No disponible',
        description: elegibilidadCumpleanos?.mensaje || 'No puede solicitar el día de cumpleaños en este momento.',
      });
      return;
    }

    if (esVacaciones && balanceActual && diasRestantes < 0) {
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
      const fechaFinVal = esPermiso
        ? fechaInicioVal
        : esCumpleanos
          ? fechaInicioVal
          : (data.fechaFin || undefined);

      const duracionPermiso = (data.tipoPermiso as '1-2h' | '2-4h' | 'dia_completo') || undefined;

      const payload = {
        usuarioId,
        tipo: tipoSeleccionado?.tipo || data.tipoAusenciaId,
        fechaInicio: fechaInicioVal,
        fechaFin: fechaFinVal,
        diasSolicitados: esCumpleanos
          ? 1
          : esPermiso
            ? (duracionPermiso === 'dia_completo' ? 1 : 0)
            : diasLaborables,
        horaSalida: data.horaSalida || undefined,
        horaRegreso: data.horaRegreso || undefined,
        motivo: data.motivo || undefined,
        observaciones: data.observaciones || undefined,
        duracionPermiso,
        documentosAdjuntos:
          archivoBase64 && (esLicenciaMedica || requiereVoBoMinistro)
            ? [{ nombre: esLicenciaMedica ? 'constancia_medica' : 'vobo_ministro', data: archivoBase64 }]
            : [],
      };

      const response = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const result = text
        ? JSON.parse(text)
        : { success: false, error: 'El servidor no devolvió una respuesta válida.' };

      if (result.success) {
        const mensajeExito = flujoAprobacion?.pasaDirectoRrhh
          ? 'Tu solicitud ha sido creada y derivada directamente a Recursos Humanos.'
          : requiereVoBoMinistro
            ? 'Tu solicitud ha sido creada y será revisada por Recursos Humanos tras el VoBo del Ministro.'
            : 'Tu solicitud ha sido creada exitosamente y está pendiente de aprobación.';
        notify.success('¡Solicitud enviada!', mensajeExito);
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

  if (loadingTipos) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto border-none shadow-none bg-transparent">
      <CardHeader className="px-0 text-center">
        <CardTitle className="text-xl tracking-tight sm:text-2xl">SOLICITUD DE PERMISO / VACACIONES</CardTitle>
        <CardDescription>
          Fecha de solicitud: {formatDate(new Date())}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">

            <FormField
              control={form.control as any}
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

            {esPermiso && <PermisoHorasSection form={form as any} />}
            {esCumpleanos && (
              <CumpleanosSection form={form as any} elegibilidad={elegibilidadCumpleanos} />
            )}
            {necesitaFechas && (
              <VacacionesSection
                form={form as any}
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

            {tipoAusenciaId && !esCumpleanos && (
              <FormField
                control={form.control as any}
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
                control={form.control as any}
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
              <div className="space-y-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 sm:p-6">
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

            <div className="mt-8 flex flex-col justify-end gap-3 border-t border-border pt-6 sm:flex-row">
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
                disabled={
                  submitting ||
                  (esVacaciones && balanceActual && diasRestantes < 0) ||
                  (esCumpleanos && !elegibilidadCumpleanos?.puedeSolicitar)
                }
                className="w-full sm:w-auto"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Solicitud
              </Button>
            </div>

          </form>
        </Form>
      </CardContent>

      <CardFooter className="mt-6 rounded-xl bg-muted/30">
        <div className="w-full p-2 text-xs text-muted-foreground">
          <p className="font-semibold mb-2">Proceso de aprobación:</p>
          {mensajeFlujo && (
            <p className="mb-2 text-[11px] leading-relaxed">{mensajeFlujo}</p>
          )}
          {cargandoFlujo ? (
            <p className="text-[11px]">Cargando flujo de aprobación…</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {(pasosProcesoVisibles).map((paso) => (
                <li key={paso}>{paso}</li>
              ))}
            </ul>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
