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
import type { AdjuntoRequerido } from '@/lib/domain/requisitos-adjuntos';

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

interface AdjuntoSubido {
  tipo: string;
  nombre: string;
  data: string;
  mimeType?: string;
  size?: number;
}

interface FormularioSolicitudProps {
  usuarioId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FormularioSolicitud({ usuarioId, onSuccess, onCancel }: FormularioSolicitudProps) {
  const [submitting, setSubmitting] = useState(false);
  const [elegibilidadCumpleanos, setElegibilidadCumpleanos] = useState<ElegibilidadCumpleanos | null>(null);
  const [flujoAprobacion, setFlujoAprobacion] = useState<
    | (FlujoAprobacionNuevaSolicitud & {
        adjuntosRequeridos?: AdjuntoRequerido[];
        tipoVoBoRequerido?: string | null;
        etiquetaVoBo?: string | null;
        requiereVoBo?: boolean;
        requiereConstanciaMedica?: boolean;
      })
    | null
  >(null);
  const [cargandoFlujo, setCargandoFlujo] = useState(true);
  // Fase 3: el backend exige adjuntos por rol. Mantenemos un map
  // tipoAdjunto → archivo en base64. Cualquier rol puede tener 1 o
  // varios adjuntos obligatorios (vobo_jefe + constancia_medica, etc.).
  const [adjuntosPorTipo, setAdjuntosPorTipo] = useState<Record<string, AdjuntoSubido>>({});

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
  const adjuntosRequeridos: AdjuntoRequerido[] = flujoAprobacion?.adjuntosRequeridos ?? [];
  const tiposAdjuntosRequeridos = adjuntosRequeridos.map((a) => a.tipo);
  const tieneAdjuntosRequeridos = tiposAdjuntosRequeridos.length > 0;
  const todosLosAdjuntosCargados = tiposAdjuntosRequeridos.every(
    (t) => !!adjuntosPorTipo[t]?.data
  );
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
    const params = new URLSearchParams({ tipo: tipoFlujo });
    if (esPermiso && tipoPermiso) params.set('duracionPermiso', tipoPermiso);
    setCargandoFlujo(true);

    fetch(`/api/solicitudes/flujo-aprobacion?${params.toString()}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setFlujoAprobacion(json.data);
          // Reset adjuntos que ya no aplican al nuevo flujo.
          setAdjuntosPorTipo((prev) => {
            const next: Record<string, AdjuntoSubido> = {};
            const required = (json.data?.adjuntosRequeridos ?? []).map(
              (a: AdjuntoRequerido) => a.tipo
            );
            for (const t of required) {
              if (prev[t]) next[t] = prev[t];
            }
            return next;
          });
        } else {
          setFlujoAprobacion(null);
        }
      })
      .catch(() => setFlujoAprobacion(null))
      .finally(() => setCargandoFlujo(false));
  }, [tipoSeleccionado?.tipo, esPermiso ? tipoPermiso : '']);

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

    if (tieneAdjuntosRequeridos && !todosLosAdjuntosCargados) {
      const faltantes = tiposAdjuntosRequeridos
        .filter((t) => !adjuntosPorTipo[t]?.data)
        .map((t) =>
          adjuntosRequeridos.find((a) => a.tipo === t)?.mensajeFaltante ?? `Falta ${t}`
        );
      sileo.error({
        title: 'Adjuntos requeridos',
        description: faltantes.join(' '),
      });
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

      const documentosAdjuntos = Object.values(adjuntosPorTipo).filter((a) => a.data);

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
        documentosAdjuntos,
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
        setAdjuntosPorTipo({});
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

  // ── Handlers de carga de adjuntos ───────────────────────────────────────
  const handleAdjuntoChange = (tipo: string, file: File | null) => {
    if (!file) {
      setAdjuntosPorTipo((prev) => {
        const next = { ...prev };
        delete next[tipo];
        return next;
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setAdjuntosPorTipo((prev) => ({
        ...prev,
        [tipo]: {
          tipo,
          nombre: file.name,
          data: dataUrl,
          mimeType: file.type,
          size: file.size,
        },
      }));
    };
    reader.readAsDataURL(file);
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

            {tieneAdjuntosRequeridos && (
              <div className="space-y-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 sm:p-6">
                <FormLabel className="text-base font-semibold block">
                  Adjuntos institucionales (obligatorios)
                </FormLabel>
                <p className="text-sm text-muted-foreground mb-4">
                  Por favor adjunte los archivos solicitados. Se aceptan PDF o imágenes.
                </p>
                {adjuntosRequeridos.map((req) => {
                  const cargado = !!adjuntosPorTipo[req.tipo]?.data;
                  return (
                    <div
                      key={req.tipo}
                      className="space-y-2 rounded-md border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {req.etiqueta}{' '}
                          <span className="text-destructive">*</span>
                        </span>
                        <span
                          className={
                            cargado
                              ? 'text-xs font-medium text-emerald-600'
                              : 'text-xs text-muted-foreground'
                          }
                        >
                          {cargado ? 'Adjunto cargado' : 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.mensajeFaltante}</p>
                      <Input
                        type="file"
                        accept={req.acepta ?? '.pdf,image/*'}
                        className="bg-background"
                        onChange={(e) => handleAdjuntoChange(req.tipo, e.target.files?.[0] ?? null)}
                      />
                      {cargado && (
                        <p className="text-xs text-muted-foreground">
                          Archivo seleccionado: {adjuntosPorTipo[req.tipo]?.nombre}
                        </p>
                      )}
                    </div>
                  );
                })}
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
