/**
 * API: GET /api/solicitudes/[id]
 * Detalle institucional de una solicitud (incluye documentosAdjuntos).
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { puedeVerAdjuntosSolicitud } from '@/lib/domain/solicitud-adjuntos-acceso';
import { enriquecerAdjuntosSolicitudes } from '@/lib/domain/solicitud-adjuntos-display';
import { construirCondicionesBandejaAprobacion } from '@/lib/domain/aprobacion-inbox-queries';
import { enriquecerRechazoSolicitudes } from '@/lib/domain/rechazo-solicitud-display';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const solicitudId = Number.parseInt(id, 10);
  if (!Number.isFinite(solicitudId)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  const [solicitud] = await db
    .select({
      id: solicitudes.id,
      codigo: solicitudes.codigo,
      usuarioId: solicitudes.usuarioId,
      tipo: solicitudes.tipo,
      fechaInicio: solicitudes.fechaInicio,
      fechaFin: solicitudes.fechaFin,
      diasSolicitados: solicitudes.diasSolicitados,
      duracionPermiso: solicitudes.duracionPermiso,
      motivo: solicitudes.motivo,
      comentarioEmpleado: solicitudes.comentarioEmpleado,
      estado: solicitudes.estado,
      documentosAdjuntos: solicitudes.documentosAdjuntos,
      metadata: solicitudes.metadata,
      createdAt: solicitudes.createdAt,
      aprobadaJefePor: solicitudes.aprobadaJefePor,
      aprobadaDirectorPor: solicitudes.aprobadaDirectorPor,
      aprobadaSecretarioPor: solicitudes.aprobadaSecretarioPor,
      aprobadaRrhhPor: solicitudes.aprobadaRrhhPor,
      aprobadaJefeFecha: solicitudes.aprobadaJefeFecha,
      aprobadaRrhhFecha: solicitudes.aprobadaRrhhFecha,
      motivoRechazo: solicitudes.motivoRechazo,
      rechazadaPor: solicitudes.rechazadaPor,
      rechazadaFecha: solicitudes.rechazadaFecha,
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

  let autorizado = puedeVerAdjuntosSolicitud(
    session,
    solicitud,
    solicitud.documentosAdjuntos
  );

  if (!autorizado) {
    const puedeVerTodas =
      tienePermiso(session, 'solicitudes.ver_todas') || session.esRrhh || session.esAdmin;
    if (puedeVerTodas) {
      autorizado = true;
    }
  }

  if (!autorizado) {
    const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(session);
    if (inboxWhere) {
      const match = await db
        .select({ id: solicitudes.id })
        .from(solicitudes)
        .where(
          and(eq(solicitudes.id, solicitudId), isNull(solicitudes.deletedAt), inboxWhere)
        )
        .limit(1);
      autorizado = match.length > 0;
    }
  }

  if (!autorizado) {
    return NextResponse.json(
      { success: false, error: 'No autorizado para ver esta solicitud' },
      { status: 403 }
    );
  }

  const [enriquecida] = await enriquecerAdjuntosSolicitudes([solicitud]);
  const data = enriquecida ?? solicitud;
  const [conRechazo] = await enriquecerRechazoSolicitudes([data]);
  const payload = conRechazo ?? data;

  return NextResponse.json({
    success: true,
    data: {
      ...payload,
      puedeVerAdjuntos: puedeVerAdjuntosSolicitud(
        session,
        solicitud,
        payload.documentosAdjuntos
      ),
    },
  });
});
