import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { departamentos } from '@/lib/db/schema';
import { isNull, asc } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET: Obtener todos los departamentos activos
export async function GET(request: NextRequest) {
  try {
    const deps = await db.query.departamentos.findMany({
      where: isNull(departamentos.deletedAt),
      orderBy: [asc(departamentos.nombre)]
    });

    return NextResponse.json({
      success: true,
      data: deps
    });

  } catch (error) {
    console.error('Error obteniendo departamentos:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener departamentos' },
      { status: 500 }
    );
  }
}
