import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { departamentos, usuarios } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { crearUsuario } from '@/services/usuarios.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!session.esAdmin && !session.esRrhh && !tienePermiso(session, 'usuarios.crear')) {
      return NextResponse.json({ success: false, error: 'Sin permiso para importar usuarios' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string; // 'validate' | 'import'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0]; // Tomar la primera hoja
    if (!worksheet) {
      return NextResponse.json({ success: false, error: 'El archivo Excel está vacío' }, { status: 400 });
    }

    // Buscar la fila de cabeceras (asumimos que es la primera fila con datos)
    let headerRow: any = null;
    let headerRowNumber = 1;
    
    worksheet.eachRow((row, rowNumber) => {
      if (!headerRow && row.hasValues) {
        headerRow = row;
        headerRowNumber = rowNumber;
      }
    });

    if (!headerRow) {
      return NextResponse.json({ success: false, error: 'No se encontraron cabeceras en el archivo' }, { status: 400 });
    }

    // Mapear los índices de las columnas
    const columnMap: Record<string, number> = {};
    headerRow.eachCell((cell: any, colNumber: number) => {
      const headerText = cell.text.trim().toLowerCase();
      if (headerText.includes('email') || headerText.includes('correo')) columnMap['email'] = colNumber;
      else if (headerText.includes('nombre')) columnMap['nombre'] = colNumber;
      else if (headerText.includes('apellido')) columnMap['apellido'] = colNumber;
      else if (headerText.includes('empleado') && (headerText.includes('número') || headerText.includes('numero') || headerText.includes('num') || headerText.includes('nro'))) columnMap['numeroEmpleado'] = colNumber;
      else if (headerText.includes('departamento') || headerText.includes('área') || headerText.includes('area')) columnMap['departamento'] = colNumber;
      else if (headerText.includes('cargo') || headerText.includes('puesto')) columnMap['cargo'] = colNumber;
      else if (headerText.includes('fecha') && headerText.includes('ingreso')) columnMap['fechaIngreso'] = colNumber;
      else if (headerText.includes('jefe')) columnMap['esJefe'] = colNumber;
      else if (headerText.includes('director')) columnMap['esDirector'] = colNumber;
    });

    // Validar columnas obligatorias
    const requiredCols = ['email', 'nombre', 'apellido', 'departamento'];
    const missingCols = requiredCols.filter(col => !columnMap[col]);
    
    if (missingCols.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Faltan columnas requeridas: ${missingCols.join(', ')}` 
      }, { status: 400 });
    }

    // Obtener departamentos y usuarios existentes
    const dbDepartamentos = await db.select({ id: departamentos.id, nombre: departamentos.nombre }).from(departamentos);
    const deptoMap = new Map(dbDepartamentos.map(d => [d.nombre.toLowerCase().trim(), d.id]));
    
    const dbUsuarios = await db.select({ email: usuarios.email }).from(usuarios);
    const correosExistentes = new Set(dbUsuarios.map(u => u.email.toLowerCase().trim()));

    const rowsParsed: any[] = [];
    let validacionExitosa = true;

    // Parsear datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return; // Skip headers
      
      const getVal = (colKey: string) => {
        const colNum = columnMap[colKey];
        if (!colNum) return '';
        const cell = row.getCell(colNum);
        return cell ? cell.text.trim() : '';
      };

      const email = getVal('email').toLowerCase();
      const nombre = getVal('nombre');
      const apellido = getVal('apellido');
      const numeroEmpleado = getVal('numeroEmpleado');
      const deptoNombre = getVal('departamento');
      const cargo = getVal('cargo');
      const fechaIngresoStr = getVal('fechaIngreso');
      const esJefeStr = getVal('esJefe').toLowerCase();
      const esDirectorStr = getVal('esDirector').toLowerCase();

      // Skip empty rows
      if (!email && !nombre && !apellido) return;

      const erroresFila: string[] = [];
      let deptoId: number | null = null;

      // Validaciones Fila
      if (!email) erroresFila.push('Email requerido');
      else if (!email.includes('@')) erroresFila.push('Email inválido');
      else if (correosExistentes.has(email)) erroresFila.push('El correo ya existe en el sistema');
      
      if (!nombre) erroresFila.push('Nombre requerido');
      if (!apellido) erroresFila.push('Apellido requerido');
      
      if (!deptoNombre) {
        erroresFila.push('Departamento requerido');
      } else {
        deptoId = deptoMap.get(deptoNombre.toLowerCase().trim()) || null;
        if (!deptoId) {
          erroresFila.push(`Departamento "${deptoNombre}" no coincide con ninguno registrado`);
        }
      }

      if (erroresFila.length > 0) validacionExitosa = false;

      // Intentar parsear fecha
      let fechaIngresoParsed = new Date();
      if (fechaIngresoStr) {
        const parsedDate = new Date(fechaIngresoStr);
        if (!isNaN(parsedDate.getTime())) {
          fechaIngresoParsed = parsedDate;
        }
      }

      rowsParsed.push({
        fila: rowNumber,
        email,
        nombre,
        apellido,
        numeroEmpleado,
        departamento: deptoNombre,
        departamentoId: deptoId,
        cargo,
        fechaIngreso: fechaIngresoParsed.toISOString(),
        esJefe: esJefeStr === 'si' || esJefeStr === 'sí' || esJefeStr === 'yes' || esJefeStr === 'true',
        esDirector: esDirectorStr === 'si' || esDirectorStr === 'sí' || esDirectorStr === 'yes' || esDirectorStr === 'true',
        errores: erroresFila
      });
    });

    if (rowsParsed.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron datos válidos en el archivo' }, { status: 400 });
    }

    if (mode === 'validate') {
      return NextResponse.json({
        success: true,
        valido: validacionExitosa,
        total: rowsParsed.length,
        conErrores: rowsParsed.filter(r => r.errores.length > 0).length,
        filas: rowsParsed
      });
    }

    if (mode === 'import') {
      if (!validacionExitosa) {
        return NextResponse.json({ 
          success: false, 
          error: 'Hay errores de validación. Corrija el archivo y vuelva a intentarlo.',
          detalles: rowsParsed.filter(r => r.errores.length > 0)
        }, { status: 400 });
      }

      let creados = 0;
      for (const userData of rowsParsed) {
        try {
          await crearUsuario({
            nombre: userData.nombre,
            apellido: userData.apellido,
            email: userData.email,
            password: '1234', // Contraseña por defecto según especificación
            departamentoId: userData.departamentoId!,
            cargo: userData.cargo,
            fechaIngreso: userData.fechaIngreso,
            esAdmin: false,
            esRrhh: false,
            esDirector: userData.esDirector,
            esJefe: userData.esJefe,
            numeroEmpleado: userData.numeroEmpleado || undefined,
            telefono: undefined,
            direccion: undefined
          });
          creados++;
        } catch (e) {
          console.error(`Error importando fila ${userData.fila} (${userData.email}):`, e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Importación exitosa. Se crearon ${creados} usuarios de ${rowsParsed.length} filas.`
      });
    }

    return NextResponse.json({ success: false, error: 'Modo inválido' }, { status: 400 });

  } catch (error) {
    console.error('Error procesando importación:', error);
    return NextResponse.json({ success: false, error: 'Error procesando el archivo' }, { status: 500 });
  }
}
