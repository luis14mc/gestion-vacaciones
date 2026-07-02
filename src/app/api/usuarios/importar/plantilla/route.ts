import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { getSession } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async () => {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Vacaciones CNI';

    const worksheet = workbook.addWorksheet('Empleados');

    worksheet.columns = [
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Numero Empleado', key: 'numeroEmpleado', width: 18 },
      { header: 'Departamento', key: 'departamento', width: 28 },
      { header: 'Cargo', key: 'cargo', width: 25 },
      { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 15 },
      { header: 'Fecha Nacimiento', key: 'fechaNacimiento', width: 18 },
      { header: 'Es Jefe', key: 'esJefe', width: 10 },
      { header: 'Es Director', key: 'esDirector', width: 12 },
      { header: 'Email Jefe Superior', key: 'emailJefeSuperior', width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF182243' },
    };

    worksheet.getCell('E1').note = 'Puede llamarse Departamento, Direccion, Area, Unidad o Gerencia. Debe coincidir con una unidad registrada.';
    worksheet.getCell('H1').note = 'Opcional. Formatos aceptados: YYYY-MM-DD o DD/MM/YYYY.';
    worksheet.getCell('I1').note = 'Si indica Si, este usuario queda como jefe de la unidad indicada cuando no haya director para esa misma unidad.';
    worksheet.getCell('J1').note = 'Si indica Si, este usuario queda como director/jefe principal de la unidad indicada.';
    worksheet.getCell('K1').note = 'Opcional para todos. Puede referenciar un correo existente o un usuario incluido en este mismo Excel.';

    worksheet.addRow({
      email: 'directora@cni.hn',
      nombre: 'Laura',
      apellido: 'Martinez',
      numeroEmpleado: 'CNI-1026',
      departamento: 'Direccion Ejecutiva',
      cargo: 'Directora',
      fechaIngreso: '2025-01-15',
      fechaNacimiento: '1985-06-12',
      esJefe: 'No',
      esDirector: 'Si',
      emailJefeSuperior: '',
    });

    worksheet.addRow({
      email: 'jefe@cni.hn',
      nombre: 'Carlos',
      apellido: 'Lopez',
      numeroEmpleado: 'CNI-1024',
      departamento: 'Recursos Humanos',
      cargo: 'Jefe de Recursos Humanos',
      fechaIngreso: '2025-01-15',
      fechaNacimiento: '1990-03-20',
      esJefe: 'Si',
      esDirector: 'No',
      emailJefeSuperior: 'directora@cni.hn',
    });

    worksheet.addRow({
      email: 'ejemplo@cni.hn',
      nombre: 'Juan',
      apellido: 'Perez',
      numeroEmpleado: 'CNI-1025',
      departamento: 'Recursos Humanos',
      cargo: 'Analista',
      fechaIngreso: '2025-01-15',
      fechaNacimiento: '1995-11-08',
      esJefe: 'No',
      esDirector: 'No',
      emailJefeSuperior: 'jefe@cni.hn',
    });

    for (const rowNumber of [2, 3, 4]) {
      worksheet.getRow(rowNumber).font = { italic: true, color: { argb: 'FF888888' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Plantilla_Importacion_Empleados.xlsx"',
      },
    });
});
