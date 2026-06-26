import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarEventoAuditoria, datosPeticion } from '@/services/auditoria.service';
import { puedeExportarReportes } from '@/lib/domain/reportes/access';
import { obtenerDatasetReporte } from '@/services/reportes.service';
import {
  exportarDatasetReporte,
  normalizarFormatoExportacion,
} from '@/services/exportacion.service';

export const runtime = 'nodejs';

export async function handleExportarReporte(
  request: NextRequest,
  formatoOverride?: string
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!puedeExportarReportes(session)) {
    return NextResponse.json(
      { success: false, error: 'No tienes permiso para exportar reportes' },
      { status: 403 }
    );
  }

  const formatoRaw =
    formatoOverride ?? request.nextUrl.searchParams.get('formato') ?? 'csv';
  const formato = normalizarFormatoExportacion(formatoRaw);
  if (!formato) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Formato inválido. Use formato=csv, formato=xlsx o formato=pdf. El alias excel se mapea a xlsx.',
      },
      { status: 400 }
    );
  }

  const { ipAddress, userAgent } = datosPeticion(request);

  try {
    const dataset = await obtenerDatasetReporte(session, request.nextUrl.searchParams);
    const resultado = await exportarDatasetReporte(dataset, formato);

    await registrarEventoAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      modulo: 'reportes',
      evento: 'exportar_reporte',
      tablaAfectada: 'reportes',
      resultado: 'exito',
      detalles: {
        formato,
        tipoReporte: dataset.tipo,
        cantidadRegistros: dataset.totalRegistros,
        filtros: dataset.filtrosRecord,
        generadoEn: dataset.generadoEn,
      },
      ipAddress,
      userAgent,
    });

    const body =
      typeof resultado.body === 'string'
        ? resultado.body
        : new Uint8Array(resultado.body);

    return new NextResponse(body, {
      headers: {
        'Content-Type': resultado.contentType,
        'Content-Disposition': `attachment; filename="${resultado.filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exportando reporte:', error);

    await registrarEventoAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      modulo: 'reportes',
      evento: 'exportar_reporte',
      tablaAfectada: 'reportes',
      resultado: 'fallo',
      severidad: 'advertencia',
      detalles: {
        formato,
        error: error instanceof Error ? error.message : 'Error desconocido',
        filtros: Object.fromEntries(request.nextUrl.searchParams.entries()),
      },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return NextResponse.json(
      { success: false, error: 'Error al exportar reporte' },
      { status: 500 }
    );
  }
}
