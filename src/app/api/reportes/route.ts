import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getSession, tienePermiso } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Verificar permiso para ver reportes generales
    if (!tienePermiso(session, 'reportes.general')) {
      console.log(`❌ Usuario ${session.email} sin permiso reportes.general`);
      return NextResponse.json(
        { error: 'No tienes permiso para ver reportes generales' },
        { status: 403 }
      );
    }

    console.log(`✅ Usuario ${session.email} consultando reportes generales`);

    const { searchParams } = new URL(request.url);
    const tipoReporte = searchParams.get('tipoReporte');
    const departamentoId = searchParams.get('departamentoId');
    const tipoAusenciaId = searchParams.get('tipoAusenciaId');
    const anio = searchParams.get('anio') || new Date().getFullYear().toString();
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    const estado = searchParams.get('estado');

    let data: any = {};

    switch (tipoReporte) {
      case 'balances':
        data = await generarReporteBalances(
          Number(anio),
          departamentoId ? Number(departamentoId) : null,
          tipoAusenciaId ? Number(tipoAusenciaId) : null
        );
        break;

      case 'solicitudes':
        data = await generarReporteSolicitudes(
          fechaInicio || '',
          fechaFin || '',
          departamentoId ? Number(departamentoId) : null,
          tipoAusenciaId ? Number(tipoAusenciaId) : null,
          estado || null
        );
        break;

      case 'departamentos':
        data = await generarReporteDepartamentos(
          Number(anio),
          departamentoId ? Number(departamentoId) : null
        );
        break;

      case 'proyecciones':
        data = await generarReporteProyecciones(
          Number(anio),
          departamentoId ? Number(departamentoId) : null
        );
        break;

      case 'ausentismo':
        data = await generarReporteAusentismo(
          fechaInicio || '',
          fechaFin || '',
          departamentoId ? Number(departamentoId) : null,
          tipoAusenciaId ? Number(tipoAusenciaId) : null
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de reporte no válido' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}

// Reporte de Balances Actuales
async function generarReporteBalances(
  anio: number,
  departamentoId: number | null,
  tipoAusenciaId: number | null
) {
  const result = await db.execute(sql`
    SELECT 
      u.id as usuario_id,
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      u.email,
      d.nombre as departamento,
      ta.nombre as tipo_ausencia,
      b.cantidad_asignada as asignados,
      b.cantidad_utilizada as utilizados,
      b.cantidad_pendiente as pendientes,
      (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as disponibles
    FROM usuarios u
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN balances_ausencias b ON b.usuario_id = u.id AND b.anio = ${anio}
    LEFT JOIN tipos_ausencia_config ta ON ta.id = b.tipo_ausencia_id
    WHERE u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
      ${tipoAusenciaId ? sql`AND b.tipo_ausencia_id = ${tipoAusenciaId}` : sql``}
    ORDER BY d.nombre, u.apellido, ta.nombre
  `);

  return {
    balances: result.rows
  };
}

// Reporte de Solicitudes
async function generarReporteSolicitudes(
  fechaInicio: string,
  fechaFin: string,
  departamentoId: number | null,
  tipoAusenciaId: number | null,
  estado: string | null
) {
  const result = await db.execute(sql`
    SELECT 
      s.id,
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      d.nombre as departamento,
      ta.nombre as tipo_ausencia,
      s.fecha_inicio,
      s.fecha_fin,
      s.cantidad as dias_solicitados,
      s.estado,
      s.created_at as fecha_solicitud,
      s.motivo
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    INNER JOIN tipos_ausencia_config ta ON ta.id = s.tipo_ausencia_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
      ${tipoAusenciaId ? sql`AND s.tipo_ausencia_id = ${tipoAusenciaId}` : sql``}
      ${estado ? sql`AND s.estado = ${estado}` : sql``}
    ORDER BY s.fecha_inicio DESC
  `);

  return {
    solicitudes: result.rows
  };
}

// Reporte por Departamentos
async function generarReporteDepartamentos(
  anio: number,
  departamentoId: number | null
) {
  const result = await db.execute(sql`
    SELECT 
      d.id,
      d.nombre,
      d.codigo,
      COUNT(DISTINCT u.id) as total_empleados,
      COALESCE(SUM(b.cantidad_asignada::numeric), 0) as total_asignados,
      COALESCE(SUM(b.cantidad_utilizada::numeric), 0) as total_usados,
      COALESCE(SUM((b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente)::numeric), 0) as total_disponibles,
      CASE 
        WHEN COALESCE(SUM(b.cantidad_asignada::numeric), 0) > 0 
        THEN ROUND((SUM(b.cantidad_utilizada::numeric) / SUM(b.cantidad_asignada::numeric) * 100)::numeric, 2)
        ELSE 0 
      END as porcentaje_uso
    FROM departamentos d
    LEFT JOIN usuarios u ON u.departamento_id = d.id AND u.activo = true
    LEFT JOIN balances_ausencias b ON b.usuario_id = u.id AND b.anio = ${anio}
    WHERE d.activo = true
      ${departamentoId ? sql`AND d.id = ${departamentoId}` : sql``}
    GROUP BY d.id, d.nombre, d.codigo
    ORDER BY d.nombre
  `);

  return {
    departamentos: result.rows
  };
}

// Reporte de Proyecciones y Vencimientos
async function generarReporteProyecciones(
  anio: number,
  departamentoId: number | null
) {
  // Días próximos a vencer (próximos 90 días)
  const vencimientos = await db.execute(sql`
    SELECT 
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      d.nombre as departamento,
      ta.nombre as tipo_ausencia,
      (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as dias_disponibles,
      b.fecha_vencimiento,
      (b.fecha_vencimiento - CURRENT_DATE) as dias_restantes
    FROM balances_ausencias b
    INNER JOIN usuarios u ON u.id = b.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    INNER JOIN tipos_ausencia_config ta ON ta.id = b.tipo_ausencia_id
    WHERE b.anio = ${anio}
      AND b.fecha_vencimiento IS NOT NULL
      AND b.fecha_vencimiento > CURRENT_DATE
      AND b.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'
      AND (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente)::numeric > 0
      AND u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY b.fecha_vencimiento ASC
  `);

  // Días acumulados (empleados con más de 15 días disponibles)
  const acumulados = await db.execute(sql`
    SELECT 
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      d.nombre as departamento,
      ta.nombre as tipo_ausencia,
      (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as dias_acumulados
    FROM balances_ausencias b
    INNER JOIN usuarios u ON u.id = b.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    INNER JOIN tipos_ausencia_config ta ON ta.id = b.tipo_ausencia_id
    WHERE b.anio = ${anio}
      AND (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente)::numeric > 15
      AND u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente)::numeric DESC
  `);

  return {
    proximos_vencer: vencimientos.rows,
    dias_acumulados: acumulados.rows
  };
}

// Reporte de Ausentismo
async function generarReporteAusentismo(
  fechaInicio: string,
  fechaFin: string,
  departamentoId: number | null,
  tipoAusenciaId: number | null
) {
  // Resumen general
  const resumen = await db.execute(sql`
    SELECT 
      COUNT(*) as total_ausencias,
      SUM(s.cantidad)::numeric as total_dias,
      ROUND(AVG(s.cantidad)::numeric, 2) as promedio_dias,
      COUNT(DISTINCT s.usuario_id) as total_empleados,
      ROUND((SUM(s.cantidad)::numeric / COUNT(DISTINCT s.usuario_id)::numeric), 2) as promedio_empleado
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada', 'aprobada_jefe')
      AND u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
      ${tipoAusenciaId ? sql`AND s.tipo_ausencia_id = ${tipoAusenciaId}` : sql``}
  `);

  // Tendencia mensual
  const tendencia = await db.execute(sql`
    SELECT 
      TO_CHAR(s.fecha_inicio, 'YYYY-MM') as mes,
      COUNT(*) as solicitudes,
      SUM(s.cantidad)::numeric as dias,
      ROUND(AVG(s.cantidad)::numeric, 2) as promedio
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada', 'aprobada_jefe')
      AND u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
      ${tipoAusenciaId ? sql`AND s.tipo_ausencia_id = ${tipoAusenciaId}` : sql``}
    GROUP BY TO_CHAR(s.fecha_inicio, 'YYYY-MM')
    ORDER BY mes
  `);

  // Tipo más usado
  const tipoMasUsado = await db.execute(sql`
    SELECT ta.nombre
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    INNER JOIN tipos_ausencia_config ta ON ta.id = s.tipo_ausencia_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada', 'aprobada_jefe')
      AND u.activo = true
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    GROUP BY ta.nombre
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `);

  return {
    resumen: {
      ...resumen.rows[0],
      tipo_mas_usado: tipoMasUsado.rows[0]?.nombre || 'N/A'
    },
    tendencia_mensual: tendencia.rows
  };
}
