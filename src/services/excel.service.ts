/**
 * ============================================================
 * EXCEL SERVICE - Exportación de reportes
 * ============================================================
 * @description Genera archivos Excel con ExcelJS.
 *   Separado del servicio de reportes (SRP).
 * @version 1.0
 * ============================================================
 */

import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { solicitudes, usuarios, balances, departamentos, anosLaborales } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// =====================================================
// TIPOS
// =====================================================

interface ExcelOptions {
  departamentoId?: number;
  anoLaboralId?: number;
}

// =====================================================
// ESTILOS REUTILIZABLES
// =====================================================

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' }, // Azul CNI
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 25;
}

function applyDataStyle(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell((cell) => {
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle' };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F7FB' },
      };
    }
  });
}

// =====================================================
// REPORTE: Balances por usuario
// =====================================================

export async function exportarReporteBalances(opts: ExcelOptions = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CNI Honduras - Sistema de Vacaciones';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Balances', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // ── Título ──
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Reporte de Balances de Vacaciones - CNI Honduras';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 30;

  // ── Headers ──
  ws.columns = [
    { header: '', key: 'nombre', width: 28 },
    { header: '', key: 'email', width: 30 },
    { header: '', key: 'departamento', width: 22 },
    { header: '', key: 'diasInicial', width: 16 },
    { header: '', key: 'diasUsados', width: 16 },
    { header: '', key: 'diasPendientes', width: 16 },
    { header: '', key: 'diasDisponibles', width: 18 },
  ];

  const headerRow = ws.getRow(2);
  headerRow.values = [
    'Colaborador',
    'Email',
    'Departamento',
    'Días Iniciales',
    'Días Usados',
    'Días Pendientes',
    'Días Disponibles',
  ];
  applyHeaderStyle(headerRow);

  // ── Datos ──
  const query = sql`
    SELECT
      u.nombre || ' ' || u.apellido AS nombre_completo,
      u.email,
      COALESCE(d.nombre, 'Sin asignar') AS departamento,
      b.cantidad_inicial,
      b.cantidad_usada,
      b.cantidad_pendiente,
      b.cantidad_disponible
    FROM balances b
    INNER JOIN usuarios u ON u.id = b.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    INNER JOIN anos_laborales al ON al.id = b.ano_laboral_id AND al.activo = true
    WHERE b.tipo_ausencia = 'vacaciones'
      AND u.activo = true
      ${opts.departamentoId ? sql`AND u.departamento_id = ${opts.departamentoId}` : sql``}
    ORDER BY d.nombre, u.apellido, u.nombre
  `;

  const rows = await db.execute(query) as any[];
  let totalInicial = 0;
  let totalUsados = 0;
  let totalPendientes = 0;
  let totalDisponibles = 0;

  rows.forEach((row: any, i: number) => {
    const inicial = parseFloat(row.cantidad_inicial || '0');
    const usados = parseFloat(row.cantidad_usada || '0');
    const pendientes = parseFloat(row.cantidad_pendiente || '0');
    const disponibles = parseFloat(row.cantidad_disponible || '0');

    totalInicial += inicial;
    totalUsados += usados;
    totalPendientes += pendientes;
    totalDisponibles += disponibles;

    const dataRow = ws.addRow({
      nombre: row.nombre_completo,
      email: row.email,
      departamento: row.departamento,
      diasInicial: inicial,
      diasUsados: usados,
      diasPendientes: pendientes,
      diasDisponibles: disponibles,
    });

    applyDataStyle(dataRow, i % 2 === 0);

    // Color condicional para disponibles
    const dispCell = dataRow.getCell('diasDisponibles');
    if (disponibles <= 0) {
      dispCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (disponibles <= 3) {
      dispCell.font = { color: { argb: 'FFF59E0B' }, bold: true };
    }
  });

  // ── Totales ──
  const totalRow = ws.addRow({
    nombre: 'TOTALES',
    email: '',
    departamento: `${rows.length} colaboradores`,
    diasInicial: totalInicial,
    diasUsados: totalUsados,
    diasPendientes: totalPendientes,
    diasDisponibles: totalDisponibles,
  });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = BORDER_THIN;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  });

  // ── Footer ──
  const footerRow = ws.addRow([]);
  ws.addRow([`Generado: ${new Date().toLocaleString('es-HN')}`]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// =====================================================
// REPORTE: Solicitudes
// =====================================================

export async function exportarReporteSolicitudes(opts: ExcelOptions & {
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
} = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CNI Honduras';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Solicitudes', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // ── Título ──
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Reporte de Solicitudes - CNI Honduras';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 30;

  // ── Headers ──
  ws.columns = [
    { header: '', key: 'codigo', width: 20 },
    { header: '', key: 'colaborador', width: 28 },
    { header: '', key: 'tipo', width: 18 },
    { header: '', key: 'fechaInicio', width: 14 },
    { header: '', key: 'fechaFin', width: 14 },
    { header: '', key: 'dias', width: 10 },
    { header: '', key: 'estado', width: 22 },
    { header: '', key: 'fechaCreacion', width: 18 },
  ];

  const headerRow = ws.getRow(2);
  headerRow.values = [
    'Código',
    'Colaborador',
    'Tipo',
    'Fecha Inicio',
    'Fecha Fin',
    'Días',
    'Estado',
    'Fecha Creación',
  ];
  applyHeaderStyle(headerRow);

  // ── Datos ──
  const conditions = [sql`u.activo = true`];
  if (opts.departamentoId) conditions.push(sql`u.departamento_id = ${opts.departamentoId}`);
  if (opts.estado) conditions.push(sql`s.estado = ${opts.estado}`);
  if (opts.fechaDesde) conditions.push(sql`s.fecha_inicio >= ${opts.fechaDesde}`);
  if (opts.fechaHasta) conditions.push(sql`s.fecha_fin <= ${opts.fechaHasta}`);

  const whereClause = sql.join(conditions, sql` AND `);

  const query = sql`
    SELECT
      s.codigo,
      u.nombre || ' ' || u.apellido AS colaborador,
      s.tipo,
      s.fecha_inicio,
      s.fecha_fin,
      s.dias_solicitados,
      s.estado,
      s.created_at
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE ${whereClause}
    ORDER BY s.created_at DESC
  `;

  const rows = await db.execute(query) as any[];

  const ESTADO_LABELS: Record<string, string> = {
    borrador: 'Borrador',
    pendiente_jefe: 'Pendiente Jefe',
    aprobada_jefe: 'Aprobada por Jefe',
    rechazada_jefe: 'Rechazada por Jefe',
    aprobada_rrhh: 'Aprobada por RRHH',
    rechazada_rrhh: 'Rechazada por RRHH',
    cancelada: 'Cancelada',
    finalizada: 'Finalizada',
  };

  const TIPO_LABELS: Record<string, string> = {
    vacaciones: 'Vacaciones',
    permiso_salida: 'Permiso Salida',
    licencia_medica: 'Licencia Médica',
    permiso_personal: 'Permiso Personal',
  };

  rows.forEach((row: any, i: number) => {
    const dataRow = ws.addRow({
      codigo: row.codigo,
      colaborador: row.colaborador,
      tipo: TIPO_LABELS[row.tipo] || row.tipo,
      fechaInicio: row.fecha_inicio || '-',
      fechaFin: row.fecha_fin || '-',
      dias: row.dias_solicitados ? parseFloat(row.dias_solicitados) : '-',
      estado: ESTADO_LABELS[row.estado] || row.estado,
      fechaCreacion: row.created_at ? new Date(row.created_at).toLocaleDateString('es-HN') : '-',
    });

    applyDataStyle(dataRow, i % 2 === 0);
  });

  // ── Resumen ──
  ws.addRow([]);
  ws.addRow([`Total solicitudes: ${rows.length}`]);
  ws.addRow([`Generado: ${new Date().toLocaleString('es-HN')}`]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
