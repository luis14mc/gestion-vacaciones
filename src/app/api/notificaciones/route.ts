/**
 * API: GET /api/notificaciones
 * Lista notificaciones in-app del usuario autenticado.
 */
import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificaciones } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const soloNoLeidas = searchParams.get('noLeidas') === 'true';
  const limite = Math.min(
    Number.parseInt(searchParams.get('limite') ?? '20', 10) || 20,
    50
  );

  const rows = await db
    .select()
    .from(notificaciones)
    .where(eq(notificaciones.usuarioId, session.id))
    .orderBy(desc(notificaciones.createdAt))
    .limit(limite);

  const filtradas = soloNoLeidas ? rows.filter((r) => !r.leida) : rows;
  const noLeidas = rows.filter((r) => !r.leida).length;

  return NextResponse.json({
    success: true,
    data: {
      notificaciones: filtradas.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        referencia: n.referencia,
        leida: n.leida,
        createdAt: n.createdAt,
      })),
      noLeidas,
    },
  });
});
