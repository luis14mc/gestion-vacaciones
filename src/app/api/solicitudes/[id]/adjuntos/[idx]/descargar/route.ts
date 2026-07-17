/**
 * API: GET /api/solicitudes/[id]/adjuntos/[idx]/descargar
 * Descarga del adjunto con Content-Disposition: attachment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { autorizarContenidoAdjunto } from '@/lib/solicitudes/autorizar-contenido-adjunto';
import { respuestaAdjuntoDescarga } from '@/lib/solicitudes/servir-adjunto-response';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; idx: string }> }
) => {
  const session = await getSession();
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

  if (!resultado.bytes || resultado.bytes.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Adjunto vacío o inválido' },
      { status: 404 }
    );
  }

  return respuestaAdjuntoDescarga(
    resultado.bytes,
    resultado.mimeType,
    resultado.nombreArchivo
  );
});
