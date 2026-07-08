import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import { withErrorHandler } from '@/lib/api-handler';
import { resolverFlujoAprobacionNuevaSolicitud } from '@/lib/domain/solicitud-flujo-aprobacion';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo') ?? 'vacaciones';

  const [usuario] = await db
    .select({
      esDirector: usuarios.esDirector,
      esJefe: usuarios.esJefe,
      departamentoId: usuarios.departamentoId,
    })
    .from(usuarios)
    .where(eq(usuarios.id, session.id))
    .limit(1);

  if (!usuario) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  let departamentoNombre: string | null = null;
  if (usuario.departamentoId) {
    const [departamento] = await db
      .select({ nombre: departamentos.nombre })
      .from(departamentos)
      .where(eq(departamentos.id, usuario.departamentoId))
      .limit(1);
    departamentoNombre = departamento?.nombre ?? null;
  }

  const flujo = resolverFlujoAprobacionNuevaSolicitud({
    esDirector: usuario.esDirector,
    esJefe: usuario.esJefe,
    departamentoNombre,
    tipo,
  });

  return NextResponse.json({ success: true, data: flujo });
});
