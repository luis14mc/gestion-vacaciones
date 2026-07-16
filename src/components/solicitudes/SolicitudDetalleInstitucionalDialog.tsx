'use client';

import { useEffect, useState } from 'react';
import type { Session } from 'next-auth';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils/date-format';
import { AdjuntosInstitucionalesCard } from '@/components/solicitudes/AdjuntosInstitucionalesCard';
import { RechazoSolicitudResumen } from '@/components/solicitudes/RechazoSolicitudResumen';
import { labelEstado } from '@/lib/domain/reportes/labels';

interface SolicitudDetalleApi {
  id: number;
  codigo: string;
  usuarioId: number;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: string | number;
  estado: string;
  motivo: string | null;
  documentosAdjuntos?: unknown;
  metadata?: unknown;
  createdAt: string;
  aprobadaJefePor?: number | null;
  aprobadaDirectorPor?: number | null;
  aprobadaSecretarioPor?: number | null;
  aprobadaRrhhPor?: number | null;
  puedeVerAdjuntos?: boolean;
  motivoRechazo?: string | null;
  rechazadaPor?: number | null;
  rechazadaFecha?: string | null;
  nivelRechazo?: string | null;
  rechazadaPorNombre?: string | null;
}

interface SolicitudDetalleInstitucionalDialogProps {
  solicitudId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: Session;
}

export function SolicitudDetalleInstitucionalDialog({
  solicitudId,
  open,
  onOpenChange,
  session,
}: SolicitudDetalleInstitucionalDialogProps) {
  const [detalle, setDetalle] = useState<SolicitudDetalleApi | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !solicitudId) {
      setDetalle(null);
      setError(null);
      return;
    }

    let cancelado = false;
    setCargando(true);
    setError(null);

    fetch(`/api/solicitudes/${solicitudId}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'No se pudo cargar la solicitud');
        }
        if (!cancelado) {
          setDetalle(json.data as SolicitudDetalleApi);
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setDetalle(null);
          setError(err instanceof Error ? err.message : 'Error al cargar');
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, solicitudId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" showCloseButton>
        <DialogHeader className="border-b border-border px-4 pb-4 pt-6 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Detalle institucional de solicitud
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando detalle…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : detalle ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Código</Label>
                  <p className="text-foreground">{detalle.codigo}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Estado</Label>
                  <p className="text-foreground">{labelEstado(detalle.estado)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Fecha inicio</Label>
                  <p className="text-foreground">{formatDate(detalle.fechaInicio)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Fecha fin</Label>
                  <p className="text-foreground">{formatDate(detalle.fechaFin)}</p>
                </div>
              </div>

              {detalle.motivo ? (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Motivo</Label>
                  <p className="rounded-xl bg-muted/50 p-3 text-foreground">{detalle.motivo}</p>
                </div>
              ) : null}

              <RechazoSolicitudResumen
                estado={detalle.estado}
                motivoRechazo={detalle.motivoRechazo}
                rechazadaFecha={detalle.rechazadaFecha}
                rechazadaPorNombre={detalle.rechazadaPorNombre}
              />

              <AdjuntosInstitucionalesCard
                solicitudId={detalle.id}
                documentosAdjuntos={detalle.documentosAdjuntos}
                session={session?.user}
                accesoSolicitud={{
                  usuarioId: detalle.usuarioId,
                  aprobadaJefePor: detalle.aprobadaJefePor,
                  aprobadaDirectorPor: detalle.aprobadaDirectorPor,
                  aprobadaSecretarioPor: detalle.aprobadaSecretarioPor,
                  aprobadaRrhhPor: detalle.aprobadaRrhhPor,
                }}
                className="rounded-xl border-border shadow-none"
              />
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-4 py-4 sm:justify-end sm:px-6">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
