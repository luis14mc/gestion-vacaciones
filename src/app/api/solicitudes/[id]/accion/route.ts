/**
 * API: POST /api/solicitudes/[id]/accion
 * Ejecuta una acción del workflow sobre una solicitud
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ejecutarAccion, obtenerAccionesParaSolicitud } from '@/services/workflow.service';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { withErrorHandler } from '@/lib/api-handler';
import type { AccionSolicitud } from '@/lib/domain/state-machine';

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
