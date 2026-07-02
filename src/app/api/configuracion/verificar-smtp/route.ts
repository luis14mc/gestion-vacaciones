import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verificarConexionSMTP } from '@/services/email.service';
import { withErrorHandler } from '@/lib/api-handler';

export const runtime = 'nodejs';

/**
 * POST /api/configuracion/verificar-smtp
 * Verifica la conexión SMTP con la configuración actual (solo admin).
 */
export const POST = withErrorHandler(async () => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!session.esAdmin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
  }

  const resultado = await verificarConexionSMTP();

  return NextResponse.json(
    {
      success: resultado.exito,
      message: resultado.mensaje,
      detalle: resultado.detalle,
    },
    { status: resultado.exito ? 200 : 422 }
  );
});
