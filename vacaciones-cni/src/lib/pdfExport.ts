import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReporteData {
  titulo: string;
  subtitulo?: string;
  datos: any[];
  columnas: string[];
  campos: string[];
}

export function generarPDFReporte(config: ReporteData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Logo y encabezado
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55); // gray-800
  doc.text('CNI - Sistema de Gestión de Vacaciones', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text(config.titulo, pageWidth / 2, 25, { align: 'center' });

  if (config.subtitulo) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(config.subtitulo, pageWidth / 2, 32, { align: 'center' });
  }

  // Fecha de generación
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175); // gray-400
  const fechaHora = new Date().toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generado: ${fechaHora}`, pageWidth / 2, 38, { align: 'center' });

  // Preparar datos para la tabla
  const filas = config.datos.map(item => 
    config.campos.map(campo => {
      const valor = item[campo];
      if (valor === null || valor === undefined) return '-';
      if (typeof valor === 'number') return valor.toLocaleString('es-ES');
      return String(valor);
    })
  );

  // Tabla con autoTable
  autoTable(doc, {
    head: [config.columnas],
    body: filas,
    startY: 45,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      halign: 'left',
    },
    headStyles: {
      fillColor: [59, 130, 246], // blue-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50
    },
    columnStyles: {
      // Alinear números a la derecha
      ...Object.fromEntries(
        config.campos.map((campo, index) => {
          const esNumero = config.datos.some(item => typeof item[campo] === 'number');
          return [index, { halign: esNumero ? 'right' : 'left' }];
        })
      ),
    },
    margin: { top: 45, left: 10, right: 10, bottom: 20 },
    didDrawPage: (data) => {
      // Footer con número de página
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      const pageCount = doc.getNumberOfPages();
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    },
  });

  // Resumen al final si hay datos
  if (config.datos.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Total de registros: ${config.datos.length}`, 10, finalY + 10);
  }

  return doc;
}

export function descargarPDF(doc: jsPDF, nombreArchivo: string) {
  doc.save(nombreArchivo);
}
