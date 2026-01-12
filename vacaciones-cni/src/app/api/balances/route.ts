import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { balancesAusencias } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';

export const runtime = 'nodejs';

// GET: Obtener balances de un usuario
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');
    const anio = searchParams.get('anio') || new Date().getFullYear().toString();

    if (!usuarioId) {
      return NextResponse.json(
        { success: false, error: 'Usuario ID es requerido' },
        { status: 400 }
      );
    }

    const usuarioIdNum = Number.parseInt(usuarioId);
    const esPropio = usuarioIdNum === session.id;

    // 2. Verificar permisos según el caso
    if (esPropio) {
      // Viendo su propio balance
      if (!tienePermiso(session, 'balances.ver_propios')) {
        console.log(`❌ Usuario ${session.email} sin permiso balances.ver_propios`);
        return NextResponse.json(
          { error: 'No tienes permiso para ver balances' },
          { status: 403 }
        );
      }
      console.log(`✅ Usuario ${session.email} consultando su propio balance`);
    } else {
      // Viendo balance de otro usuario
      if (!tienePermiso(session, 'balances.ver_todos')) {
        console.log(`❌ Usuario ${session.email} sin permiso balances.ver_todos para ver balance de usuario ${usuarioId}`);
        return NextResponse.json(
          { error: 'No tienes permiso para ver balances de otros usuarios' },
          { status: 403 }
        );
      }
      console.log(`✅ Usuario ${session.email} consultando balance de usuario ${usuarioId}`);
    }

    // Consulta SQL personalizada calculando cantidad_disponible
    const balances = await db.execute(sql`
      SELECT 
        b.id,
        b.usuario_id,
        b.tipo_ausencia_id,
        b.anio,
        b.cantidad_asignada,
        b.cantidad_utilizada,
        b.cantidad_pendiente,
        (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as cantidad_disponible,
        b.estado,
        b.fecha_vencimiento,
        b.notas,
        b.created_at,
        b.updated_at,
        ta.nombre as tipo_nombre,
        ta.tipo as tipo_codigo,
        ta.color_hex
      FROM balances_ausencias b
      LEFT JOIN tipos_ausencia_config ta ON ta.id = b.tipo_ausencia_id
      WHERE b.usuario_id = ${Number.parseInt(usuarioId)}
        AND b.anio = ${Number.parseInt(anio)}
      ORDER BY b.tipo_ausencia_id
    `);

    return NextResponse.json({
      success: true,
      data: balances.rows
    });

  } catch (error) {
    console.error('Error obteniendo balances:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener balances' },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar balance de un usuario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, tipoAusenciaId, anio, cantidadAsignada } = body;

    if (!usuarioId || !tipoAusenciaId || !anio || cantidadAsignada === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe el balance
    const balanceExistente = await db.query.balancesAusencias.findFirst({
      where: and(
        eq(balancesAusencias.usuarioId, usuarioId),
        eq(balancesAusencias.tipoAusenciaId, tipoAusenciaId),
        eq(balancesAusencias.anio, anio)
      )
    });

    if (balanceExistente) {
      // Actualizar
      await db
        .update(balancesAusencias)
        .set({
          cantidadAsignada: cantidadAsignada.toString(),
          version: balanceExistente.version + 1
        })
        .where(eq(balancesAusencias.id, balanceExistente.id));

      return NextResponse.json({
        success: true,
        message: 'Balance actualizado exitosamente'
      });
    } else {
      // Crear nuevo
      await db.insert(balancesAusencias).values({
        usuarioId,
        tipoAusenciaId,
        anio,
        cantidadAsignada: cantidadAsignada.toString(),
        estado: 'activo'
      });

      return NextResponse.json({
        success: true,
        message: 'Balance creado exitosamente'
      });
    }

  } catch (error) {
    console.error('Error gestionando balance:', error);
    return NextResponse.json(
      { success: false, error: 'Error al gestionar balance' },
      { status: 500 }
    );
  }
}
