import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { exportarFilasExcel } from '@/services/excel.service';
import { COLUMNAS_REPORTE } from '@/lib/domain/reportes/columns';

describe('exportacion xlsx', () => {
  it('genera buffer xlsx válido con encabezados CNI', async () => {
    const buffer = await exportarFilasExcel({
      titulo: 'Balance de Vacaciones — CNI Honduras',
      hoja: 'balances',
      columnas: COLUMNAS_REPORTE.balances.slice(0, 3),
      filas: [
        {
          colaborador: 'Ana Pérez',
          email: 'ana@cni.hn',
          departamento: 'TI',
        },
      ],
      meta: {
        generadoEn: new Date().toISOString(),
        filtros: { anio: 2026 },
        totalRegistros: 1,
      },
    });

    expect(buffer.length).toBeGreaterThan(100);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('balances');
    expect(sheet).toBeTruthy();
    expect(String(sheet?.getRow(4).getCell(1).value)).toBe('Colaborador');
    expect(String(sheet?.getRow(5).getCell(1).value)).toBe('Ana Pérez');
  });
});
