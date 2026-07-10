/**
 * API: GET /api/vacaciones/asignaciones-mensuales
 * Consulta historial de asignaciones mensuales.
 *
 * Reglas:
 *   - Empleado solo puede ver su propio historial.
 *   - RRHH/Admin puede ver cualquiera.
 *   - Jefe NO puede ver historial de sus empleados.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { getSession } from '@/lib/auth';
import {
  obtenerHistorialAsignacionesUsuario,
  obtenerResumenAsignacionesMensuales,
} from '@/services/asignacion-vacaciones.service';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const usuarioIdParam = searchParams.get('usuarioId');
  const anioParam = searchParams.get('anio');
  const mesParam = searchParams.get('mes');

  const esAdminORrhh = session.esAdmin || session.esRrhh;

  // Si es RRHH/Admin y pasan anio+mes, devolvemos resumen batch.
  if (esAdminORrhh && anioParam && mesParam && !usuarioIdParam) {
    const resumen = await obtenerResumenAsignacionesMensuales({
      anio: Number(anioParam),
      mes: Number(mesParam),
    });
    return NextResponse.json({ success: true, data: resumen });
  }

  // usuarioId es obligatorio para el historial individual.
  if (!usuarioIdParam) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Falta usuarioId. Si es RRHH/Admin puede pasar anio+mes para resumen batch.',
      },
      { status: 400 }
    );
  }

  const usuarioId = Number.parseInt(usuarioIdParam, 10);
  if (!Number.isFinite(usuarioId)) {
    return NextResponse.json(
      { success: false, error: 'usuarioId inválido' },
      { status: 400 }
    );
  }

  // Reglas de visibilidad:
  //   - Empleado solo ve el suyo.
  //   - RRHH/Admin ve cualquiera.
  //   - Jefe NO tiene acceso.
  if (session.esJefe && !esAdminORrhh) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Los Jefes no tienen acceso al historial de asignaciones de empleados.',
      },
      { status: 403 }
    );
  }

  if (!esAdminORrhh && usuarioId !== session.id) {
    return NextResponse.json(
      {
        success: false,
        error: 'Solo puede consultar su propio historial de asignaciones.',
      },
      { status: 403 }
    );
  }

  const anioFiltro = anioParam ? Number(anioParam) : undefined;
  const historial = await obtenerHistorialAsignacionesUsuario(usuarioId, {
    anio: anioFiltro,
    limite: 36,
  });

  return NextResponse.json({
    success: true,
    data: {
      usuarioId,
      historial,
    },
  });
});