import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { balances, anosLaborales } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

// GET: Obtener balances de un usuario o todos los balances del ano.
export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');
    const anio = searchParams.get('anio');
    const puedeVerTodos = tienePermiso(session, 'balances.ver_todos') || session.esRrhh || session.esAdmin;
    const usuarioIdNum = usuarioId ? Number.parseInt(usuarioId, 10) : null;
    const esPropio = usuarioIdNum === session.id;

    if (!usuarioId && !puedeVerTodos) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver todos los balances' },
        { status: 403 }
      );
    }

    if (usuarioId && !esPropio && !puedeVerTodos) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver balances de otros usuarios' },
        { status: 403 }
      );
    }

    const condiciones = [
      anio ? eq(anosLaborales.ano, Number.parseInt(anio, 10)) : eq(anosLaborales.activo, true),
    ];

    if (usuarioIdNum) {
      condiciones.push(eq(balances.usuarioId, usuarioIdNum));
    }

    const balancesResult = await db
      .select({
        id: balances.id,
        usuarioId: balances.usuarioId,
        anoLaboralId: balances.anoLaboralId,
        tipoAusencia: balances.tipoAusencia,
        cantidadInicial: balances.cantidadInicial,
        cantidadAcumulada: balances.cantidadAcumulada,
        cantidadUsada: balances.cantidadUsada,
        cantidadPendiente: balances.cantidadPendiente,
        cantidadDisponible: balances.cantidadDisponible,
        createdAt: balances.createdAt,
        updatedAt: balances.updatedAt,
      })
      .from(balances)
      .innerJoin(anosLaborales, eq(balances.anoLaboralId, anosLaborales.id))
      .where(and(...condiciones));

    return NextResponse.json(
      {
        success: true,
        data: balancesResult,
      },
      { headers: noStoreHeaders }
    );
});

// POST: Crear o actualizar balance de un usuario
export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'balances.ajustar') && !session.esRrhh && !session.esAdmin) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar balances' },
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

      const [anoLaboral] = anoResult;
      if (!anoLaboral) {
        return NextResponse.json(
          { success: false, error: `No existe ano laboral configurado para ${anio}` },
          { status: 400 }
        );
      }
      anoLaboralId = anoLaboral.id;
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
      ),
    });

    if (balanceExistente) {
      const cantidadInicialNum = Number.parseFloat(cantidadInicial.toString());

      // cantidad_disponible la recalcula el trigger de BD a partir de
      // inicial + acumulada - usada - pendiente; no se setea a mano.
      await db
        .update(balances)
        .set({
          cantidadInicial: cantidadInicialNum.toFixed(2),
          version: balanceExistente.version + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(balances.id, balanceExistente.id));

      return NextResponse.json({
        success: true,
        message: 'Balance actualizado exitosamente',
      });
    }

    const cantidadInicialStr = Number.parseFloat(cantidadInicial.toString()).toFixed(2);
    await db.insert(balances).values({
      usuarioId,
      tipoAusencia,
      anoLaboralId,
      cantidadInicial: cantidadInicialStr,
    });

    return NextResponse.json({
      success: true,
      message: 'Balance creado exitosamente',
    });
});
