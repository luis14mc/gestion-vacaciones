import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import {
  cargarDatosFlujoSolicitante,
  resolverFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo') ?? 'vacaciones';

  const datosSolicitante = await cargarDatosFlujoSolicitante(session.id);
  if (!datosSolicitante) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  try {
    const flujo = await resolverFlujoSolicitante(datosSolicitante, tipo);
    return NextResponse.json({ success: true, data: flujo });
  } catch (err) {
    const mensajeError =
      err instanceof Error
        ? err.message
        : 'No se pudo resolver el flujo de aprobación.';
    return NextResponse.json(
      {
        success: false,
        error: mensajeError,
      },
      { status: 422 }
    );
  }
});
