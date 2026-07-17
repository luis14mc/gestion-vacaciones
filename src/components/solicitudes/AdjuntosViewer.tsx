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
import {
  esUrlAdjuntoContenidoValida,
  urlAdjuntoContenido,
  urlAdjuntoDescargar,
} from '@/lib/solicitudes/adjunto-urls';

export interface AdjuntoVisor {
  tipo?: string;
  nombre?: string;
  /** Data URL o base64 (fallback local; el visor PDF usa el endpoint /contenido). */
  data?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: number;
  uploadedByNombre?: string;
  indiceOriginal?: number;
}

interface AdjuntosViewerProps {
  adjuntos: AdjuntoVisor[] | null | undefined;
  solicitudId?: number;
  onAdjuntoVisualizado?: (adj: AdjuntoVisor, index: number) => void;
  autorizado: boolean;
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

function etiquetaSubidoPor(adj: AdjuntoVisor): string | null {
  if (adj.uploadedByNombre) return `Subido por: ${adj.uploadedByNombre}`;
  if (typeof adj.uploadedBy === 'number') {
    return `Subido por usuario ID: ${adj.uploadedBy}`;
  }
  return null;
}

function hrefDescargaAdjunto(
  solicitudId: number | undefined,
  indice: number,
  adj: AdjuntoVisor
): string | null {
  if (esUrlAdjuntoContenidoValida(solicitudId, indice)) {
    return urlAdjuntoDescargar(solicitudId!, indice);
  }
  return dataUrlHref(adj);
}

function adjuntoVisibleEnLista(adj: AdjuntoVisor, solicitudId?: number): boolean {
  if (adj.data) return true;
  const indice = adj.indiceOriginal ?? 0;
  return esUrlAdjuntoContenidoValida(solicitudId, indice);
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

  const listaFinal = useMemo(
    () =>
      (Array.isArray(adjuntos) ? adjuntos : []).filter((a) =>
        adjuntoVisibleEnLista(a, solicitudId)
      ),
    [adjuntos, solicitudId]
  );

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
          const hrefDescarga = hrefDescargaAdjunto(solicitudId, indiceAuditoria, adj);

          return (
            <div
              key={`${tipo}-${indiceAuditoria}`}
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
                    {hrefDescarga ? (
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
                    ) : null}
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
            <DialogDescription>{adjuntoAbierto?.nombre ?? 'archivo'}</DialogDescription>
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

/** Valida que el endpoint devuelva PDF antes de montar el iframe. */
async function validarEndpointPdf(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (ct.includes('text/html')) return false;
    if (ct.includes('application/json')) return false;
    return ct.includes('pdf') || ct.includes('octet-stream');
  } catch {
    return false;
  }
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
  const dataHref = dataUrlHref(adjunto);

  const contenidoUrl = esUrlAdjuntoContenidoValida(solicitudId, indice)
    ? urlAdjuntoContenido(solicitudId!, indice)
    : null;
  const descargarUrl = hrefDescargaAdjunto(solicitudId, indice, adjunto);

  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    setIframeSrc(null);
    setPreviewError(false);

    if (!esPdf) return;

    if (!contenidoUrl) {
      if (!dataHref) setPreviewError(true);
      return;
    }

    let cancelado = false;
    setValidando(true);

    void validarEndpointPdf(contenidoUrl).then((ok) => {
      if (cancelado) return;
      setValidando(false);
      if (ok) {
        setIframeSrc(contenidoUrl);
      } else {
        setPreviewError(true);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [contenidoUrl, esPdf, dataHref]);

  const imagenSrc = esImagen ? (contenidoUrl ?? dataHref) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{adjunto.nombre ?? 'archivo'}</span>
        {descargarUrl ? (
          <a
            href={descargarUrl}
            download={adjunto.nombre ?? 'adjunto.bin'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground hover:bg-muted/70"
          >
            <Download className="h-3.5 w-3.5" /> Descargar
          </a>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
        {validando ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Cargando vista previa…
          </p>
        ) : esPdf && iframeSrc && !previewError ? (
          <iframe
            src={iframeSrc}
            title={adjunto.nombre ?? 'adjunto PDF'}
            className="h-[70vh] w-full bg-white"
          />
        ) : esImagen && imagenSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagenSrc}
            alt={adjunto.nombre ?? 'adjunto'}
            className="mx-auto max-h-[70vh] w-auto"
          />
        ) : esPdf && dataHref && !contenidoUrl && !previewError ? (
          <iframe
            src={dataHref}
            title={adjunto.nombre ?? 'adjunto PDF'}
            className="h-[70vh] w-full bg-white"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm">
              {esPdf
                ? 'No se pudo previsualizar el PDF. Descargue el archivo.'
                : 'Tipo de archivo no previsualizable.'}
            </p>
            {descargarUrl ? (
              <a
                href={descargarUrl}
                download={adjunto.nombre ?? 'adjunto.bin'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-4 w-4" /> Descargar archivo
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
