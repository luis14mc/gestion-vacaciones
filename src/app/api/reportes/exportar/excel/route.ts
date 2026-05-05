/**
 * API: GET /api/reportes/exportar/excel
 * Genera y descarga reporte Excel de balances o solicitudes.
 * Query params: tipo=balances|solicitudes, departamentoId, estado, fechaDesde, fechaHasta
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { exportarReporteBalances, exportarReporteSolicitudes } from '@/services/excel.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!session.esRrhh && !session.esAdmin) {
      return NextResponse.json({ success: false, error: 'Sin permisos para exportar' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const tipo = searchParams.get('tipo') || 'balances';
    const departamentoId = searchParams.get('departamentoId');
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    let buffer: Buffer;
    let filename: string;
    const fecha = new Date().toISOString().split('T')[0];

    if (tipo === 'solicitudes') {
      buffer = await exportarReporteSolicitudes({
        departamentoId: departamentoId ? parseInt(departamentoId) : undefined,
        estado: estado || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });
      filename = `reporte-solicitudes-${fecha}.xlsx`;
    } else {
      buffer = await exportarReporteBalances({
        departamentoId: departamentoId ? parseInt(departamentoId) : undefined,
      });
      filename = `reporte-balances-${fecha}.xlsx`;
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exportando Excel:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error generando reporte' },
      { status: 500 }
    );
  }
}
