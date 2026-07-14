'use client';

import { useState } from 'react';
import { FileText, Image as ImageIcon, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { etiquetaAdjunto } from '@/lib/domain/requisitos-adjuntos';

export interface AdjuntoVisor {
  /** Tipo (vobo_jefe, constancia_medica, etc.) o nombre histórico. */
  tipo?: string;
  nombre?: string;
  /** Data URL o base64 crudo. */
  data: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: number;
  /** Índice en documentosAdjuntos original (para auditoría). */
  indiceOriginal?: number;
}

interface AdjuntosViewerProps {
  adjuntos: AdjuntoVisor[] | null | undefined;
  /** Para registrar el evento "adjunto_visualizado" en auditoría. */
  onAdjuntoVisualizado?: (adj: AdjuntoVisor, index: number) => void;
  /** Si es true, permite que solo usuarios autorizados vean los adjuntos. */
  autorizado: boolean;
  /** Solo mostrar metadatos (modo "sin visor"). */
  readOnly?: boolean;
}

/**
 * Determina el MIME de un data URL o base64 crudo.
 */
function detectarMime(adj: AdjuntoVisor): string {
  if (adj.mimeType) return adj.mimeType;
  if (adj.data.startsWith('data:')) {
    const match = adj.data.match(/^data:([^;,]+)/);
    if (match && match[1]) return match[1];
  }
  // Heurística: si empieza con %PDF es PDF
  if (adj.data.startsWith('JVBER') || adj.data.startsWith('data:application/pdf')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

/**
 * Convierte data URL o base64 crudo a un Blob URL usable en <iframe> /
 * <img> / window.open. Para datos vacíos devuelve null.
 */
function dataUrlHref(adj: AdjuntoVisor): string | null {
  if (!adj.data) return null;
  if (adj.data.startsWith('data:')) return adj.data;
  // base64 crudo: envolver como data URL genérico. El backend siempre
  // envía data URLs en `documentosAdjuntos[].data` para máxima fidelidad.
  const mime = detectarMime(adj);
  return `data:${mime};base64,${adj.data}`;
}

export function AdjuntosViewer({
  adjuntos,
  onAdjuntoVisualizado,
  autorizado,
  readOnly = false,
}: AdjuntosViewerProps) {
  const [adjuntoAbierto, setAdjuntoAbierto] = useState<AdjuntoVisor | null>(null);

  const lista = Array.isArray(adjuntos) ? adjuntos.filter((a) => a?.data) : [];

  if (!autorizado) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>No tiene permisos para visualizar los adjuntos de esta solicitud.</span>
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Sin adjunto registrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {lista.map((adj, idx) => {
          const tipo = adj.tipo ?? adj.nombre ?? 'adjunto';
          const mime = detectarMime(adj);
          const esPdf = mime === 'application/pdf';
          const esImagen = mime.startsWith('image/');
          const tamKB = adj.size ? Math.round(adj.size / 1024) : null;
          const indiceAuditoria = adj.indiceOriginal ?? idx;

          return (
            <div
              key={`${tipo}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  {esPdf ? (
                    <FileText className="h-5 w-5" />
                  ) : esImagen ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{etiquetaAdjunto(tipo)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {adj.nombre ?? 'archivo'} {tamKB ? `· ${tamKB} KB` : ''}
                  </p>
                  {adj.uploadedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Subido: {new Date(adj.uploadedAt).toLocaleString('es-HN')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {tipo}
                </Badge>
                {!readOnly && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdjuntoAbierto(adj);
                        onAdjuntoVisualizado?.(adj, indiceAuditoria);
                      }}
                      title="Visualizar"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <a
                      href={dataUrlHref(adj) ?? '#'}
                      download={adj.nombre ?? `adjunto-${tipo}.bin`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onAdjuntoVisualizado?.(adj, indiceAuditoria)}
                      title="Descargar"
                    >
                      <Button variant="ghost" size="sm" type="button" asChild={false}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!adjuntoAbierto}
        onOpenChange={(open) => {
          if (!open) setAdjuntoAbierto(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjuntoAbierto && (
                <>
                  {etiquetaAdjunto(adjuntoAbierto.tipo ?? adjuntoAbierto.nombre ?? '')}
                  <Badge variant="secondary" className="text-[10px]">
                    {adjuntoAbierto.tipo ?? adjuntoAbierto.nombre ?? 'adjunto'}
                  </Badge>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {adjuntoAbierto?.nombre ?? 'archivo'}
            </DialogDescription>
          </DialogHeader>
          {adjuntoAbierto && (
            <VisorContenido adjunto={adjuntoAbierto} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisorContenido({ adjunto }: { adjunto: AdjuntoVisor }) {
  const mime = detectarMime(adjunto);
  const href = dataUrlHref(adjunto);
  if (!href) return null;
  const esPdf = mime === 'application/pdf';
  const esImagen = mime.startsWith('image/');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{adjunto.nombre ?? 'archivo'}</span>
        <a
          href={href}
          download={adjunto.nombre ?? 'adjunto.bin'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground hover:bg-muted/70"
        >
          <Download className="h-3.5 w-3.5" /> Descargar
        </a>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
        {esPdf ? (
          <iframe
            src={href}
            title={adjunto.nombre ?? 'adjunto PDF'}
            className="h-[70vh] w-full"
          />
        ) : esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={adjunto.nombre ?? 'adjunto'}
            className="mx-auto max-h-[70vh] w-auto"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm">Tipo de archivo no previsualizable.</p>
            <a
              href={href}
              download={adjunto.nombre ?? 'adjunto.bin'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Descargar archivo
            </a>
          </div>
        )}
      </div>
    </div>
  );
}