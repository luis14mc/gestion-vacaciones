import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { departamentos, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { crearUsuario } from '@/services/usuarios.service';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { generarPasswordTemporal } from '@/lib/security/password';
import { obtenerConfigs, asNumber } from '@/lib/config/service';
import { normalizarFechaNacimiento } from '@/lib/domain/fecha-nacimiento';
import {
  validarCamposImportacionUsuario,
  validarJefeSuperiorImportacion,
  type JefeSuperiorReferencia,
} from '@/lib/schemas/usuario-import.schema';

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
  telefono: string;
  direccion: string;
  fechaIngreso: string | null;
  fechaNacimiento: string | null;
  esJefe: boolean;
  esDirector: boolean;
  esAdmin: boolean;
  esRrhh: boolean;
  activo: boolean;
  emailJefeSuperior: string | null;
  jefeSuperiorId: number | null;
  errores: string[];
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

function parseBooleanCell(value: string, defaultValue = false) {
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  return TRUE_VALUES.has(normalizeText(trimmed));
}

function getCellText(row: ExcelJS.Row, columnMap: Record<string, number>, colKey: string) {
  const colNum = columnMap[colKey];
  if (!colNum) return '';
  const cell = row.getCell(colNum);
  return cell ? cell.text.trim() : '';
}

function getCellValue(row: ExcelJS.Row, columnMap: Record<string, number>, colKey: string) {
  const colNum = columnMap[colKey];
  return colNum ? row.getCell(colNum).value : null;
}

function parseFechaIngreso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function resolverJefeSuperior(
  email: string,
  dbJefes: Map<string, JefeSuperiorReferencia & { id: number }>,
  filasArchivo: Map<string, FilaImportacion>
): (JefeSuperiorReferencia & { id?: number }) | undefined {
  const dbJefe = dbJefes.get(email);
  if (dbJefe) return dbJefe;

  const fila = filasArchivo.get(email);
  if (!fila) return undefined;

  return {
    email: fila.email,
    departamentoId: fila.departamentoId,
    esJefe: fila.esJefe,
    esDirector: fila.esDirector,
  };
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'usuarios.crear')) {
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
    else if (
      headerText.includes('empleado') &&
      (headerText.includes('numero') || headerText.includes('num') || headerText.includes('nro'))
    ) {
      columnMap.numeroEmpleado = colNumber;
    } else if (
      headerText.includes('departamento') ||
      headerText.includes('area') ||
      headerText.includes('unidad') ||
      headerText.includes('gerencia')
    ) {
      columnMap.departamento = colNumber;
    } else if (
      (headerText.includes('direccion') &&
        (headerText.includes('domicilio') ||
          headerText.includes('usuario') ||
          headerText.includes('personal'))) ||
      headerText === 'direcciondomicilio'
    ) {
      columnMap.direccion = colNumber;
    } else if (headerText.includes('telefono') || headerText.includes('tel')) columnMap.telefono = colNumber;
    else if (headerText.includes('cargo') || headerText.includes('puesto')) columnMap.cargo = colNumber;
    else if (headerText.includes('fecha') && headerText.includes('ingreso')) columnMap.fechaIngreso = colNumber;
    else if (
      (headerText.includes('fecha') && headerText.includes('nacimiento')) ||
      headerText === 'fechanacimiento'
    ) {
      columnMap.fechaNacimiento = colNumber;
    } else if (headerText.includes('director')) columnMap.esDirector = colNumber;
    else if (headerText.includes('admin') && !headerText.includes('rrhh')) columnMap.esAdmin = colNumber;
    else if (headerText.includes('rrhh')) columnMap.esRrhh = colNumber;
    else if (headerText.includes('activo')) columnMap.activo = colNumber;
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
    .select({ id: departamentos.id, nombre: departamentos.nombre })
    .from(departamentos);
  const deptoMap = new Map(dbDepartamentos.map((d) => [normalizeText(d.nombre), d.id]));

  const dbUsuarios = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      departamentoId: usuarios.departamentoId,
      esJefe: usuarios.esJefe,
      esDirector: usuarios.esDirector,
    })
    .from(usuarios);

  const correosExistentes = new Set(dbUsuarios.map((u) => normalizeEmail(u.email)));
  const dbJefesMap = new Map(
    dbUsuarios.map((u) => [
      normalizeEmail(u.email),
      {
        id: u.id,
        email: normalizeEmail(u.email),
        departamentoId: u.departamentoId,
        esJefe: u.esJefe ?? false,
        esDirector: u.esDirector ?? false,
      },
    ])
  );

  const rowsParsed: FilaImportacion[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const email = normalizeEmail(getCellText(row, columnMap, 'email'));
    const nombre = getCellText(row, columnMap, 'nombre');
    const apellido = getCellText(row, columnMap, 'apellido');
    const numeroEmpleado = getCellText(row, columnMap, 'numeroEmpleado');
    const deptoNombre = getCellText(row, columnMap, 'departamento');
    const cargo = getCellText(row, columnMap, 'cargo');
    const telefono = getCellText(row, columnMap, 'telefono');
    const direccion = getCellText(row, columnMap, 'direccion');
    const fechaIngresoStr = getCellText(row, columnMap, 'fechaIngreso');
    const fechaNacimientoResult = normalizarFechaNacimiento(
      getCellValue(row, columnMap, 'fechaNacimiento')
    );
    const esJefe = parseBooleanCell(getCellText(row, columnMap, 'esJefe'));
    const esDirector = parseBooleanCell(getCellText(row, columnMap, 'esDirector'));
    const esAdmin = parseBooleanCell(getCellText(row, columnMap, 'esAdmin'));
    const esRrhh = parseBooleanCell(getCellText(row, columnMap, 'esRrhh'));
    const activo = parseBooleanCell(getCellText(row, columnMap, 'activo'), true);
    const emailJefeSuperior = normalizeEmail(getCellText(row, columnMap, 'emailJefeSuperior'));

    if (!email && !nombre && !apellido) return;

    const erroresFila: string[] = [];
    let deptoId: number | null = null;

    erroresFila.push(
      ...validarCamposImportacionUsuario({
        email,
        nombre,
        apellido,
        telefono: telefono || undefined,
        direccion: direccion || undefined,
        cargo: cargo || undefined,
        numeroEmpleado: numeroEmpleado || undefined,
      })
    );

    if (email && correosExistentes.has(email)) {
      erroresFila.push('El correo ya existe en el sistema');
    }

    if (!deptoNombre) {
      erroresFila.push('Departamento requerido');
    } else {
      deptoId = deptoMap.get(normalizeText(deptoNombre)) || null;
      if (!deptoId) {
        erroresFila.push(`Departamento "${deptoNombre}" no coincide con ninguno registrado`);
      }
    }

    if (fechaNacimientoResult.error && columnMap.fechaNacimiento) {
      erroresFila.push(fechaNacimientoResult.error);
    }

    let fechaIngresoParsed: string | null = null;
    if (fechaIngresoStr) {
      fechaIngresoParsed = parseFechaIngreso(fechaIngresoStr);
      if (!fechaIngresoParsed) {
        erroresFila.push('Fecha de ingreso invalida');
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
      telefono,
      direccion,
      fechaIngreso: fechaIngresoParsed,
      fechaNacimiento: fechaNacimientoResult.fecha,
      esJefe,
      esDirector,
      esAdmin: session.esAdmin ? esAdmin : false,
      esRrhh: session.esAdmin ? esRrhh : false,
      activo,
      emailJefeSuperior: emailJefeSuperior || null,
      jefeSuperiorId: null,
      errores: erroresFila,
    });
  });

  if (rowsParsed.length === 0) {
    return NextResponse.json({ success: false, error: 'No se encontraron datos validos en el archivo' }, { status: 400 });
  }

  const correosArchivo = new Map<string, FilaImportacion[]>();
  const filasPorEmail = new Map<string, FilaImportacion>();
  for (const row of rowsParsed) {
    if (!row.email) continue;
    filasPorEmail.set(row.email, row);
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

  for (const row of rowsParsed) {
    if (!row.emailJefeSuperior) continue;

    if (row.emailJefeSuperior === row.email) {
      row.errores.push('El jefe superior no puede ser el mismo usuario');
      continue;
    }

    const jefe = resolverJefeSuperior(row.emailJefeSuperior, dbJefesMap, filasPorEmail);
    const errorJefe = validarJefeSuperiorImportacion(jefe, row.departamentoId);
    if (errorJefe) {
      row.errores.push(errorJefe);
    } else if (jefe && 'id' in jefe && jefe.id) {
      row.jefeSuperiorId = jefe.id;
    }
  }

  const validacionExitosa = rowsParsed.every((r) => r.errores.length === 0);

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

    const minLen = asNumber(
      (await obtenerConfigs(['seguridad.password_min_length']))['seguridad.password_min_length'],
      8
    );

    const emailToIdMap = new Map(dbUsuarios.map((u) => [normalizeEmail(u.email), u.id]));
    let creados = 0;
    const credenciales: Array<{ email: string; nombre: string; password: string }> = [];
    const erroresImportacion: Array<{ fila: number; email: string; error: string }> = [];

    for (const userData of rowsParsed) {
      try {
        const passwordTemporal = generarPasswordTemporal(minLen);

        const nuevoUsuario = await crearUsuario({
          nombre: userData.nombre,
          apellido: userData.apellido,
          email: userData.email,
          password: passwordTemporal,
          departamentoId: userData.departamentoId!,
          cargo: userData.cargo || undefined,
          fechaIngreso: userData.fechaIngreso ?? new Date().toISOString(),
          fechaNacimiento: userData.fechaNacimiento || undefined,
          esAdmin: userData.esAdmin,
          esRrhh: userData.esRrhh,
          esDirector: userData.esDirector,
          esJefe: userData.esJefe,
          activo: userData.activo,
          numeroEmpleado: userData.numeroEmpleado || undefined,
          telefono: userData.telefono || undefined,
          direccion: userData.direccion || undefined,
          jefeSuperiorId: userData.jefeSuperiorId ?? undefined,
          debeCambiarPassword: true,
        });

        if (nuevoUsuario?.id) {
          creados++;
          credenciales.push({
            email: userData.email,
            nombre: `${userData.nombre} ${userData.apellido}`,
            password: passwordTemporal,
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

    for (const userData of rowsParsed) {
      if (!userData.emailJefeSuperior) continue;
      const userId = emailToIdMap.get(userData.email);
      const jefeId = emailToIdMap.get(userData.emailJefeSuperior);
      if (!userId || !jefeId || userId === jefeId) continue;

      await db
        .update(usuarios)
        .set({
          jefeSuperiorId: jefeId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(usuarios.id, userId));
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

    const { ipAddress, userAgent } = datosPeticion(request);
    await registrarAuditoria({
      usuarioId: session.id,
      accion: 'crear',
      tablaAfectada: 'usuarios',
      detalles: {
        evento: 'importacion_masiva',
        creados,
        totalFilas: rowsParsed.length,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Importacion exitosa. Se crearon ${creados} usuarios de ${rowsParsed.length} filas.`,
      credenciales,
    });
  }

  return NextResponse.json({ success: false, error: 'Modo invalido' }, { status: 400 });
});
