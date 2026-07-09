/**
 * API: POST /api/solicitudes/[id]/adjuntos/[idx]/ver
 * Registra el evento de auditoría `adjunto_visualizado` cuando un
 * aprobador abre un adjunto de VoBo/Constancia para revisarlo antes
 * de aprobar o rechazar.
 *
 * No devuelve el adjunto (el visor usa data URLs embebidos en la
 * solicitud original). El endpoint existe exclusivamente para dejar
 * huella de auditoría institucional.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  registrarAuditoria,
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import {
  construirCondicionesBandejaAprobacion,
} from '@/lib/domain/aprobacion-inbox-queries';

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

  // Verificar que el adjunto exista.
  if (adjIdx < 0 || adjIdx >= adjuntos.length) {
    return NextResponse.json(
      { success: false, error: 'Adjunto no encontrado' },
      { status: 404 }
    );
  }

  // Verificar autorización: solo el dueño, los aprobadores con inbox
  // válido, RRHH/Admin pueden visualizar. Si es el dueño, también
  // registramos el evento (es el solicitante revisando su propio adjunto).
  const esDueno = solicitud.usuarioId === session.id;
  let autorizado = esDueno;

  if (!autorizado) {
    const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(session);
    if (inboxWhere) {
      const { sql } = await import('drizzle-orm');
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
      autorizado = match.length > 0;
    }
  }

  if (!autorizado) {
    return NextResponse.json(
      { success: false, error: 'No autorizado para ver este adjunto' },
      { status: 403 }
    );
  }

  const adjunto = adjuntos[adjIdx] as Record<string, unknown>;
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
      tipoAdjunto,
      indice: adjIdx,
      solicitudUsuarioId: solicitud.usuarioId,
      solicitanteEsAprobador: !esDueno,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
});