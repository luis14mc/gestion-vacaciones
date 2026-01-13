import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar permiso reportes.exportar
    if (!tienePermiso(session, 'reportes.exportar')) {
      console.log(`❌ Usuario ${session.email} sin permiso reportes.exportar`);
      return NextResponse.json(
        { error: 'No tienes permiso para exportar reportes' },
        { status: 403 }
      );
    }

    console.log(`✅ Usuario ${session.email} exportando reporte`);

    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato');
    const tipoReporte = searchParams.get('tipoReporte') || 'balances';
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));
    const fechaInicio = searchParams.get('fechaInicio') || `${anio}-01-01`;
    const fechaFin = searchParams.get('fechaFin') || `${anio}-12-31`;
    const departamentoId = searchParams.get('departamentoId') ? parseInt(searchParams.get('departamentoId')!) : null;
    const tipoAusenciaId = searchParams.get('tipoAusenciaId') ? parseInt(searchParams.get('tipoAusenciaId')!) : null;

    // 3. Generar CSV (soportado sin librerías)
    if (formato === 'excel' || formato === 'csv') {
      let csvData = '';
      let filename = `reporte_${tipoReporte}_${Date.now()}.csv`;

      switch (tipoReporte) {
        case 'balances':
          csvData = await generarCSVBalances(anio, departamentoId, tipoAusenciaId);
          break;
        case 'solicitudes':
          csvData = await generarCSVSolicitudes(fechaInicio, fechaFin, departamentoId, tipoAusenciaId);
          break;
        case 'departamentos':
          csvData = await generarCSVDepartamentos(anio, departamentoId);
          break;
        case 'proyecciones':
          csvData = await generarCSVProyecciones(anio, departamentoId);
          break;
        case 'ausentismo':
          csvData = await generarCSVAusentismo(fechaInicio, fechaFin, departamentoId, tipoAusenciaId);
          break;
        default:
          return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 });
      }

      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (formato === 'pdf') {
      // PDF requiere librería pdfkit
      return NextResponse.json(
        { 
          success: false, 
          error: 'Exportación a PDF requiere instalar pdfkit. Por ahora use CSV/Excel.' 
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Formato no soportado. Use: excel o pdf' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error exportando reporte:', error);
    return NextResponse.json(
      { success: false, error: 'Error al exportar reporte' },
      { status: 500 }
    );
  }
}

// ===== FUNCIONES DE GENERACIÓN CSV =====

async function generarCSVBalances(anio: number, departamentoId: number | null, tipoAusenciaId: number | null) {
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

  let csv = 'Empleado,Email,Departamento,Tipo Ausencia,Asignados,Utilizados,Pendientes,Disponibles\n';
  for (const row of result.rows) {
    csv += `"${row.empleado}","${row.email}","${row.departamento || 'N/A'}","${row.tipo_ausencia || 'N/A'}",${row.asignados || 0},${row.utilizados || 0},${row.pendientes || 0},${row.disponibles || 0}\n`;
  }
  return csv;
}

async function generarCSVSolicitudes(fechaInicio: string, fechaFin: string, departamentoId: number | null, tipoAusenciaId: number | null) {
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
    ORDER BY s.fecha_inicio DESC
  `);

  let csv = 'ID,Empleado,Departamento,Tipo Ausencia,Fecha Inicio,Fecha Fin,Días,Estado,Fecha Solicitud,Motivo\n';
  for (const row of result.rows) {
    csv += `${row.id},"${row.empleado}","${row.departamento || 'N/A'}","${row.tipo_ausencia}","${row.fecha_inicio}","${row.fecha_fin}",${row.dias_solicitados},"${row.estado}","${row.fecha_solicitud}","${row.motivo || 'N/A'}"\n`;
  }
  return csv;
}

async function generarCSVDepartamentos(anio: number, departamentoId: number | null) {
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

  let csv = 'Departamento,Código,Total Empleados,Días Asignados,Días Usados,Días Disponibles,% Uso\n';
  for (const row of result.rows) {
    csv += `"${row.nombre}","${row.codigo}",${row.total_empleados},${row.total_asignados},${row.total_usados},${row.total_disponibles},${row.porcentaje_uso}%\n`;
  }
  return csv;
}

async function generarCSVProyecciones(anio: number, departamentoId: number | null) {
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

  let csv = 'Tipo,Empleado,Departamento,Tipo Ausencia,Días Disponibles,Fecha Vencimiento,Días Restantes\n';
  for (const row of vencimientos.rows) {
    csv += `"Próximo a vencer","${row.empleado}","${row.departamento || 'N/A'}","${row.tipo_ausencia}",${row.dias_disponibles},"${row.fecha_vencimiento}",${row.dias_restantes}\n`;
  }
  return csv;
}

async function generarCSVAusentismo(fechaInicio: string, fechaFin: string, departamentoId: number | null, tipoAusenciaId: number | null) {
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

  let csv = 'Mes,Total Solicitudes,Total Días,Promedio Días\n';
  for (const row of tendencia.rows) {
    csv += `"${row.mes}",${row.solicitudes},${row.dias},${row.promedio}\n`;
  }
  return csv;
}
