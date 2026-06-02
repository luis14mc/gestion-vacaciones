import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { departamentos, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { crearUsuario } from '@/services/usuarios.service';

export const runtime = 'nodejs';

const TRUE_VALUES = new Set(['si', 'yes', 'true', '1', 'x']);

type FilaImportacion = {
  fila: number;
  email: string;
  nombre: string;
  apellido: string;
  numeroEmpleado: string;
  departamento: string;
  departamentoId: number | null;
  cargo: string;
  fechaIngreso: string;
  esJefe: boolean;
  esDirector: boolean;
  emailJefeSuperior: string | null;
  errores: string[];
};

type UsuarioCreado = {
  id: number;
  email: string;
  emailJefeSuperior: string | null;
  departamentoId: number | null;
  esJefe: boolean;
  esDirector: boolean;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseBooleanCell(value: string) {
  return TRUE_VALUES.has(normalizeText(value));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getCellText(row: ExcelJS.Row, columnMap: Record<string, number>, colKey: string) {
  const colNum = columnMap[colKey];
  if (!colNum) return '';
  const cell = row.getCell(colNum);
  return cell ? cell.text.trim() : '';
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
    const mode = formData.get('mode') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se envio ningun archivo' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ success: false, error: 'El archivo Excel esta vacio' }, { status: 400 });
    }

    let headerRow: ExcelJS.Row | null = null;
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

    const resolvedHeaderRow = headerRow as ExcelJS.Row;
    const columnMap: Record<string, number> = {};
    resolvedHeaderRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      const headerText = normalizeText(cell.text);
      const isSuperiorHeader = headerText.includes('superior');
      const isBossHeader = headerText.includes('jefe') || isSuperiorHeader;
      const isEmailHeader = headerText.includes('email') || headerText.includes('correo');

      if (isBossHeader && isEmailHeader) columnMap.emailJefeSuperior = colNumber;
      else if (isEmailHeader) columnMap.email = colNumber;
      else if (headerText.includes('nombre')) columnMap.nombre = colNumber;
      else if (headerText.includes('apellido')) columnMap.apellido = colNumber;
      else if (headerText.includes('empleado') && (headerText.includes('numero') || headerText.includes('num') || headerText.includes('nro'))) columnMap.numeroEmpleado = colNumber;
      else if (headerText.includes('departamento') || headerText.includes('area') || headerText.includes('direccion') || headerText.includes('unidad') || headerText.includes('gerencia')) columnMap.departamento = colNumber;
      else if (headerText.includes('cargo') || headerText.includes('puesto')) columnMap.cargo = colNumber;
      else if (headerText.includes('fecha') && headerText.includes('ingreso')) columnMap.fechaIngreso = colNumber;
      else if (headerText.includes('director')) columnMap.esDirector = colNumber;
      else if (headerText.includes('jefe') && !isEmailHeader && !isSuperiorHeader) columnMap.esJefe = colNumber;
    });

    const requiredCols = ['email', 'nombre', 'apellido', 'departamento'];
    const missingCols = requiredCols.filter((col) => !columnMap[col]);

    if (missingCols.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Faltan columnas requeridas: ${missingCols.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const dbDepartamentos = await db
      .select({ id: departamentos.id, nombre: departamentos.nombre, jefeId: departamentos.jefeId })
      .from(departamentos);
    const deptoMap = new Map(dbDepartamentos.map((d) => [normalizeText(d.nombre), d.id]));
    const deptoJefeMap = new Map(dbDepartamentos.map((d) => [d.id, d.jefeId]));

    const dbUsuarios = await db.select({ id: usuarios.id, email: usuarios.email }).from(usuarios);
    const correosExistentes = new Set(dbUsuarios.map((u) => normalizeEmail(u.email)));
    const emailToIdMap = new Map(dbUsuarios.map((u) => [normalizeEmail(u.email), u.id]));

    const rowsParsed: FilaImportacion[] = [];
    let validacionExitosa = true;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const email = normalizeEmail(getCellText(row, columnMap, 'email'));
      const nombre = getCellText(row, columnMap, 'nombre');
      const apellido = getCellText(row, columnMap, 'apellido');
      const numeroEmpleado = getCellText(row, columnMap, 'numeroEmpleado');
      const deptoNombre = getCellText(row, columnMap, 'departamento');
      const cargo = getCellText(row, columnMap, 'cargo');
      const fechaIngresoStr = getCellText(row, columnMap, 'fechaIngreso');
      const esJefe = parseBooleanCell(getCellText(row, columnMap, 'esJefe'));
      const esDirector = parseBooleanCell(getCellText(row, columnMap, 'esDirector'));
      const emailJefeSuperior = normalizeEmail(getCellText(row, columnMap, 'emailJefeSuperior'));

      if (!email && !nombre && !apellido) return;

      const erroresFila: string[] = [];
      let deptoId: number | null = null;

      if (!email) erroresFila.push('Email requerido');
      else if (!isValidEmail(email)) erroresFila.push('Email invalido');
      else if (correosExistentes.has(email)) erroresFila.push('El correo ya existe en el sistema');

      if (!nombre) erroresFila.push('Nombre requerido');
      if (!apellido) erroresFila.push('Apellido requerido');

      if (!deptoNombre) {
        erroresFila.push('Departamento o direccion requerido');
      } else {
        deptoId = deptoMap.get(normalizeText(deptoNombre)) || null;
        if (!deptoId) {
          erroresFila.push(`Departamento o direccion "${deptoNombre}" no coincide con ninguno registrado`);
        }
      }

      if (emailJefeSuperior && !isValidEmail(emailJefeSuperior)) {
        erroresFila.push('Email Jefe Superior invalido');
      }

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
        emailJefeSuperior: emailJefeSuperior || null,
        errores: erroresFila,
      });
    });

    if (rowsParsed.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron datos validos en el archivo' }, { status: 400 });
    }

    const correosArchivo = new Map<string, FilaImportacion[]>();
    for (const row of rowsParsed) {
      if (!row.email) continue;
      const filas = correosArchivo.get(row.email) || [];
      filas.push(row);
      correosArchivo.set(row.email, filas);
    }

    for (const filasDuplicadas of correosArchivo.values()) {
      if (filasDuplicadas.length <= 1) continue;
      for (const row of filasDuplicadas) {
        row.errores.push('El correo esta duplicado dentro del archivo');
      }
    }

    const correosDisponibles = new Set([...correosExistentes, ...correosArchivo.keys()]);
    for (const row of rowsParsed) {
      if (!row.emailJefeSuperior) continue;
      if (row.emailJefeSuperior === row.email) {
        row.errores.push('El jefe superior no puede ser el mismo usuario');
      } else if (!correosDisponibles.has(row.emailJefeSuperior)) {
        row.errores.push('Email Jefe Superior no existe en el sistema ni en este archivo');
      }
    }

    validacionExitosa = rowsParsed.every((r) => r.errores.length === 0);

    if (mode === 'validate') {
      return NextResponse.json({
        success: true,
        valido: validacionExitosa,
        total: rowsParsed.length,
        conErrores: rowsParsed.filter((r) => r.errores.length > 0).length,
        filas: rowsParsed,
      });
    }

    if (mode === 'import') {
      if (!validacionExitosa) {
        return NextResponse.json(
          {
            success: false,
            error: 'Hay errores de validacion. Corrija el archivo y vuelva a intentarlo.',
            detalles: rowsParsed.filter((r) => r.errores.length > 0),
          },
          { status: 400 }
        );
      }

      let creados = 0;
      const usuariosCreados: UsuarioCreado[] = [];
      const erroresImportacion: Array<{ fila: number; email: string; error: string }> = [];

      for (const userData of rowsParsed) {
        try {
          const nuevoUsuario = await crearUsuario({
            nombre: userData.nombre,
            apellido: userData.apellido,
            email: userData.email,
            password: '1234',
            departamentoId: userData.departamentoId!,
            cargo: userData.cargo,
            fechaIngreso: userData.fechaIngreso,
            esAdmin: false,
            esRrhh: false,
            esDirector: userData.esDirector,
            esJefe: userData.esJefe,
            numeroEmpleado: userData.numeroEmpleado || undefined,
            telefono: undefined,
            direccion: undefined,
          });

          if (nuevoUsuario?.id) {
            creados++;
            usuariosCreados.push({
              id: nuevoUsuario.id,
              email: userData.email,
              emailJefeSuperior: userData.emailJefeSuperior,
              departamentoId: userData.departamentoId,
              esJefe: userData.esJefe,
              esDirector: userData.esDirector,
            });

            emailToIdMap.set(userData.email, nuevoUsuario.id);
          }
        } catch (e) {
          console.error(`Error importando fila ${userData.fila} (${userData.email}):`, e);
          erroresImportacion.push({
            fila: userData.fila,
            email: userData.email,
            error: e instanceof Error ? e.message : 'Error desconocido',
          });
        }
      }

      if (erroresImportacion.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Algunos usuarios no pudieron crearse. Revise los detalles.',
            detalles: erroresImportacion,
          },
          { status: 500 }
        );
      }

      let departamentosActualizados = 0;
      const lideresPorDepto = new Map<number, UsuarioCreado>();

      for (const uc of usuariosCreados) {
        if (!uc.departamentoId || (!uc.esJefe && !uc.esDirector)) continue;

        const liderActual = lideresPorDepto.get(uc.departamentoId);
        if (!liderActual || uc.esDirector) {
          lideresPorDepto.set(uc.departamentoId, uc);
        }
      }

      for (const [departamentoId, lider] of lideresPorDepto) {
        await db
          .update(departamentos)
          .set({
            jefeId: lider.id,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(departamentos.id, departamentoId));

        deptoJefeMap.set(departamentoId, lider.id);
        departamentosActualizados++;
      }

      let jefesAsignados = 0;
      let jefesAsignadosPorDepto = 0;

      for (const uc of usuariosCreados) {
        let jefeSuperiorId: number | null = null;

        if (uc.emailJefeSuperior && isValidEmail(uc.emailJefeSuperior)) {
          const jefeId = emailToIdMap.get(uc.emailJefeSuperior);
          if (jefeId && jefeId !== uc.id) {
            jefeSuperiorId = jefeId;
          }
        }

        if (!jefeSuperiorId && uc.departamentoId) {
          const jefeDepto = deptoJefeMap.get(uc.departamentoId);
          if (jefeDepto && jefeDepto !== uc.id) {
            jefeSuperiorId = jefeDepto;
          }
        }

        if (jefeSuperiorId) {
          await db
            .update(usuarios)
            .set({
              jefeSuperiorId,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(usuarios.id, uc.id));

          if (uc.emailJefeSuperior) {
            jefesAsignados++;
          } else {
            jefesAsignadosPorDepto++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Importacion exitosa. Se crearon ${creados} usuarios de ${rowsParsed.length} filas. Departamentos/direcciones actualizados con jefe: ${departamentosActualizados}. Jefes asignados: ${jefesAsignados} por email, ${jefesAsignadosPorDepto} por departamento.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Modo invalido' }, { status: 400 });
  } catch (error) {
    console.error('Error procesando importacion:', error);
    return NextResponse.json({ success: false, error: 'Error procesando el archivo' }, { status: 500 });
  }
}
