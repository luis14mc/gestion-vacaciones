/**
 * Autorización compartida para ver/servir contenido de adjuntos.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import { construirCondicionesBandejaAprobacion } from '@/lib/domain/aprobacion-inbox-queries';
import { evaluarAccesoAdjuntoInstitucional } from '@/lib/domain/solicitud-adjuntos-acceso';
import type { SessionUser } from '@/types';

export interface AdjuntoContenidoAutorizado {
  autorizado: true;
  solicitud: {
    id: number;
    usuarioId: number;
  };
  adjunto: Record<string, unknown>;
  mimeType: string;
  nombreArchivo: string;
  bytes: Buffer | null;
  acceso: {
    uploadedBy?: number;
    visualizadorEsSolicitante: boolean;
    visualizadorEsUploader: boolean;
    visualizadorEsAprobador: boolean;
  };
}

export type ResultadoAdjuntoContenido =
  | AdjuntoContenidoAutorizado
  | { autorizado: false; status: 401 | 403 | 404; error: string };

function detectarMimeAdjunto(adjunto: Record<string, unknown>): string {
  if (typeof adjunto.mimeType === 'string' && adjunto.mimeType) {
    return adjunto.mimeType;
  }
  const data = typeof adjunto.data === 'string' ? adjunto.data : '';
  if (data.startsWith('data:')) {
    const match = data.match(/^data:([^;,]+)/);
    if (match?.[1]) return match[1];
  }
  if (data.startsWith('JVBER') || data.includes('application/pdf')) {
    return 'application/pdf';
  }
  const nombre = typeof adjunto.nombre === 'string' ? adjunto.nombre.toLowerCase() : '';
  if (nombre.endsWith('.pdf')) return 'application/pdf';
  if (/\.(png|jpe?g|webp|gif)$/.test(nombre)) {
    if (nombre.endsWith('.png')) return 'image/png';
    if (nombre.endsWith('.webp')) return 'image/webp';
    if (nombre.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

function extraerBytesBase64(data: string): Buffer | null {
  if (!data) return null;
  try {
    if (data.startsWith('data:')) {
      const comma = data.indexOf(',');
      if (comma < 0) return null;
      const meta = data.slice(0, comma);
      const payload = data.slice(comma + 1);
      if (meta.includes(';base64')) {
        return Buffer.from(payload, 'base64');
      }
      return Buffer.from(decodeURIComponent(payload), 'utf8');
    }
    return Buffer.from(data, 'base64');
  } catch {
    return null;
  }
}

export async function autorizarContenidoAdjunto(params: {
  session: SessionUser | null;
  solicitudId: number;
  adjIdx: number;
}): Promise<ResultadoAdjuntoContenido> {
  const { session, solicitudId, adjIdx } = params;
  if (!session) {
    return { autorizado: false, status: 401, error: 'No autenticado' };
  }
  if (!Number.isFinite(solicitudId) || !Number.isFinite(adjIdx) || adjIdx < 0) {
    return { autorizado: false, status: 404, error: 'Parámetros inválidos' };
  }

  const [solicitud] = await db
    .select({
      id: solicitudes.id,
      usuarioId: solicitudes.usuarioId,
      documentosAdjuntos: solicitudes.documentosAdjuntos,
      aprobadaJefePor: solicitudes.aprobadaJefePor,
      aprobadaDirectorPor: solicitudes.aprobadaDirectorPor,
      aprobadaSecretarioPor: solicitudes.aprobadaSecretarioPor,
      aprobadaRrhhPor: solicitudes.aprobadaRrhhPor,
    })
    .from(solicitudes)
    .where(and(eq(solicitudes.id, solicitudId), isNull(solicitudes.deletedAt)))
    .limit(1);

  if (!solicitud) {
    return { autorizado: false, status: 404, error: 'Solicitud no encontrada' };
  }

  const adjuntos = Array.isArray(solicitud.documentosAdjuntos)
    ? (solicitud.documentosAdjuntos as unknown[])
    : [];

  if (adjIdx >= adjuntos.length) {
    return { autorizado: false, status: 404, error: 'Adjunto no encontrado' };
  }

  const adjunto = adjuntos[adjIdx] as Record<string, unknown>;
  const data = typeof adjunto.data === 'string' ? adjunto.data : '';

  let enBandejaAprobacion = false;
  const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(session);
  if (inboxWhere) {
    const match = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(and(eq(solicitudes.id, solicitudId), isNull(solicitudes.deletedAt), inboxWhere))
      .limit(1);
    enBandejaAprobacion = match.length > 0;
  }

  const acceso = evaluarAccesoAdjuntoInstitucional({
    session,
    solicitud,
    adjunto: {
      uploadedBy:
        typeof adjunto.uploadedBy === 'number' ? adjunto.uploadedBy : undefined,
    },
    enBandejaAprobacion,
  });

  if (!acceso.autorizado) {
    return { autorizado: false, status: 403, error: 'No autorizado para ver este adjunto' };
  }

  const bytes = data ? extraerBytesBase64(data) : null;
  const mimeType = detectarMimeAdjunto(adjunto);
  const nombreArchivo =
    typeof adjunto.nombre === 'string' && adjunto.nombre.trim()
      ? adjunto.nombre.trim()
      : `adjunto-${adjIdx + 1}`;

  return {
    autorizado: true,
    solicitud: { id: solicitud.id, usuarioId: solicitud.usuarioId },
    adjunto,
    mimeType,
    nombreArchivo,
    bytes,
    acceso: {
      uploadedBy: acceso.uploadedBy,
      visualizadorEsSolicitante: acceso.visualizadorEsSolicitante,
      visualizadorEsUploader: acceso.visualizadorEsUploader,
      visualizadorEsAprobador: acceso.visualizadorEsAprobador,
    },
  };
}
