import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Vacaciones CNI';
    
    const worksheet = workbook.addWorksheet('Empleados');

    // Definir columnas
    worksheet.columns = [
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Número Empleado', key: 'numeroEmpleado', width: 18 },
      { header: 'Departamento', key: 'departamento', width: 25 },
      { header: 'Cargo', key: 'cargo', width: 25 },
      { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 15 },
      { header: 'Es Jefe', key: 'esJefe', width: 10 },
      { header: 'Es Director', key: 'esDirector', width: 12 },
    ];

    // Estilos para la cabecera
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF182243' } // CNI Deep Navy
    };

    // Añadir una fila de ejemplo (instruccional)
    worksheet.addRow({
      email: 'ejemplo@cni.hn',
      nombre: 'Juan',
      apellido: 'Perez',
      numeroEmpleado: 'CNI-1025',
      departamento: 'Recursos Humanos',
      cargo: 'Analista',
      fechaIngreso: '2025-01-15',
      esJefe: 'No',
      esDirector: 'No'
    });

    // Poner la fila de ejemplo en cursiva y texto gris para indicar que es un ejemplo
    const exampleRow = worksheet.getRow(2);
    exampleRow.font = { italic: true, color: { argb: 'FF888888' } };

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Retornar archivo
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Plantilla_Importacion_Empleados.xlsx"'
      }
    });

  } catch (error) {
    console.error('Error generando plantilla:', error);
    return NextResponse.json({ success: false, error: 'Error interno generando plantilla' }, { status: 500 });
  }
}
