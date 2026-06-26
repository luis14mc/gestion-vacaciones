/**
 * ============================================================
 * EXCEL SERVICE - Exportación institucional CNI
 * ============================================================
 * Genera archivos .xlsx con ExcelJS desde datasets canónicos.
 * ============================================================
 */

import ExcelJS from 'exceljs';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
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
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 28;
}

function applyDataStyle(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell((cell) => {
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', wrapText: true };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F7FB' },
      };
    }
  });
}

function esColumnaNumerica(key: string): boolean {
  return (
    key.includes('dias_') ||
    key.startsWith('total_') ||
    key === 'porcentaje_uso' ||
    key === 'promedio_dias' ||
    key === 'ano_laboral' ||
    key === 'ano' ||
    key === 'mes_cumpleanos'
  );
}

function esColumnaFecha(key: string): boolean {
  return (
    key.includes('fecha') ||
    key === 'ultima_actualizacion' ||
    key === 'fecha_creacion'
  );
}

export interface ExportarFilasExcelInput {
  titulo: string;
  hoja: string;
  columnas: Array<{ key: string; header: string }>;
  filas: Record<string, unknown>[];
  meta?: {
    generadoEn: string;
    filtros: Record<string, unknown>;
    totalRegistros?: number;
    sinDatos?: boolean;
  };
}

export async function exportarFilasExcel(input: ExportarFilasExcelInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CNI Honduras - Sistema de Vacaciones';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(input.hoja.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const colCount = Math.max(input.columnas.length, 1);
  const lastColLetter =
    colCount <= 26
      ? String.fromCharCode(64 + colCount)
      : `A${String.fromCharCode(64 + colCount - 26)}`;

  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = input.titulo;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  const generado = input.meta?.generadoEn
    ? new Date(input.meta.generadoEn).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })
    : new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' });

  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell('A2').value = `Generado: ${generado}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  const filtrosTexto = input.meta?.filtros
    ? Object.entries(input.meta.filtros)
        .filter(([, v]) => v != null && v !== '' && v !== 'all')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
    : '';
  ws.mergeCells(`A3:${lastColLetter}3`);
  ws.getCell('A3').value = filtrosTexto
    ? `Filtros: ${filtrosTexto}`
    : 'Filtros: ninguno adicional';
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF64748B' } };
  ws.getCell('A3').alignment = { horizontal: 'center', wrapText: true };

  ws.columns = input.columnas.map((col) => ({
    header: '',
    key: col.key,
    width: Math.max(12, Math.min(col.header.length + 4, 36)),
  }));

  const headerRowNum = 4;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.values = input.columnas.map((c) => c.header);
  applyHeaderStyle(headerRow);

  const dataStart = headerRowNum + 1;
  const filas =
    input.meta?.sinDatos || input.filas.length === 0
      ? [
          Object.fromEntries([
            [
              input.columnas[0]?.key ?? 'colaborador',
              'Sin datos para los filtros seleccionados',
            ],
          ]),
        ]
      : input.filas;

  filas.forEach((fila, i) => {
    const dataRow = ws.addRow(fila);
    applyDataStyle(dataRow, i % 2 === 0);

    input.columnas.forEach((col, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      if (esColumnaNumerica(col.key) && typeof fila[col.key] === 'number') {
        cell.numFmt = col.key === 'porcentaje_uso' ? '0.00"%"' : '0.00';
      } else if (esColumnaNumerica(col.key) && fila[col.key] != null && fila[col.key] !== '') {
        const num = Number(fila[col.key]);
        if (Number.isFinite(num)) {
          cell.value = num;
          cell.numFmt = '0.00';
        }
      } else if (esColumnaFecha(col.key) && fila[col.key]) {
        cell.numFmt = 'dd/mm/yyyy';
      }
    });
  });

  const lastDataRow = dataStart + filas.length - 1;
  if (input.filas.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: lastDataRow, column: input.columnas.length },
    };
  }

  ws.addRow([]);
  ws.addRow([
    `Total registros: ${input.meta?.totalRegistros ?? input.filas.length}`,
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
