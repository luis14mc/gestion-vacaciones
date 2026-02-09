import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { anosLaborales } from '@/lib/db/schema';

export const runtime = 'nodejs';

// GET: Obtener años laborales
export async function GET(request: NextRequest) {
  try {
    const results = await db.query.anosLaborales.findMany({
      orderBy: (anos, { desc }) => [desc(anos.ano)]
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuraciones' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo año laboral
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ano, descripcion, fechaInicio, fechaFin, activo = false } = body;

    if (!ano) {
      return NextResponse.json(
        { success: false, error: 'Año es requerido' },
        { status: 400 }
      );
    }

    const existente = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.ano, ano)
    });

    if (existente) {
      return NextResponse.json(
        { success: false, error: 'El año ya existe' },
        { status: 400 }
      );
    }

    const [nuevo] = await db
      .insert(anosLaborales)
      .values({
        ano,
        nombre: descripcion || `Año Laboral ${ano}`,
        fechaInicio: fechaInicio || `${ano}-01-01`,
        fechaFin: fechaFin || `${ano}-12-31`,
        activo
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: nuevo,
      message: 'Año laboral creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando año laboral:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear año laboral' },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar año laboral
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...camposActualizar } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    const [actualizado] = await db
      .update(anosLaborales)
      .set({ ...camposActualizar, updatedAt: new Date().toISOString() })
      .where(eq(anosLaborales.id, id))
      .returning();

    if (!actualizado) {
      return NextResponse.json(
        { success: false, error: 'Año laboral no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar' },
      { status: 500 }
    );
  }
}
