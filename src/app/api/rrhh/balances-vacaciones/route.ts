/**
 * API: GET /api/rrhh/balances-vacaciones
 * Control institucional de balances — solo RRHH/Admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import {
  exportarBalancesVacacionesCSV,
  obtenerBalancesVacacionesRRHH,
} from '@/services/rrhh-balances.service';
import {
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import { filasACsv, csvConBom } from '@/lib/domain/exportacion/csv';
import type { EstadoAsignacionMesActual } from '@/lib/domain/rrhh-balance-estado';

export const runtime = 'nodejs';

function puedeAccederRRHHBalances(session: {
  esAdmin?: boolean;
  esRrhh?: boolean;
} | null): boolean {
  return Boolean(session?.esAdmin || session?.esRrhh);
}

function parseFiltros(searchParams: URLSearchParams) {
  const estado = searchParams.get('estadoAsignacion');
  const estadosValidos: EstadoAsignacionMesActual[] = [
    'asignado',
    'pendiente',
    'no_aplica',
    'inconsistente',
  ];

  return {
    page: Number.parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: Number.parseInt(searchParams.get('pageSize') ?? '20', 10),
    search: searchParams.get('search') ?? undefined,
    departamentoId: searchParams.get('departamentoId')
      ? Number.parseInt(searchParams.get('departamentoId')!, 10)
      : undefined,
    estadoAsignacion: estadosValidos.includes(estado as EstadoAsignacionMesActual)
      ? (estado as EstadoAsignacionMesActual)
      : undefined,
    soloConInconsistencias: searchParams.get('soloConInconsistencias') === 'true',
    soloActivos: searchParams.get('soloActivos') !== 'false',
    ordenarPor: (searchParams.get('ordenarPor') as
      | 'nombre'
      | 'departamento'
      | 'diasDisponibles'
      | 'fechaIngreso'
      | 'antiguedad'
      | null) ?? 'nombre',
    orden: (searchParams.get('orden') as 'asc' | 'desc' | null) ?? 'asc',
  };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!puedeAccederRRHHBalances(session)) {
    return NextResponse.json(
      { success: false, error: 'No autorizado. Se requiere rol RRHH o Administrador.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filtros = parseFiltros(searchParams);
  const formato = searchParams.get('formato');

  if (formato === 'csv') {
    const filas = await exportarBalancesVacacionesCSV(filtros);
    const csv = csvConBom(
      filasACsv(filas, [
        { key: 'nombre', header: 'Colaborador' },
        { key: 'email', header: 'Email' },
        { key: 'departamento', header: 'Departamento' },
        { key: 'fecha_ingreso', header: 'Fecha ingreso' },
        { key: 'antiguedad', header: 'Antigüedad' },
        { key: 'dias_anuales', header: 'Días anuales' },
        { key: 'dias_mensuales', header: 'Días mensuales' },
        { key: 'vencidos', header: 'Días vencidos' },
        { key: 'proporcionales', header: 'Días proporcionales' },
        { key: 'usados', header: 'Días usados' },
        { key: 'pendientes', header: 'Días pendientes' },
        { key: 'disponibles', header: 'Días disponibles' },
        { key: 'ultima_asignacion', header: 'Última asignación' },
        { key: 'estado_mes', header: 'Estado mes actual' },
        { key: 'consistente', header: 'Consistente' },
      ])
    );

    const { ipAddress, userAgent } = datosPeticion(request);
    void registrarEventoAuditoria({
      usuarioId: session.id,
      modulo: 'rrhh',
      evento: 'rrhh_balance_vacaciones_consultado',
      accion: 'rrhh_balance_vacaciones_consultado',
      tablaAfectada: 'balances',
      detalles: { exportacion: 'csv', filtros },
      ipAddress,
      userAgent,
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="control_vacaciones_${Date.now()}.csv"`,
      },
    });
  }

  const resultado = await obtenerBalancesVacacionesRRHH(filtros);

  const { ipAddress, userAgent } = datosPeticion(request);
  void registrarEventoAuditoria({
    usuarioId: session.id,
    modulo: 'rrhh',
    evento: 'rrhh_balance_vacaciones_consultado',
    accion: 'rrhh_balance_vacaciones_consultado',
    tablaAfectada: 'balances',
    detalles: { filtros, total: resultado.pagination.total },
    ipAddress,
    userAgent,
  });

  if (resultado.resumen.totalConInconsistencias > 0) {
    void registrarEventoAuditoria({
      usuarioId: session.id,
      modulo: 'rrhh',
      evento: 'rrhh_balance_inconsistencia_detectada',
      accion: 'rrhh_balance_inconsistencia_detectada',
      tablaAfectada: 'balances',
      severidad: 'advertencia',
      detalles: {
        totalInconsistencias: resultado.resumen.totalConInconsistencias,
        filtros,
      },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({
    success: true,
    data: resultado.data,
    pagination: resultado.pagination,
    resumen: resultado.resumen,
  });
});
