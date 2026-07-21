import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { obtenerConfigs, asNumber } from '@/lib/config/service';
import {
  calcularFechaMinimaSolicitud,
  inicioDeDiaLocal,
} from '@/lib/domain/solicitud-validaciones';
import { withErrorHandler } from '@/lib/api-handler';

export const runtime = 'nodejs';

/** Reglas de formulario (anticipación mínima) para alinear frontend con backend. */
export const GET = withErrorHandler(async () => {
  const sessionUser = await getSession();
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const reglas = await obtenerConfigs(['vacaciones.dias_anticipacion']);
  const diasAnticipacion = asNumber(reglas['vacaciones.dias_anticipacion'], 0);
  const hoy = inicioDeDiaLocal();
  const fechaMinima = calcularFechaMinimaSolicitud(hoy, diasAnticipacion);

  return NextResponse.json({
    success: true,
    data: {
      diasAnticipacion,
      fechaMinima,
    },
  });
});
