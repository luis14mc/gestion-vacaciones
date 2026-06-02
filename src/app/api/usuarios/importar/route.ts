import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { departamentos, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { crearUsuario } from '@/services/usuarios.service';

export const runtime = 'nodejs';

const TRUE_VALUES = new Set(['si', 'sí', 'yes', 'true', '1', 'x']);

function parseBooleanCell(value: string) {
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
      if (headerText.includes('email') && !headerText.includes('jefe')) columnMap['email'] = colNumber;
      else if (headerText.includes('nombre')) columnMap['nombre'] = colNumber;
      else if (headerText.includes('apellido')) columnMap['apellido'] = colNumber;
      else if (headerText.includes('empleado') && (headerText.includes('número') || headerText.includes('numero') || headerText.includes('num') || headerText.includes('nro'))) columnMap['numeroEmpleado'] = colNumber;
      else if (headerText.includes('departamento') || headerText.includes('área') || headerText.includes('area')) columnMap['departamento'] = colNumber;
      else if (headerText.includes('cargo') || headerText.includes('puesto')) columnMap['cargo'] = colNumber;
      else if (headerText.includes('fecha') && headerText.includes('ingreso')) columnMap['fechaIngreso'] = colNumber;
      else if (headerText.includes('jefe') && !headerText.includes('email') && !headerText.includes('correo') && !headerText.includes('superior')) columnMap['esJefe'] = colNumber;
      else if (headerText.includes('director')) columnMap['esDirector'] = colNumber;
      // Columna para el email del jefe superior
      else if ((headerText.includes('jefe') || headerText.includes('superior')) && (headerText.includes('email') || headerText.includes('correo'))) columnMap['emailJefeSuperior'] = colNumber;
      // También aceptar "email jefe superior" como una columna completa
      else if (headerText.includes('jefe') && headerText.includes('superior')) columnMap['emailJefeSuperior'] = colNumber;
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
    const dbDepartamentos = await db.select({ id: departamentos.id, nombre: departamentos.nombre, jefeId: departamentos.jefeId }).from(departamentos);
    const deptoMap = new Map(dbDepartamentos.map(d => [d.nombre.toLowerCase().trim(), d.id]));
    const deptoJefeMap = new Map(dbDepartamentos.map(d => [d.id, d.jefeId]));
    
    const dbUsuarios = await db.select({ id: usuarios.id, email: usuarios.email }).from(usuarios);
    const correosExistentes = new Set(dbUsuarios.map(u => u.email.toLowerCase().trim()));
    const emailToIdMap = new Map(dbUsuarios.map(u => [u.email.toLowerCase().trim(), u.id]));

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
      const emailJefeSuperior = getVal('emailJefeSuperior').toLowerCase();
      const esJefe = parseBooleanCell(esJefeStr);
      const esDirector = parseBooleanCell(esDirectorStr);

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

      // El jefe superior es opcional para todos. Si viene informado,
      // debe tener formato de correo válido.
      if (emailJefeSuperior && !isValidEmail(emailJefeSuperior)) {
        erroresFila.push('Email Jefe Superior inválido');
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
        esJefe,
        esDirector,
        emailJefeSuperior: esDirector ? null : emailJefeSuperior || null,
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

      // ── PRIMERA PASADA: Crear todos los usuarios ──
      let creados = 0;
      const usuariosCreados: { id: number; email: string; emailJefeSuperior: string | null; departamentoId: number | null; esDirector: boolean }[] = [];

      for (const userData of rowsParsed) {
        try {
          const nuevoUsuario = await crearUsuario({
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

          if (nuevoUsuario?.id) {
            creados++;
            usuariosCreados.push({
              id: nuevoUsuario.id,
              email: userData.email,
              emailJefeSuperior: userData.emailJefeSuperior,
              departamentoId: userData.departamentoId,
              esDirector: userData.esDirector
            });

            // Registrar en el mapa para que otros usuarios del mismo archivo puedan referenciarlo como jefe
            emailToIdMap.set(userData.email.toLowerCase(), nuevoUsuario.id);
          }
        } catch (e) {
          console.error(`Error importando fila ${userData.fila} (${userData.email}):`, e);
        }
      }

      // ── SEGUNDA PASADA: Asignar jefeSuperiorId ──
      let jefesAsignados = 0;
      let jefesAsignadosPorDepto = 0;

      for (const uc of usuariosCreados) {
        if (uc.esDirector) continue;

        let jefeSuperiorId: number | null = null;

        // Prioridad 1: Email del jefe especificado en el Excel
        if (uc.emailJefeSuperior && isValidEmail(uc.emailJefeSuperior)) {
          const jefeId = emailToIdMap.get(uc.emailJefeSuperior.toLowerCase());
          if (jefeId && jefeId !== uc.id) {
            jefeSuperiorId = jefeId;
          }
        }

        // Prioridad 2 (Fallback): Jefe del departamento asignado
        if (!jefeSuperiorId && uc.departamentoId) {
          const jefeDepto = deptoJefeMap.get(uc.departamentoId);
          if (jefeDepto && jefeDepto !== uc.id) {
            jefeSuperiorId = jefeDepto;
          }
        }

        // Actualizar el usuario con su jefeSuperiorId
        if (jefeSuperiorId) {
          try {
            await db
              .update(usuarios)
              .set({
                jefeSuperiorId: jefeSuperiorId,
                updatedAt: new Date().toISOString()
              })
              .where(eq(usuarios.id, uc.id));

            if (uc.emailJefeSuperior) {
              jefesAsignados++;
            } else {
              jefesAsignadosPorDepto++;
            }
          } catch (e) {
            console.error(`Error asignando jefe superior a usuario ${uc.id}:`, e);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Importación exitosa. Se crearon ${creados} usuarios de ${rowsParsed.length} filas. Jefes asignados: ${jefesAsignados} por email, ${jefesAsignadosPorDepto} por departamento.`
      });
    }

    return NextResponse.json({ success: false, error: 'Modo inválido' }, { status: 400 });

  } catch (error) {
    console.error('Error procesando importación:', error);
    return NextResponse.json({ success: false, error: 'Error procesando el archivo' }, { status: 500 });
  }
}
