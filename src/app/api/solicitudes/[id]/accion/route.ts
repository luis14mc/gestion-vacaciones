/**
 * API: POST /api/solicitudes/[id]/accion
 * Ejecuta una acción del workflow sobre una solicitud
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { ejecutarAccion, obtenerAccionesParaSolicitud } from '@/services/workflow.service';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { withErrorHandler } from '@/lib/api-handler';
import type { AccionSolicitud } from '@/lib/domain/state-machine';
import { esRechazoPrevioRRHH } from '@/lib/domain/rechazo-solicitud';

export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const solicitudId = parseInt(id, 10);
  if (isNaN(solicitudId)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  const acciones = await obtenerAccionesParaSolicitud(solicitudId, {
    id: session.id,
    esDirector: session.esDirector || false,
    esJefe: session.esJefe || false,
    esRrhh: session.esRrhh || false,
    esAdmin: session.esAdmin || false,
    esSecretarioGeneral: session.esSecretarioGeneral || false,
    departamentoId: session.departamentoId ?? null,
  });

  return NextResponse.json({ success: true, data: acciones });
});

export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const solicitudId = parseInt(id, 10);
  if (isNaN(solicitudId)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  const body = await req.json();
  const { accion, comentario, motivoRechazo, motivoCancelacion } = body;

  if (!accion) {
    return NextResponse.json({ success: false, error: 'Acción requerida' }, { status: 400 });
  }

  // Fase 4: defensa en profundidad. Bloquear explícitamente cualquier
  // intento de RRHH de aprobar/rechazar una solicitud que ya fue
  // rechazada por un aprobador previo (estado final). El state machine
  // también lo impide, pero este mensaje es más claro para el frontend
  // institucional.
  const solicitudPreview = await db.query.solicitudes.findFirst({
    where: and(
      eq(solicitudes.id, solicitudId),
      isNull(solicitudes.deletedAt)
    ),
    columns: { estado: true, usuarioId: true },
  });

  if (
    solicitudPreview &&
    esRechazoPrevioRRHH(solicitudPreview.estado) &&
    (accion === 'aprobar_rrhh' || accion === 'rechazar_rrhh')
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Esta solicitud fue rechazada antes de llegar a Recursos Humanos y no puede ser aprobada por RRHH.',
      },
      { status: 409 }
    );
  }

  // Bloquear también si RRHH intenta cualquier acción sobre estados
  // finales (incluye los rechazados arriba).
  if (
    solicitudPreview &&
    (esRechazoPrevioRRHH(solicitudPreview.estado) ||
      solicitudPreview.estado === 'cancelada' ||
      solicitudPreview.estado === 'rechazada_rrhh' ||
      solicitudPreview.estado === 'finalizada') &&
    (session.esRrhh || session.esSecretarioGeneral || session.esJefe || session.esDirector)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'La solicitud está en un estado final y no admite más acciones.',
      },
      { status: 409 }
    );
  }

  const resultado = await ejecutarAccion({
    solicitudId,
    accion: accion as AccionSolicitud,
    usuarioId: session.id,
    esDirector: session.esDirector || false,
    esJefe: session.esJefe || false,
    esRrhh: session.esRrhh || false,
    esAdmin: session.esAdmin || false,
    esSecretarioGeneral: session.esSecretarioGeneral || false,
    departamentoId: session.departamentoId ?? null,
    comentario,
    motivoRechazo,
    motivoCancelacion,
  });

  if (!resultado.exito) {
    return NextResponse.json(
      { success: false, error: resultado.error },
      { status: 422 }
    );
  }

  const { ipAddress, userAgent } = datosPeticion(req);
  await registrarAuditoria({
    usuarioId: session.id,
    accion: 'actualizar',
    tablaAfectada: 'solicitudes',
    registroId: solicitudId,
    detalles: {
      evento: accion,
      tipoSolicitud: resultado.solicitud?.tipo,
      estadoAnterior: resultado.transicion?.estadoAnterior,
      estadoNuevo: resultado.transicion?.estadoNuevo,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    data: resultado.solicitud,
    transicion: {
      estadoAnterior: resultado.transicion?.estadoAnterior,
      estadoNuevo: resultado.transicion?.estadoNuevo,
    },
  });
});
