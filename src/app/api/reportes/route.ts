import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseFiltrosReporte } from '@/lib/domain/reportes/filters';
import { resolverAlcanceReportes } from '@/lib/domain/reportes/scope';
import { generarReporte } from '@/lib/domain/reportes/queries';
import { puedeVerReportes } from '@/lib/domain/reportes/access';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!puedeVerReportes(session)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver reportes' },
        { status: 403 }
      );
    }

    const filtros = parseFiltrosReporte(request.nextUrl.searchParams);
    const scope = await resolverAlcanceReportes(session, {
      departamentoId: filtros.departamentoId,
      usuarioId: filtros.usuarioId,
    });

    const { data, totalRegistros } = await generarReporte(filtros, scope);

    return NextResponse.json({
      success: true,
      tipo: filtros.tipo,
      data,
      meta: {
        totalRegistros,
        generadoEn: new Date().toISOString(),
        filtros,
        alcance: {
          organizacional: session.esAdmin || session.esRrhh,
          departamentoId: scope.departamentoId,
          usuariosLimitados: scope.usuarioIds !== null,
        },
      },
    });
  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json({ success: false, error: 'Error al generar reporte' }, { status: 500 });
  }
}
