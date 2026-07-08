/**
 * Servicio de exportación — CSV, XLSX y PDF institucionales desde datasets canónicos.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TipoReporteCNI } from '@/lib/domain/reportes/filters';
import { csvConBom, filasACsv } from '@/lib/domain/exportacion/csv';
import { exportarFilasExcel } from '@/services/excel.service';
import type { DatasetReporte } from '@/services/reportes.service';
import { formatDateTime } from '@/lib/utils/date-format';

export type FormatoExportacion = 'csv' | 'xlsx' | 'pdf';

const SLUG_TIPO: Record<TipoReporteCNI, string> = {
  balances: 'balance_vacaciones',
  solicitudes: 'solicitudes',
  departamentos: 'uso_departamento',
  ausentismo: 'ausentismo',
  cumpleanos: 'cumpleanos',
  permisos_salida: 'permisos_salida',
  cierre_ano: 'cierre_ano',
};

export function normalizarFormatoExportacion(raw: string | null): FormatoExportacion | null {
  if (!raw) return 'csv';
  const v = raw.toLowerCase().trim();
  if (v === 'csv') return 'csv';
  if (v === 'xlsx' || v === 'excel') return 'xlsx';
  if (v === 'pdf') return 'pdf';
  return null;
}

export function nombreArchivoReporte(
  tipo: TipoReporteCNI,
  formato: FormatoExportacion,
  anio?: number
): string {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const year = anio ?? new Date().getFullYear();
  const ext = formato === 'xlsx' ? 'xlsx' : formato === 'pdf' ? 'pdf' : 'csv';
  return `cni_${SLUG_TIPO[tipo]}_${year}_${fecha}.${ext}`;
}

function resumenFiltrosTexto(filtros: Record<string, unknown>): string {
  const partes: string[] = [];
  for (const [key, value] of Object.entries(filtros)) {
    if (value == null || value === '' || value === 'all') continue;
    partes.push(`${key}: ${value}`);
  }
  return partes.length > 0 ? partes.join(' · ') : 'Sin filtros adicionales';
}

function generarPdfInstitucional(dataset: DatasetReporte): Buffer {
  const doc = new jsPDF({ orientation: dataset.columnas.length > 8 ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text(`${dataset.titulo} — CNI Honduras`, pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generado: ${formatDateTime(dataset.generadoEn)}`,
    pageWidth / 2,
    24,
    { align: 'center' }
  );
  doc.text(`Filtros: ${resumenFiltrosTexto(dataset.filtrosRecord)}`, pageWidth / 2, 30, {
    align: 'center',
  });
  doc.text(`Registros: ${dataset.totalRegistros}`, pageWidth / 2, 36, { align: 'center' });

  const head = [dataset.columnas.map((c) => c.header)];
  const body =
    dataset.filas.length === 0
      ? [['Sin datos para los filtros seleccionados']]
      : dataset.filas.map((fila) =>
          dataset.columnas.map((col) => String(fila[col.key] ?? ''))
        );

  autoTable(doc, {
    head,
    body,
    startY: 42,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [242, 247, 251] },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export interface ResultadoExportacion {
  body: Buffer | string;
  contentType: string;
  filename: string;
}

export async function exportarDatasetReporte(
  dataset: DatasetReporte,
  formato: FormatoExportacion
): Promise<ResultadoExportacion> {
  const filename = nombreArchivoReporte(dataset.tipo, formato, dataset.filtros.anio);

  if (formato === 'csv') {
    const csv = csvConBom(
      filasACsv(dataset.filas, dataset.columnas, { sinDatos: dataset.sinDatos })
    );
    return {
      body: csv,
      contentType: 'text/csv; charset=utf-8',
      filename,
    };
  }

  if (formato === 'xlsx') {
    const buffer = await exportarFilasExcel({
      titulo: `${dataset.titulo} — CNI Honduras`,
      hoja: dataset.tipo,
      columnas: dataset.columnas,
      filas: dataset.filas,
      meta: {
        generadoEn: dataset.generadoEn,
        filtros: dataset.filtrosRecord,
        totalRegistros: dataset.totalRegistros,
        sinDatos: dataset.sinDatos,
      },
    });
    return {
      body: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename,
    };
  }

  const pdfBuffer = generarPdfInstitucional(dataset);
  return {
    body: pdfBuffer,
    contentType: 'application/pdf',
    filename,
  };
}
