import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReporteConfig {
  titulo: string;
  subtitulo?: string;
  datos: Record<string, any>[];
  columnas: string[];
  campos: string[];
}

export function generarPDFReporte(config: PDFReporteConfig): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFontSize(18);
  doc.setTextColor(59, 130, 246);
  doc.text(config.titulo, pageWidth / 2, 20, { align: 'center' });

  if (config.subtitulo) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(config.subtitulo, pageWidth / 2, 30, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-HN')}`, pageWidth - 15, 10, { align: 'right' });

  const body = config.datos.map(row =>
    config.campos.map(campo => String(row[campo] ?? ''))
  );

  autoTable(doc, {
    head: [config.columnas],
    body,
    startY: config.subtitulo ? 40 : 30,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  return doc;
}

export function descargarPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
