import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { getSession } from '@/lib/auth';
import { parseFiltrosAuditoria, filtrosAuditoriaToRecord } from '@/lib/domain/auditoria/filters';
import { listarRegistrosAuditoria } from '@/lib/domain/auditoria/queries';
import { puedeVerAuditoria } from '@/lib/domain/auditoria/access';
import { registrarEventoAuditoria, datosPeticion } from '@/services/auditoria.service';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!puedeVerAuditoria(session)) {
      return NextResponse.json(
        { success: false, error: 'Solo administradores pueden consultar la auditoría global' },
        { status: 403 }
      );
    }

    const filtros = parseFiltrosAuditoria(request.nextUrl.searchParams);
    const resultado = await listarRegistrosAuditoria(filtros);

    return NextResponse.json({
      success: true,
      data: resultado.data,
      total: resultado.total,
      paginaActual: resultado.paginaActual,
      totalPaginas: resultado.totalPaginas,
      limite: resultado.limite,
      resumen: resultado.resumen,
      meta: {
        generadoEn: new Date().toISOString(),
        filtros: filtrosAuditoriaToRecord(filtros),
      },
    });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!puedeVerAuditoria(session)) {
      return NextResponse.json(
        { success: false, error: 'Solo administradores pueden registrar eventos manuales' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { accion, tablaAfectada, registroId, detalles, motivo } = body;

    if (!accion || !tablaAfectada || !motivo) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: accion, tablaAfectada, motivo' },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = datosPeticion(request);

    await registrarEventoAuditoria({
      usuarioId: session.id,
      accion: 'crear',
      modulo: 'auditoria',
      evento: 'evento_manual_admin',
      severidad: 'advertencia',
      resultado: 'exito',
      tablaAfectada: 'auditoria',
      registroId: registroId ? Number(registroId) : null,
      detalles: {
        manual: true,
        motivo,
        accionSolicitada: accion,
        tablaSolicitada: tablaAfectada,
        payload: detalles ?? null,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Evento manual registrado' });
});
