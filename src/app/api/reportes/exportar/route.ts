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
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar permiso reportes.exportar
    if (!tienePermiso(session, 'reportes.exportar')) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para exportar reportes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato');
    const tipoReporte = searchParams.get('tipoReporte') || 'balances';
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));
    const fechaInicio = searchParams.get('fechaInicio') || `${anio}-01-01`;
    const fechaFin = searchParams.get('fechaFin') || `${anio}-12-31`;
    const departamentoId = searchParams.get('departamentoId') ? parseInt(searchParams.get('departamentoId')!) : null;

    // 3. Generar CSV
    if (formato === 'excel' || formato === 'csv') {
      let csvData = '';
      const filename = `reporte_${tipoReporte}_${Date.now()}.csv`;

      switch (tipoReporte) {
        case 'balances':
          csvData = await generarCSVBalances(anio, departamentoId);
          break;
        case 'solicitudes':
          csvData = await generarCSVSolicitudes(fechaInicio, fechaFin, departamentoId);
          break;
        case 'departamentos':
          csvData = await generarCSVDepartamentos(anio, departamentoId);
          break;
        case 'ausentismo':
          csvData = await generarCSVAusentismo(fechaInicio, fechaFin, departamentoId);
          break;
        default:
          return NextResponse.json({ success: false, error: 'Tipo de reporte no válido' }, { status: 400 });
      }

      // Agregar BOM UTF-8 para correcta visualización de tildes en Excel
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvData;

      return new NextResponse(csvWithBOM, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (formato === 'pdf') {
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

// ===== FUNCIONES DE GENERACIÓN CSV (CNI Schema) =====

async function generarCSVBalances(anio: number, departamentoId: number | null) {
  const result = await db.execute(sql`
    SELECT 
      u.id as usuario_id,
      CONCAT(u.nombre, ' ', u.apellido) as empleado,
      u.email,
      d.nombre as departamento,
      b.tipo_ausencia,
      b.cantidad_inicial as asignados,
      b.cantidad_usada as utilizados,
      b.cantidad_pendiente as pendientes,
      b.cantidad_disponible as disponibles
    FROM usuarios u
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN balances b ON b.usuario_id = u.id 
      AND b.ano_laboral_id = (SELECT id FROM anos_laborales WHERE ano = ${anio} LIMIT 1)
    WHERE u.activo = true AND u.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY d.nombre, u.apellido, b.tipo_ausencia
  `);

  let csv = 'Empleado,Email,Departamento,Tipo Ausencia,Asignados,Utilizados,Pendientes,Disponibles\n';
  for (const row of result as any[]) {
    csv += `"${row.empleado}","${row.email}","${row.departamento || 'N/A'}","${row.tipo_ausencia || 'N/A'}",${row.asignados || 0},${row.utilizados || 0},${row.pendientes || 0},${row.disponibles || 0}\n`;
  }
  return csv;
}

async function generarCSVSolicitudes(fechaInicio: string, fechaFin: string, departamentoId: number | null) {
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
      AND s.fecha_fin <= ${fechaFin}
      AND s.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    ORDER BY s.fecha_inicio DESC
  `);

  let csv = 'ID,Código,Empleado,Departamento,Tipo,Fecha Inicio,Fecha Fin,Días,Estado,Fecha Solicitud,Motivo\n';
  for (const row of result as any[]) {
    csv += `${row.id},"${row.codigo}","${row.empleado}","${row.departamento || 'N/A'}","${row.tipo}","${row.fecha_inicio}","${row.fecha_fin}",${row.dias_solicitados || 0},"${row.estado}","${row.fecha_solicitud}","${(row.motivo || 'N/A').replace(/"/g, '""')}"\n`;
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

  let csv = 'Departamento,Código,Total Empleados,Días Asignados,Días Usados,Días Disponibles,% Uso\n';
  for (const row of result as any[]) {
    csv += `"${row.nombre}","${row.codigo}",${row.total_empleados},${row.total_asignados},${row.total_usados},${row.total_disponibles},${row.porcentaje_uso}%\n`;
  }
  return csv;
}

async function generarCSVAusentismo(fechaInicio: string, fechaFin: string, departamentoId: number | null) {
  const result = await db.execute(sql`
    SELECT 
      TO_CHAR(s.fecha_inicio::timestamp, 'YYYY-MM') as mes,
      COUNT(*) as solicitudes,
      COALESCE(SUM(s.dias_solicitados::numeric), 0) as dias,
      ROUND(COALESCE(AVG(s.dias_solicitados::numeric), 0), 2) as promedio
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.fecha_inicio >= ${fechaInicio}
      AND s.fecha_fin <= ${fechaFin}
      AND s.estado IN ('aprobada_rrhh', 'aprobada_ejecutiva', 'finalizada')
      AND u.activo = true
      AND s.deleted_at IS NULL
      ${departamentoId ? sql`AND u.departamento_id = ${departamentoId}` : sql``}
    GROUP BY TO_CHAR(s.fecha_inicio::timestamp, 'YYYY-MM')
    ORDER BY mes
  `);

  let csv = 'Mes,Total Solicitudes,Total Días,Promedio Días\n';
  for (const row of result as any[]) {
    csv += `"${row.mes}",${row.solicitudes},${row.dias},${row.promedio}\n`;
  }
  return csv;
}
