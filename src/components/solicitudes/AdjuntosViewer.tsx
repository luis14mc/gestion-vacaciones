'use client';

import { useEffect, useMemo, useState } from 'react';
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
  /** Data URL o base64 crudo (fallback si no hay URL same-origin). */
  data?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: number;
  uploadedByNombre?: string;
  /** Índice en documentosAdjuntos original (para auditoría / contenido). */
  indiceOriginal?: number;
}

interface AdjuntosViewerProps {
  adjuntos: AdjuntoVisor[] | null | undefined;
  /** ID de solicitud: habilita iframe same-origin vía /contenido. */
  solicitudId?: number;
  /** Para registrar el evento "adjunto_visualizado" en auditoría. */
  onAdjuntoVisualizado?: (adj: AdjuntoVisor, index: number) => void;
  /** Si es true, permite que solo usuarios autorizados vean los adjuntos. */
  autorizado: boolean;
  /** Solo mostrar metadatos (modo "sin visor"). */
  readOnly?: boolean;
}

function detectarMime(adj: AdjuntoVisor): string {
  if (adj.mimeType) return adj.mimeType;
  if (adj.data?.startsWith('data:')) {
    const match = adj.data.match(/^data:([^;,]+)/);
    if (match?.[1]) return match[1];
  }
  if (
    adj.data?.startsWith('JVBER') ||
    adj.data?.startsWith('data:application/pdf')
  ) {
    return 'application/pdf';
  }
  const nombre = (adj.nombre ?? '').toLowerCase();
  if (nombre.endsWith('.pdf')) return 'application/pdf';
  if (nombre.endsWith('.png')) return 'image/png';
  if (nombre.endsWith('.webp')) return 'image/webp';
  if (/\.jpe?g$/.test(nombre)) return 'image/jpeg';
  return 'application/octet-stream';
}

function dataUrlHref(adj: AdjuntoVisor): string | null {
  if (!adj.data) return null;
  if (adj.data.startsWith('data:')) return adj.data;
  const mime = detectarMime(adj);
  return `data:${mime};base64,${adj.data}`;
}

function base64ABytes(data: string): Uint8Array<ArrayBuffer> | null {
  try {
    let b64 = data;
    if (data.startsWith('data:')) {
      const comma = data.indexOf(',');
      if (comma < 0) return null;
      b64 = data.slice(comma + 1);
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function etiquetaSubidoPor(adj: AdjuntoVisor): string | null {
  if (adj.uploadedByNombre) {
    return `Subido por: ${adj.uploadedByNombre}`;
  }
  if (typeof adj.uploadedBy === 'number') {
    return `Subido por usuario ID: ${adj.uploadedBy}`;
  }
  return null;
}

function urlContenidoAdjunto(
  solicitudId: number | undefined,
  indice: number
): string | null {
  if (!solicitudId || !Number.isFinite(solicitudId)) return null;
  return `/api/solicitudes/${solicitudId}/adjuntos/${indice}/contenido`;
}

export function AdjuntosViewer({
  adjuntos,
  solicitudId,
  onAdjuntoVisualizado,
  autorizado,
  readOnly = false,
}: AdjuntosViewerProps) {
  const [adjuntoAbierto, setAdjuntoAbierto] = useState<AdjuntoVisor | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState<number>(0);

  const listaFinal = Array.isArray(adjuntos)
    ? adjuntos.filter((a) => Boolean(a?.data))
    : [];

  if (!autorizado) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>No tiene permisos para visualizar los adjuntos de esta solicitud.</span>
      </div>
    );
  }

  if (listaFinal.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Sin adjunto registrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {listaFinal.map((adj, idx) => {
          const tipo = adj.tipo ?? adj.nombre ?? 'adjunto';
          const mime = detectarMime(adj);
          const esPdf = mime === 'application/pdf';
          const esImagen = mime.startsWith('image/');
          const tamKB = adj.size ? Math.round(adj.size / 1024) : null;
          const indiceAuditoria = adj.indiceOriginal ?? idx;
          const subidoPor = etiquetaSubidoPor(adj);
          const hrefDescarga =
            urlContenidoAdjunto(solicitudId, indiceAuditoria) ?? dataUrlHref(adj) ?? '#';

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
                  {subidoPor && (
                    <p className="text-[10px] text-muted-foreground">{subidoPor}</p>
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
                        setIndiceAbierto(indiceAuditoria);
                        onAdjuntoVisualizado?.(adj, indiceAuditoria);
                      }}
                      title="Visualizar"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <a
                      href={hrefDescarga}
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
            <VisorContenido
              adjunto={adjuntoAbierto}
              solicitudId={solicitudId}
              indice={indiceAbierto}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisorContenido({
  adjunto,
  solicitudId,
  indice,
}: {
  adjunto: AdjuntoVisor;
  solicitudId?: number;
  indice: number;
}) {
  const mime = detectarMime(adjunto);
  const esPdf = mime === 'application/pdf';
  const esImagen = mime.startsWith('image/');
  const urlSameOrigin = urlContenidoAdjunto(solicitudId, indice);
  const dataHref = dataUrlHref(adjunto);

  const [previewError, setPreviewError] = useState(false);

  const blobUrl = useMemo(() => {
    if (urlSameOrigin || !adjunto.data || !esPdf) return null;
    const bytes = base64ABytes(adjunto.data);
    if (!bytes) return null;
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }, [adjunto.data, esPdf, urlSameOrigin]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const previewSrc = useMemo(() => {
    if (urlSameOrigin) return urlSameOrigin;
    if (esPdf && blobUrl) return blobUrl;
    if (esImagen && dataHref) return dataHref;
    return null;
  }, [urlSameOrigin, esPdf, blobUrl, esImagen, dataHref]);

  const hrefDescarga = urlSameOrigin ?? dataHref ?? '#';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{adjunto.nombre ?? 'archivo'}</span>
        <a
          href={hrefDescarga}
          download={adjunto.nombre ?? 'adjunto.bin'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground hover:bg-muted/70"
        >
          <Download className="h-3.5 w-3.5" /> Descargar
        </a>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
        {esPdf && previewSrc && !previewError ? (
          <iframe
            src={previewSrc}
            title={adjunto.nombre ?? 'adjunto PDF'}
            className="h-[70vh] w-full bg-white"
            onError={() => setPreviewError(true)}
          />
        ) : esImagen && previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={adjunto.nombre ?? 'adjunto'}
            className="mx-auto max-h-[70vh] w-auto"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm">
              {esPdf
                ? 'No se pudo previsualizar el PDF. Descargue el archivo.'
                : 'Tipo de archivo no previsualizable.'}
            </p>
            <a
              href={hrefDescarga}
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
