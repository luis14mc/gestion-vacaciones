'use client';

import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date-format';
import {
  esEstadoRechazado,
  nivelRechazoDesdeEstado,
} from '@/lib/domain/rechazo-solicitud';
import { labelEstado } from '@/lib/domain/reportes/labels';

interface RechazoSolicitudResumenProps {
  estado: string;
  motivoRechazo?: string | null;
  rechazadaFecha?: string | null;
  rechazadaPorNombre?: string | null;
}

export function RechazoSolicitudResumen({
  estado,
  motivoRechazo,
  rechazadaFecha,
  rechazadaPorNombre,
}: RechazoSolicitudResumenProps) {
  if (!esEstadoRechazado(estado)) return null;

  const nivel = nivelRechazoDesdeEstado(estado);

  return (
    <div className="space-y-2 rounded-xl border border-red-200/80 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <span className="text-sm font-medium text-foreground">Solicitud rechazada</span>
        {nivel ? (
          <Badge variant="outline" className="border-red-300 text-red-800 dark:text-red-200">
            Nivel: {nivel}
          </Badge>
        ) : null}
        <Badge variant="secondary" className="text-xs">
          {labelEstado(estado)}
        </Badge>
      </div>

      {motivoRechazo ? (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Motivo del rechazo</Label>
          <p className="rounded-lg bg-background/80 p-3 text-sm text-foreground">{motivoRechazo}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {rechazadaPorNombre ? <span>Rechazada por: {rechazadaPorNombre}</span> : null}
        {rechazadaFecha ? <span>Fecha: {formatDateTime(rechazadaFecha)}</span> : null}
      </div>
    </div>
  );
}
