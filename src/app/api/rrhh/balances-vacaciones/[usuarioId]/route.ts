/**
 * API: GET /api/rrhh/balances-vacaciones/[usuarioId]
 * Detalle de balance, historial de asignaciones y solicitudes — RRHH/Admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { obtenerDetalleBalanceColaboradorRRHH } from '@/services/rrhh-balances.service';
import {
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ usuarioId: string }> }
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!session.esAdmin && !session.esRrhh) {
    return NextResponse.json(
      { success: false, error: 'No autorizado. Se requiere rol RRHH o Administrador.' },
      { status: 403 }
    );
  }

  const { usuarioId: rawId } = await params;
  const usuarioId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(usuarioId)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  const detalle = await obtenerDetalleBalanceColaboradorRRHH(usuarioId);
  if (!detalle) {
    return NextResponse.json(
      { success: false, error: 'Colaborador no encontrado' },
      { status: 404 }
    );
  }

  const { ipAddress, userAgent } = datosPeticion(request);
  void registrarEventoAuditoria({
    usuarioId: session.id,
    modulo: 'rrhh',
    evento: 'rrhh_balance_colaborador_detalle_consultado',
    accion: 'rrhh_balance_colaborador_detalle_consultado',
    tablaAfectada: 'balances',
    registroId: usuarioId,
    detalles: { usuarioConsultado: usuarioId },
    ipAddress,
    userAgent,
  });

  void registrarEventoAuditoria({
    usuarioId: session.id,
    modulo: 'rrhh',
    evento: 'rrhh_historial_asignaciones_consultado',
    accion: 'rrhh_historial_asignaciones_consultado',
    tablaAfectada: 'historial_asignaciones_mensuales',
    registroId: usuarioId,
    detalles: { usuarioConsultado: usuarioId },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true, data: detalle });
});
