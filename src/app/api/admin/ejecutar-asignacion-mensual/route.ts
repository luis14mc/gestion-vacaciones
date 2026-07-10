/**
 * API: POST /api/admin/ejecutar-asignacion-mensual
 * Ejecuta la asignación mensual automática de vacaciones.
 *
 * Solo RRHH/Admin. Jefe y Empleado NO.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { getSession } from '@/lib/auth';
import { datosPeticion } from '@/services/auditoria.service';
import {
  asignarVacacionesMensuales,
  type ResumenAsignacionMensual,
} from '@/services/asignacion-vacaciones.service';

export const runtime = 'nodejs';

interface BodyEjecucion {
  anio?: number;
  mes?: number;
  modo?: 'automatico' | 'manual' | 'sistema';
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }
  if (!session.esRrhh && !session.esAdmin) {
    return NextResponse.json(
      {
        success: false,
        error: 'No autorizado. Se requiere rol RRHH o Administrador.',
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as BodyEjecucion;
  const { ipAddress, userAgent } = datosPeticion(request);

  const now = new Date();
  const anio = Number.isFinite(body.anio) ? Number(body.anio) : now.getFullYear();
  const mes = Number.isFinite(body.mes) ? Number(body.mes) : now.getMonth() + 1;
  const modo: 'automatico' | 'manual' | 'sistema' = body.modo ?? 'manual';

  if (mes < 1 || mes > 12) {
    return NextResponse.json(
      { success: false, error: 'Mes inválido (1-12).' },
      { status: 400 }
    );
  }
  if (anio < 2000 || anio > 2100) {
    return NextResponse.json(
      { success: false, error: 'Año inválido (2000-2100).' },
      { status: 400 }
    );
  }

  let resumen: ResumenAsignacionMensual;
  try {
    resumen = await asignarVacacionesMensuales({
      anio,
      mes,
      origen: modo,
      ejecutadoPor: session.id,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : 'Error al ejecutar la asignación mensual.';
    return NextResponse.json(
      { success: false, error: mensaje },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      anio: resumen.anio,
      mes: resumen.mes,
      usuariosProcesados: resumen.usuariosProcesados,
      asignacionesCreadas: resumen.asignacionesCreadas,
      usuariosOmitidos: resumen.usuariosOmitidos,
      totalDiasAsignados: resumen.totalDiasAsignados,
    },
  });
});