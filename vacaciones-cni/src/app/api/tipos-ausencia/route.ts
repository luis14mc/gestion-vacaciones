import { NextRequest, NextResponse } from 'next/server';
import { db, tiposAusenciaConfig } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET: Obtener todos los tipos de ausencia activos
export async function GET(request: NextRequest) {
  try {
    const tipos = await db.query.tiposAusenciaConfig.findMany({
      where: eq(tiposAusenciaConfig.activo, true),
      orderBy: (tipos, { asc }) => [asc(tipos.tipo)]
    });

    return NextResponse.json({
      success: true,
      data: tipos
    });

  } catch (error) {
    console.error('Error obteniendo tipos de ausencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener tipos de ausencia' },
      { status: 500 }
    );
  }
}
