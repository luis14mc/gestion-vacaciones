/**
 * API: POST /api/solicitudes/[id]/adjuntos/[idx]/ver
 * Registra el evento de auditoría `adjunto_visualizado` cuando un
 * usuario autorizado abre un adjunto de VoBo/Constancia.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import { construirCondicionesBandejaAprobacion } from '@/lib/domain/aprobacion-inbox-queries';
import { evaluarAccesoAdjuntoInstitucional } from '@/lib/domain/solicitud-adjuntos-acceso';

export const runtime = 'nodejs';

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; idx: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { id, idx } = await params;
  const solicitudId = Number.parseInt(id, 10);
  const adjIdx = Number.parseInt(idx, 10);
  if (!Number.isFinite(solicitudId) || !Number.isFinite(adjIdx)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
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
    return NextResponse.json(
      { success: false, error: 'Solicitud no encontrada' },
      { status: 404 }
    );
  }

  const adjuntos = Array.isArray(solicitud.documentosAdjuntos)
    ? (solicitud.documentosAdjuntos as unknown[])
    : [];

  if (adjIdx < 0 || adjIdx >= adjuntos.length) {
    return NextResponse.json(
      { success: false, error: 'Adjunto no encontrado' },
      { status: 404 }
    );
  }

  const adjunto = adjuntos[adjIdx] as Record<string, unknown>;

  let enBandejaAprobacion = false;
  const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(session);
  if (inboxWhere) {
    const match = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.id, solicitudId),
          isNull(solicitudes.deletedAt),
          inboxWhere
        )
      )
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
    return NextResponse.json(
      { success: false, error: 'No autorizado para ver este adjunto' },
      { status: 403 }
    );
  }

  const tipoAdjunto =
    typeof adjunto?.tipo === 'string'
      ? adjunto.tipo
      : typeof adjunto?.nombre === 'string'
        ? adjunto.nombre
        : 'adjunto';

  const { ipAddress, userAgent } = datosPeticion(request);
  await registrarEventoAuditoria({
    usuarioId: session.id,
    modulo: 'solicitudes',
    evento: 'adjunto_visualizado',
    severidad: 'info',
    resultado: 'exito',
    accion: 'adjunto_visualizado',
    tablaAfectada: 'solicitudes',
    registroId: solicitudId,
    detalles: {
      solicitudId,
      tipoAdjunto,
      indice: adjIdx,
      uploadedBy: acceso.uploadedBy,
      visualizadoPor: session.id,
      visualizadorEsSolicitante: acceso.visualizadorEsSolicitante,
      visualizadorEsUploader: acceso.visualizadorEsUploader,
      visualizadorEsAprobador: acceso.visualizadorEsAprobador,
      solicitudUsuarioId: solicitud.usuarioId,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
});
