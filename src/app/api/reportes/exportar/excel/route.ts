/**
 * API: GET /api/reportes/exportar/excel
 * Genera y descarga reporte Excel de balances o solicitudes.
 * Query params: tipo=balances|solicitudes, departamentoId, estado, fechaDesde, fechaHasta
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exportarReporteBalances, exportarReporteSolicitudes } from '@/services/excel.service';
import { exportLimiter, checkRateLimit } from '@/lib/security/rate-limiter';

export async function GET(req: NextRequest) {
  try {
    // Rate limiting: 5 exportaciones por minuto
    const limited = checkRateLimit(req, exportLimiter);
    if (limited) return limited;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const user = session.user as any;
    if (!user.esRrhh && !user.esAdmin) {
      return NextResponse.json({ error: 'Sin permisos para exportar' }, { status: 403 });
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
      { error: error instanceof Error ? error.message : 'Error generando reporte' },
      { status: 500 }
    );
  }
}
