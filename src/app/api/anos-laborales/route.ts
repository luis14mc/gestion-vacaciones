import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { anosLaborales } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { puedeVerReportes } from '@/lib/domain/reportes/access';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!puedeVerReportes(session)) {
      return NextResponse.json({ success: false, error: 'Sin permiso para ver reportes' }, { status: 403 });
    }

    const anos = await db
      .select({
        id: anosLaborales.id,
        ano: anosLaborales.ano,
        nombre: anosLaborales.nombre,
        activo: anosLaborales.activo,
        fechaInicio: anosLaborales.fechaInicio,
        fechaFin: anosLaborales.fechaFin,
      })
      .from(anosLaborales)
      .orderBy(desc(anosLaborales.ano));

    const activo = anos.find((a) => a.activo) ?? null;

    return NextResponse.json({
      success: true,
      data: anos,
      anoActivo: activo,
    });
  } catch (error) {
    console.error('Error obteniendo años laborales:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener años laborales' }, { status: 500 });
  }
}
