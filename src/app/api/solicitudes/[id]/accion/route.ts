/**
 * API: POST /api/solicitudes/[id]/accion
 * Ejecuta una acción del workflow sobre una solicitud
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ejecutarAccion, obtenerAccionesParaSolicitud } from '@/services/workflow.service';
import type { AccionSolicitud } from '@/lib/domain/state-machine';

// GET: Obtener acciones disponibles para la solicitud
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id, 10);
    if (isNaN(solicitudId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const user = session.user as any;
    const acciones = await obtenerAccionesParaSolicitud(solicitudId, {
      id: user.id,
      esJefe: user.esJefe || false,
      esRrhh: user.esRrhh || false,
      esAdmin: user.esAdmin || false,
    });

    return NextResponse.json({ success: true, data: acciones });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

// POST: Ejecutar acción
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id, 10);
    if (isNaN(solicitudId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { accion, comentario, motivoRechazo, motivoCancelacion } = body;

    if (!accion) {
      return NextResponse.json({ error: 'Acción requerida' }, { status: 400 });
    }

    const user = session.user as any;

    const resultado = await ejecutarAccion({
      solicitudId,
      accion: accion as AccionSolicitud,
      usuarioId: user.id,
      esJefe: user.esJefe || false,
      esRrhh: user.esRrhh || false,
      esAdmin: user.esAdmin || false,
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

    return NextResponse.json({
      success: true,
      data: resultado.solicitud,
      transicion: {
        estadoAnterior: resultado.transicion?.estadoAnterior,
        estadoNuevo: resultado.transicion?.estadoNuevo,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
