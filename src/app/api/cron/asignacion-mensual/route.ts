/**
 * API: POST /api/cron/asignacion-mensual
 * Job mensual protegido por CRON_SECRET. Llamado por cron / scheduler
 * externo (GitHub Action, EC2 cron dentro del contenedor, etc.).
 *
 * Body opcional:
 *   { anio: 2026, mes: 7, modo: "automatico" | "manual" | "sistema" }
 *
 * Si no se pasa, usa el mes actual.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { asignarVacacionesMensuales } from '@/services/asignacion-vacaciones.service';

export const runtime = 'nodejs';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET no configurado' },
      { status: 500 }
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    anio?: number;
    mes?: number;
    modo?: 'automatico' | 'manual' | 'sistema';
  };

  const now = new Date();
  const anio = Number.isFinite(body.anio) ? Number(body.anio) : now.getFullYear();
  const mes = Number.isFinite(body.mes) ? Number(body.mes) : now.getMonth() + 1;
  const modo: 'automatico' | 'manual' | 'sistema' = body.modo ?? 'sistema';

  if (mes < 1 || mes > 12) {
    return NextResponse.json(
      { success: false, error: 'Mes inválido (1-12).' },
      { status: 400 }
    );
  }

  const resumen = await asignarVacacionesMensuales({
    anio,
    mes,
    origen: modo,
    // Sin sesión de usuario: usamos un id reservado para "sistema".
    ejecutadoPor: 0,
  });

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