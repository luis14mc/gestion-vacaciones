import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    let results: any[] = [];
    try {
      results = await db.select().from(configuracion);
    } catch (e: any) {
      if (e.message?.includes('does not exist') || e.code === '42P01') {
        return NextResponse.json({ success: true, data: [] });
      }
      throw e;
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuraciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.esAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { clave, valor, descripcion, categoria, tipoDato, esPublico } = body;

    if (!clave || valor === undefined) {
      return NextResponse.json({ success: false, error: 'Clave y valor son requeridos' }, { status: 400 });
    }

    const [nuevo] = await db
      .insert(configuracion)
      .values({ clave, valor, descripcion, categoria: categoria || 'general', tipoDato: tipoDato || 'string', esPublico: esPublico || false })
      .returning();

    return NextResponse.json({ success: true, data: nuevo, message: 'Configuración creada' });
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json({ success: false, error: 'La tabla de configuración no ha sido creada. Ejecuta la migración primero.' }, { status: 500 });
    }
    console.error('Error creando configuración:', error);
    return NextResponse.json({ success: false, error: 'Error al crear configuración' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.esAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const camposPermitidos: Record<string, any> = {};
    if (body.clave !== undefined) camposPermitidos.clave = body.clave;
    if (body.valor !== undefined) camposPermitidos.valor = body.valor;
    if (body.descripcion !== undefined) camposPermitidos.descripcion = body.descripcion;
    if (body.categoria !== undefined) camposPermitidos.categoria = body.categoria;
    if (body.tipoDato !== undefined) camposPermitidos.tipoDato = body.tipoDato;
    if (body.esPublico !== undefined) camposPermitidos.esPublico = body.esPublico;

    const [actualizado] = await db
      .update(configuracion)
      .set({ ...camposPermitidos, updatedAt: new Date().toISOString() })
      .where(eq(configuracion.id, id))
      .returning();

    if (!actualizado) {
      return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: actualizado, message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.esAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    await db.delete(configuracion).where(eq(configuracion.id, Number(id)));

    return NextResponse.json({ success: true, message: 'Configuración eliminada' });
  } catch (error) {
    console.error('Error eliminando configuración:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 });
  }
}
