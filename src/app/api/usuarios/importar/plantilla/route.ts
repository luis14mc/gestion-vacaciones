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
    { header: 'Telefono', key: 'telefono', width: 16 },
    { header: 'Direccion Domicilio', key: 'direccion', width: 28 },
    { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 15 },
    { header: 'Fecha Nacimiento', key: 'fechaNacimiento', width: 18 },
    { header: 'Es Jefe', key: 'esJefe', width: 10 },
    { header: 'Es Director', key: 'esDirector', width: 12 },
    { header: 'Es Admin', key: 'esAdmin', width: 10 },
    { header: 'Es RRHH', key: 'esRrhh', width: 10 },
    { header: 'Activo', key: 'activo', width: 10 },
    { header: 'Email Jefe Superior', key: 'emailJefeSuperior', width: 30 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF182243' },
  };

  worksheet.getCell('E1').note =
    'Debe coincidir con un departamento registrado (Departamento, Area, Unidad o Gerencia).';
  worksheet.getCell('H1').note = 'Opcional. Direccion personal del empleado (no confundir con departamento).';
  worksheet.getCell('I1').note = 'Opcional. Formatos: YYYY-MM-DD o DD/MM/YYYY. Si se omite, se usa la fecha de importacion.';
  worksheet.getCell('J1').note = 'Opcional. Formatos aceptados: YYYY-MM-DD o DD/MM/YYYY.';
  worksheet.getCell('K1').note = 'Opcional. Si/No.';
  worksheet.getCell('L1').note = 'Opcional. Si/No.';
  worksheet.getCell('M1').note = 'Opcional. Solo administradores pueden importar este rol.';
  worksheet.getCell('N1').note = 'Opcional. Solo administradores pueden importar este rol.';
  worksheet.getCell('O1').note = 'Opcional. Si/No. Por defecto Si.';
  worksheet.getCell('P1').note =
    'Opcional. Debe ser Jefe o Director del mismo departamento (existente o en este Excel).';

  worksheet.addRow({
    email: 'directora@cni.hn',
    nombre: 'Laura',
    apellido: 'Martinez',
    numeroEmpleado: 'CNI-1026',
    departamento: 'Direccion Ejecutiva',
    cargo: 'Directora',
    telefono: '9999-0001',
    direccion: 'Col. Las Minitas, Tegucigalpa',
    fechaIngreso: '2025-01-15',
    fechaNacimiento: '1985-06-12',
    esJefe: 'No',
    esDirector: 'Si',
    esAdmin: 'No',
    esRrhh: 'No',
    activo: 'Si',
    emailJefeSuperior: '',
  });

  worksheet.addRow({
    email: 'jefe@cni.hn',
    nombre: 'Carlos',
    apellido: 'Lopez',
    numeroEmpleado: 'CNI-1024',
    departamento: 'Recursos Humanos',
    cargo: 'Jefe de Recursos Humanos',
    telefono: '9999-0002',
    direccion: 'Col. Palmira, Tegucigalpa',
    fechaIngreso: '2025-01-15',
    fechaNacimiento: '1990-03-20',
    esJefe: 'Si',
    esDirector: 'No',
    esAdmin: 'No',
    esRrhh: 'No',
    activo: 'Si',
    emailJefeSuperior: 'directora@cni.hn',
  });

  worksheet.addRow({
    email: 'ejemplo@cni.hn',
    nombre: 'Juan',
    apellido: 'Perez',
    numeroEmpleado: 'CNI-1025',
    departamento: 'Recursos Humanos',
    cargo: 'Analista',
    telefono: '9999-0003',
    direccion: 'Res. El Trapiche, Tegucigalpa',
    fechaIngreso: '2025-01-15',
    fechaNacimiento: '1995-11-08',
    esJefe: 'No',
    esDirector: 'No',
    esAdmin: 'No',
    esRrhh: 'No',
    activo: 'Si',
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
