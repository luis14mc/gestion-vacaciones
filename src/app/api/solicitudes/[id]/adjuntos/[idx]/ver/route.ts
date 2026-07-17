/**
 * API: POST /api/solicitudes/[id]/adjuntos/[idx]/ver
 * Registra el evento de auditoría `adjunto_visualizado`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import {
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import { autorizarContenidoAdjunto } from '@/lib/solicitudes/autorizar-contenido-adjunto';

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

  const resultado = await autorizarContenidoAdjunto({
    session,
    solicitudId,
    adjIdx,
  });

  if (!resultado.autorizado) {
    return NextResponse.json(
      { success: false, error: resultado.error },
      { status: resultado.status }
    );
  }

  const tipoAdjunto =
    typeof resultado.adjunto.tipo === 'string'
      ? resultado.adjunto.tipo
      : typeof resultado.adjunto.nombre === 'string'
        ? resultado.adjunto.nombre
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
      uploadedBy: resultado.acceso.uploadedBy,
      visualizadoPor: session.id,
      visualizadorEsSolicitante: resultado.acceso.visualizadorEsSolicitante,
      visualizadorEsUploader: resultado.acceso.visualizadorEsUploader,
      visualizadorEsAprobador: resultado.acceso.visualizadorEsAprobador,
      solicitudUsuarioId: resultado.solicitud.usuarioId,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
});
