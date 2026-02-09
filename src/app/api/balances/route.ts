import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { balances, anosLaborales } from '@/lib/db/schema';
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

    // Consulta SQL usando schema CNI
    const balancesResult = await db
      .select({
        id: balances.id,
        usuarioId: balances.usuarioId,
        anoLaboralId: balances.anoLaboralId,
        tipoAusencia: balances.tipoAusencia,
        cantidadInicial: balances.cantidadInicial,
        cantidadUsada: balances.cantidadUsada,
        cantidadPendiente: balances.cantidadPendiente,
        cantidadDisponible: balances.cantidadDisponible,
        createdAt: balances.createdAt,
        updatedAt: balances.updatedAt
      })
      .from(balances)
      .innerJoin(anosLaborales, eq(balances.anoLaboralId, anosLaborales.id))
      .where(
        and(
          eq(balances.usuarioId, Number.parseInt(usuarioId)),
          eq(anosLaborales.ano, Number.parseInt(anio))
        )
      );

    return NextResponse.json({
      success: true,
      data: balancesResult
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
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Verificar permiso para editar balances
    if (!tienePermiso(session, 'balances.editar')) {
      console.log(`❌ Usuario ${session.email} sin permiso balances.editar`);
      return NextResponse.json(
        { error: 'No tienes permiso para editar balances' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuarioId, tipoAusencia, anoLaboralId, cantidadInicial } = body;

    if (!usuarioId || !tipoAusencia || !anoLaboralId || cantidadInicial === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    console.log(`✅ Usuario ${session.email} editando balance de usuario ${usuarioId}`);

    // Verificar si ya existe el balance
    const balanceExistente = await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, usuarioId),
        eq(balances.tipoAusencia, tipoAusencia),
        eq(balances.anoLaboralId, anoLaboralId)
      )
    });

    if (balanceExistente) {
      // Actualizar
      await db
        .update(balances)
        .set({
          cantidadInicial: cantidadInicial.toString(),
          version: balanceExistente.version + 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(balances.id, balanceExistente.id));

      return NextResponse.json({
        success: true,
        message: 'Balance actualizado exitosamente'
      });
    } else {
      // Crear nuevo
      await db.insert(balances).values({
        usuarioId,
        tipoAusencia,
        anoLaboralId,
        cantidadInicial: cantidadInicial.toString()
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
