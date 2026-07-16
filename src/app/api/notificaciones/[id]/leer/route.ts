/**
 * API: PATCH /api/notificaciones/[id]/leer
 * Marca una notificación como leída.
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificaciones } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

export const runtime = 'nodejs';

export const PATCH = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const notificacionId = Number.parseInt(id, 10);
  if (!Number.isFinite(notificacionId)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  const [actualizada] = await db
    .update(notificaciones)
    .set({ leida: true })
    .where(
      and(
        eq(notificaciones.id, notificacionId),
        eq(notificaciones.usuarioId, session.id)
      )
    )
    .returning({ id: notificaciones.id });

  if (!actualizada) {
    return NextResponse.json(
      { success: false, error: 'Notificación no encontrada' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
});
