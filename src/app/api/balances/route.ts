import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { balances, anosLaborales } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';

export const dynamic = 'force-dynamic';
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
    const anio = searchParams.get('anio');

    if (!usuarioId) {
      return NextResponse.json(
        { success: false, error: 'Usuario ID es requerido' },
        { status: 400 }
      );
    }

    const usuarioIdNum = Number.parseInt(usuarioId);
    const esPropio = usuarioIdNum === session.id;

    // 2. Verificar permisos según el caso
    if (!esPropio) {
      // Viendo balance de otro usuario
      if (!tienePermiso(session, 'balances.ver_todos') && !session.esRrhh && !session.esAdmin) {
        return NextResponse.json(
          { error: 'No tienes permiso para ver balances de otros usuarios' },
          { status: 403 }
        );
      }
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
          anio ? eq(anosLaborales.ano, Number.parseInt(anio)) : eq(anosLaborales.activo, true)
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
    if (!tienePermiso(session, 'balances.ajustar') && !session.esRrhh) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar balances' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuarioId, tipoAusencia, cantidadInicial } = body;
    let { anoLaboralId } = body;
    const anio = body.anio;

    if (!usuarioId || !tipoAusencia || cantidadInicial === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    if (!anoLaboralId && anio) {
      const anoResult = await db
        .select({ id: anosLaborales.id })
        .from(anosLaborales)
        .where(eq(anosLaborales.ano, Number(anio)))
        .limit(1);

      if (anoResult.length === 0) {
        return NextResponse.json(
          { success: false, error: `No existe año laboral configurado para ${anio}` },
          { status: 400 }
        );
      }
      anoLaboralId = anoResult[0].id;
    }

    if (!anoLaboralId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere anoLaboralId o anio' },
        { status: 400 }
      );
    }

    const balanceExistente = await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, usuarioId),
        eq(balances.tipoAusencia, tipoAusencia),
        eq(balances.anoLaboralId, anoLaboralId)
      )
    });

    if (balanceExistente) {
      const cantidadInicialNum = Number.parseFloat(cantidadInicial.toString());
      const disponibleAnterior = Number.parseFloat(balanceExistente.cantidadDisponible ?? '0');
      const inicialAnterior = Number.parseFloat(balanceExistente.cantidadInicial ?? '0');
      const nuevoDisponible = disponibleAnterior + (cantidadInicialNum - inicialAnterior);

      await db
        .update(balances)
        .set({
          cantidadInicial: cantidadInicialNum.toFixed(2),
          cantidadDisponible: Math.max(0, nuevoDisponible).toFixed(2),
          version: balanceExistente.version + 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(balances.id, balanceExistente.id));

      return NextResponse.json({
        success: true,
        message: 'Balance actualizado exitosamente'
      });
    } else {
      const cantidadInicialStr = Number.parseFloat(cantidadInicial.toString()).toFixed(2);
      await db.insert(balances).values({
        usuarioId,
        tipoAusencia,
        anoLaboralId,
        cantidadInicial: cantidadInicialStr,
        cantidadDisponible: cantidadInicialStr,
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
