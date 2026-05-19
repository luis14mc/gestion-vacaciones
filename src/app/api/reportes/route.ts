import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar permiso
    if (!tienePermiso(session, 'reportes.exportar')) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver reportes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tipoReporte = searchParams.get('tipo') || 'balances';
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));
    const fechaInicio = searchParams.get('fechaInicio') || `${anio}-01-01`;
    const fechaFin = searchParams.get('fechaFin') || `${anio}-12-31`;
    const departamentoId = searchParams.get('departamentoId') ? parseInt(searchParams.get('departamentoId')!) : null;

    let data;

    switch (tipoReporte) {
      case 'balances':
        data = await generarReporteBalances(anio, departamentoId);
        break;
      case 'solicitudes':
        data = await generarReporteSolicitudes(fechaInicio, fechaFin, departamentoId);
        break;
      case 'departamentos':
        data = await generarReporteDepartamentos(anio, departamentoId);
        break;
      case 'proyecciones':
        data = await generarReporteProyecciones(anio, departamentoId);
        break;
      case 'ausentismo':
        data = await generarReporteAusentismo(fechaInicio, fechaFin, departamentoId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de reporte no válido. Use: balances, solicitudes, departamentos, proyecciones, ausentismo' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data, tipo: tipoReporte });
  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}

// Reporte de Balances
async function generarReporteBalances(anio: number, departamentoId: number | null) {
  const result = await db.execute(sql`
    SELECT 
      u.id as usuario_id,
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      u.email,
      d.nombre as departamento,
      b.tipo_ausencia,
      COALESCE(b.cantidad_inicial, '0') as asignados,
      COALESCE(b.cantidad_usada, '0') as utilizados,
      COALESCE(b.cantidad_pendiente, '0') as pendientes,
      COALESCE(b.cantidad_disponible, '0') as disponibles
    FROM usuarios u
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN balances b ON b.usuario_id = u.id 
      AND b.ano_laboral_id = (SELECT id FROM anos_laborales WHERE ano = ${anio} LIMIT 1)
    WHERE u.activo = true
      AND u.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY d.nombre, u.apellido, b.tipo_ausencia
  `);

  return { balances: [...result] };
}

// Reporte de Solicitudes
async function generarReporteSolicitudes(
  fechaInicio: string,
  fechaFin: string,
  departamentoId: number | null
) {
  const result = await db.execute(sql`
    SELECT 
      s.id,
      s.codigo,
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      d.nombre as departamento,
      s.tipo,
      s.fecha_inicio,
      s.fecha_fin,
      s.dias_solicitados,
      s.estado,
      s.created_at as fecha_solicitud,
      s.motivo
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin + ' 23:59:59'}
      AND s.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY s.fecha_inicio DESC
  `);

  return { solicitudes: [...result] };
}

// Reporte por Departamentos
async function generarReporteDepartamentos(anio: number, departamentoId: number | null) {
  const result = await db.execute(sql`
    SELECT 
      d.id,
      d.nombre,
      d.codigo,
      COUNT(DISTINCT u.id) as total_empleados,
      COALESCE(SUM(b.cantidad_inicial::numeric), 0) as total_asignados,
      COALESCE(SUM(b.cantidad_usada::numeric), 0) as total_usados,
      COALESCE(SUM(b.cantidad_disponible::numeric), 0) as total_disponibles,
      CASE 
        WHEN COALESCE(SUM(b.cantidad_inicial::numeric), 0) > 0 
        THEN ROUND((SUM(b.cantidad_usada::numeric) / SUM(b.cantidad_inicial::numeric) * 100)::numeric, 2)
        ELSE 0 
      END as porcentaje_uso
    FROM departamentos d
    LEFT JOIN usuarios u ON u.departamento_id = d.id AND u.activo = true AND u.deleted_at IS NULL
    LEFT JOIN balances b ON b.usuario_id = u.id 
      AND b.ano_laboral_id = (SELECT id FROM anos_laborales WHERE ano = ${anio} LIMIT 1)
    WHERE d.activo = true AND d.deleted_at IS NULL
      ${departamentoId ? sql`AND d.id = ${departamentoId}` : sql``}
    GROUP BY d.id, d.nombre, d.codigo
    ORDER BY d.nombre
  `);

  return { departamentos: [...result] };
}

// Reporte de Ausentismo
async function generarReporteAusentismo(
  fechaInicio: string,
  fechaFin: string,
  departamentoId: number | null
) {
  // Resumen general
  const resumen = await db.execute(sql`
    SELECT 
      COUNT(*) as total_ausencias,
      COALESCE(SUM(s.dias_solicitados::numeric), 0) as total_dias,
      ROUND(COALESCE(AVG(s.dias_solicitados::numeric), 0), 2) as promedio_dias,
      COUNT(DISTINCT s.usuario_id) as total_empleados
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada_rrhh', 'finalizada')
      AND u.activo = true
      AND s.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
  `);

  // Tendencia mensual
  const tendencia = await db.execute(sql`
    SELECT 
      TO_CHAR(s.fecha_inicio::timestamp, 'YYYY-MM') as mes,
      COUNT(*) as solicitudes,
      COALESCE(SUM(s.dias_solicitados::numeric), 0) as dias,
      ROUND(COALESCE(AVG(s.dias_solicitados::numeric), 0), 2) as promedio
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada_rrhh', 'finalizada')
      AND u.activo = true
      AND s.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    GROUP BY TO_CHAR(s.fecha_inicio::timestamp, 'YYYY-MM')
    ORDER BY mes
  `);

  return {
    resumen: [...resumen][0] || {},
    tendencia_mensual: [...tendencia]
  };
}

// Reporte de Proyecciones
async function generarReporteProyecciones(anio: number, departamentoId: number | null) {
  // Próximos a vencer (disponibles > 0)
  const proximos = await db.execute(sql`
    SELECT 
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      b.tipo_ausencia,
      b.cantidad_disponible as dias_disponibles,
      al.fecha_fin as fecha_vencimiento,
      EXTRACT(DAY FROM (al.fecha_fin::timestamp - CURRENT_DATE::timestamp)) as dias_restantes
    FROM usuarios u
    INNER JOIN balances b ON b.usuario_id = u.id
    INNER JOIN anos_laborales al ON al.id = b.ano_laboral_id
    WHERE u.activo = true AND u.deleted_at IS NULL
      AND al.ano = ${anio}
      AND b.cantidad_disponible::numeric > 0
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY dias_restantes ASC
  `);

  // Acumulados (históricos)
  const acumulados = await db.execute(sql`
    SELECT 
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      b.tipo_ausencia,
      b.cantidad_disponible as dias_acumulados
    FROM usuarios u
    INNER JOIN balances b ON b.usuario_id = u.id
    INNER JOIN anos_laborales al ON al.id = b.ano_laboral_id
    WHERE u.activo = true AND u.deleted_at IS NULL
      AND al.ano < ${anio}
      AND b.cantidad_disponible::numeric > 0
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY b.cantidad_disponible::numeric DESC
  `);

  return {
    proximos_vencer: [...proximos],
    dias_acumulados: [...acumulados]
  };
}
