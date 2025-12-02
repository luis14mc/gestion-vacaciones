import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracionSistema } from '@/lib/db/schema';

export const runtime = 'nodejs';

// GET: Listar todas las configuraciones o filtrar por categoría
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');

    let query = db.query.configuracionSistema.findMany({
      orderBy: (configs, { asc }) => [asc(configs.categoria), asc(configs.clave)]
    });

    let results = await query;

    // Filtrar por categoría si se proporciona
    if (categoria) {
      results = results.filter(config => config.categoria === categoria);
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuraciones' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva configuración
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      clave,
      valor,
      tipoDato = 'string',
      descripcion,
      categoria,
      esPublico = false
    } = body;

    // Validaciones
    if (!clave || !valor) {
      return NextResponse.json(
        { success: false, error: 'Clave y valor son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si la clave ya existe
    const configExistente = await db.query.configuracionSistema.findFirst({
      where: eq(configuracionSistema.clave, clave)
    });

    if (configExistente) {
      return NextResponse.json(
        { success: false, error: 'La clave ya existe' },
        { status: 400 }
      );
    }

    // Crear configuración
    const [nuevaConfig] = await db
      .insert(configuracionSistema)
      .values({
        clave,
        valor,
        tipoDato,
        descripcion: descripcion || null,
        categoria: categoria || null,
        esPublico
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: nuevaConfig,
      message: 'Configuración creada exitosamente'
    });

  } catch (error) {
    console.error('Error creando configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear configuración' },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar configuración
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...camposActualizar } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de configuración requerido' },
        { status: 400 }
      );
    }

    // Obtener configuración actual para incrementar versión
    const configActual = await db.query.configuracionSistema.findFirst({
      where: eq(configuracionSistema.id, id)
    });

    if (!configActual) {
      return NextResponse.json(
        { success: false, error: 'Configuración no encontrada' },
        { status: 404 }
      );
    }

    // Incrementar versión y actualizar timestamp
    camposActualizar.version = configActual.version + 1;
    camposActualizar.updatedAt = new Date();

    // Actualizar configuración
    const [configActualizada] = await db
      .update(configuracionSistema)
      .set(camposActualizar)
      .where(eq(configuracionSistema.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: configActualizada,
      message: 'Configuración actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar configuración
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de configuración requerido' },
        { status: 400 }
      );
    }

    const configId = Number.parseInt(id);

    // Verificar que la configuración existe
    const config = await db.query.configuracionSistema.findFirst({
      where: eq(configuracionSistema.id, configId)
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuración no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar configuración (hard delete - no hay deletedAt en esta tabla)
    await db
      .delete(configuracionSistema)
      .where(eq(configuracionSistema.id, configId));

    return NextResponse.json({
      success: true,
      message: 'Configuración eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar configuración' },
      { status: 500 }
    );
  }
}
