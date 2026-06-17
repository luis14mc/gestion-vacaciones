import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { usuarios, departamentos, usuariosRoles, roles, balances, anosLaborales } from '@/lib/db/schema';
import { eq, and, like, or, isNull, inArray, asc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { crearUsuario } from '@/services/usuarios.service';
import { syncUserRoles } from '@/services/rbac.service';
import { withErrorHandler } from '@/lib/api-handler';
import { usuarioApiSchema } from '@/lib/schemas/usuario.schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: Listar usuarios con filtros
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'usuarios.ver') && !session.esRrhh && !session.esJefe) {
    return NextResponse.json({ success: false, error: 'Sin permiso para ver usuarios' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const departamentoId = searchParams.get('departamentoId');
  const search = searchParams.get('search');
  const soloActivos = searchParams.get('activo') === 'true';

  let filtroDepto = departamentoId ? Number.parseInt(departamentoId) : undefined;
  
  if (session.esJefe && !session.esAdmin && !session.esRrhh) {
    if (session.departamentoId) {
      filtroDepto = session.departamentoId;
    }
  }

  const conditions: any[] = [isNull(usuarios.deletedAt)];
  
  if (soloActivos) {
    conditions.push(eq(usuarios.activo, true));
  }
  
  if (filtroDepto) {
    conditions.push(eq(usuarios.departamentoId, filtroDepto));
  }
  
  if (search) {
    conditions.push(
      or(
        like(usuarios.nombre, `%${search}%`),
        like(usuarios.apellido, `%${search}%`),
        like(usuarios.email, `%${search}%`)
      )
    );
  }

  const usuariosDataBase = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      esAdmin: usuarios.esAdmin,
      esRrhh: usuarios.esRrhh,
      esDirector: usuarios.esDirector,
      esJefe: usuarios.esJefe,
      activo: usuarios.activo,
      departamentoId: usuarios.departamentoId,
      cargo: usuarios.cargo,
      numeroEmpleado: usuarios.numeroEmpleado,
      telefono: usuarios.telefono,
      direccion: usuarios.direccion,
      fechaIngreso: usuarios.fechaIngreso,
      jefeSuperiorId: usuarios.jefeSuperiorId,
      createdAt: usuarios.createdAt,
      updatedAt: usuarios.updatedAt
    })
    .from(usuarios)
    .where(and(...conditions))
    .orderBy(asc(usuarios.apellido));

  if (usuariosDataBase.length === 0) {
    return NextResponse.json({ success: true, usuarios: [] });
  }

  const userIds = usuariosDataBase.map((u) => u.id);
  const deptIds = Array.from(
    new Set(
      usuariosDataBase
        .map((u) => u.departamentoId)
        .filter((id): id is number => id !== null && id !== undefined)
    )
  );

  let departamentosMap = new Map<number, { id: number; nombre: string; codigo: string }>();
  if (deptIds.length > 0) {
    const departamentosData = await db
      .select({ id: departamentos.id, nombre: departamentos.nombre, codigo: departamentos.codigo })
      .from(departamentos)
      .where(inArray(departamentos.id, deptIds));
    departamentosMap = new Map(departamentosData.map((d) => [d.id, d]));
  }

  let rolesByUser = new Map<number, Array<{ rol: { id: number; codigo: string; nombre: string } }>>();
  const rolesData = await db
    .select({
      usuarioId: usuariosRoles.usuarioId,
      rolId: roles.id,
      rolCodigo: roles.codigo,
      rolNombre: roles.nombre
    })
    .from(usuariosRoles)
    .innerJoin(roles, eq(usuariosRoles.rolId, roles.id))
    .where(and(
      inArray(usuariosRoles.usuarioId, userIds),
      eq(usuariosRoles.activo, true)
    ));

  for (const row of rolesData) {
    const list = rolesByUser.get(row.usuarioId) || [];
    list.push({ rol: { id: row.rolId, codigo: row.rolCodigo, nombre: row.rolNombre } });
    rolesByUser.set(row.usuarioId, list);
  }

  // Balances
  let balancesMap = new Map<number, number>();
  const balancesData = await db
    .select({
      usuarioId: balances.usuarioId,
      disponible: balances.cantidadDisponible,
    })
    .from(balances)
    .innerJoin(anosLaborales, eq(balances.anoLaboralId, anosLaborales.id))
    .where(and(
      inArray(balances.usuarioId, userIds),
      eq(anosLaborales.activo, true),
      eq(balances.tipoAusencia, 'vacaciones')
    ));

  for (const row of balancesData) {
    balancesMap.set(row.usuarioId, parseFloat(row.disponible ?? '0'));
  }

  const usuariosData = usuariosDataBase.map((u) => ({
    ...u,
    departamento: u.departamentoId ? departamentosMap.get(u.departamentoId) || null : null,
    usuariosRoles: rolesByUser.get(u.id) || [],
    diasDisponibles: balancesMap.get(u.id) ?? null,
  }));

  return NextResponse.json({
    success: true,
    usuarios: usuariosData
  });
});

// POST: Crear nuevo usuario
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'usuarios.crear')) {
    return NextResponse.json({ success: false, error: 'Sin permiso para crear usuarios' }, { status: 403 });
  }

  const body = await request.json();
  
  // Validación OWASP A03 estricta vía Zod
  const validatedData = usuarioApiSchema.parse(body);

  if (!validatedData.password) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error de validación de datos',
        detalles: [
          {
            campo: 'password',
            mensaje: 'La contraseña es requerida para nuevos usuarios',
          },
        ],
      },
      { status: 400 }
    );
  }

  const usuarioExistente = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, validatedData.email.toLowerCase()),
  });

  if (usuarioExistente) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error de validación de datos',
        detalles: [
          {
            campo: 'email',
            mensaje: 'El correo ya está registrado',
          },
        ],
      },
      { status: 400 }
    );
  }

  const usuarioCreado = await crearUsuario({
    nombre: validatedData.nombre,
    apellido: validatedData.apellido,
    email: validatedData.email,
    password: validatedData.password,
    departamentoId: Number(validatedData.departamentoId),
    cargo: validatedData.cargo || undefined,
    fechaIngreso: validatedData.fechaIngreso ? new Date(validatedData.fechaIngreso).toISOString() : new Date().toISOString(),
    esAdmin: validatedData.esAdmin,
    esRrhh: validatedData.esRrhh,
    esDirector: validatedData.esDirector,
    esJefe: validatedData.esJefe,
    numeroEmpleado: validatedData.numeroEmpleado || undefined,
    telefono: validatedData.telefono || undefined,
    direccion: validatedData.direccion || undefined
  });

  if (usuarioCreado?.id) {
    if (validatedData.jefeSuperiorId) {
      await db
        .update(usuarios)
        .set({ jefeSuperiorId: Number(validatedData.jefeSuperiorId) })
        .where(eq(usuarios.id, usuarioCreado.id));
    }

    if (validatedData.esDirector && validatedData.departamentoId) {
      await db
        .update(departamentos)
        .set({ jefeId: usuarioCreado.id, updatedAt: new Date().toISOString() })
        .where(eq(departamentos.id, Number(validatedData.departamentoId)));
    }
  }

  return NextResponse.json({
    success: true,
    data: usuarioCreado,
    message: 'Usuario creado exitosamente'
  });
});

// PATCH: Actualizar usuario
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'usuarios.editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso para editar usuarios' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...dataToUpdate } = body;
  const shouldUpdateJefeSuperior = Object.prototype.hasOwnProperty.call(dataToUpdate, 'jefeSuperiorId');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID de usuario requerido' }, { status: 400 });
  }

  // Usamos el partial del esquema para permitir actualizaciones parciales
  const validatedData = usuarioApiSchema.partial().parse(dataToUpdate);

  const camposPermitidos: Record<string, any> = {};
  if (validatedData.nombre !== undefined) camposPermitidos.nombre = validatedData.nombre;
  if (validatedData.apellido !== undefined) camposPermitidos.apellido = validatedData.apellido;
  if (validatedData.email !== undefined) camposPermitidos.email = validatedData.email.toLowerCase();
  if (validatedData.cargo !== undefined) camposPermitidos.cargo = validatedData.cargo;
  if (validatedData.departamentoId !== undefined) camposPermitidos.departamentoId = Number(validatedData.departamentoId);
  if (validatedData.activo !== undefined) camposPermitidos.activo = validatedData.activo;
  if (validatedData.fechaIngreso !== undefined) camposPermitidos.fechaIngreso = validatedData.fechaIngreso;
  if (shouldUpdateJefeSuperior) {
    camposPermitidos.jefeSuperiorId = validatedData.jefeSuperiorId
      ? Number(validatedData.jefeSuperiorId)
      : null;
  }
  if (validatedData.numeroEmpleado !== undefined) camposPermitidos.numeroEmpleado = validatedData.numeroEmpleado;
  if (validatedData.telefono !== undefined) camposPermitidos.telefono = validatedData.telefono;
  if (validatedData.direccion !== undefined) camposPermitidos.direccion = validatedData.direccion;
  
  if (validatedData.password && validatedData.password.trim().length > 0) {
    camposPermitidos.passwordHash = await bcrypt.hash(validatedData.password, 10);
  }

  if (session.esAdmin) {
    if (validatedData.esAdmin !== undefined) camposPermitidos.esAdmin = validatedData.esAdmin;
    if (validatedData.esRrhh !== undefined) camposPermitidos.esRrhh = validatedData.esRrhh;
    if (validatedData.esDirector !== undefined) camposPermitidos.esDirector = validatedData.esDirector;
    if (validatedData.esJefe !== undefined) camposPermitidos.esJefe = validatedData.esJefe;
  }

  if (Object.keys(camposPermitidos).length === 0) {
    return NextResponse.json({ success: false, error: 'No se proporcionaron campos válidos para actualizar' }, { status: 400 });
  }

  const [usuarioActualizado] = await db
    .update(usuarios)
    .set({
      ...camposPermitidos,
      updatedAt: new Date().toISOString()
    })
    .where(eq(usuarios.id, id))
    .returning();

  if (usuarioActualizado) {
    const nuevoEsDirector = camposPermitidos.esDirector ?? usuarioActualizado.esDirector;
    const nuevoDeptId = camposPermitidos.departamentoId ?? usuarioActualizado.departamentoId;

    if (nuevoEsDirector && nuevoDeptId) {
      await db
        .update(departamentos)
        .set({ jefeId: usuarioActualizado.id, updatedAt: new Date().toISOString() })
        .where(eq(departamentos.id, nuevoDeptId));
    }

    if (camposPermitidos.esDirector === false && usuarioActualizado.departamentoId) {
      const dept = await db.query.departamentos.findFirst({
        where: eq(departamentos.id, usuarioActualizado.departamentoId),
      });
      if (dept && dept.jefeId === usuarioActualizado.id) {
        await db
          .update(departamentos)
          .set({ jefeId: null, updatedAt: new Date().toISOString() })
          .where(eq(departamentos.id, usuarioActualizado.departamentoId));
      }
    }

    // Mantener usuarios_roles sincronizado con los flags (solo admin pudo cambiarlos).
    // Fuente única de verdad: evita que un flag activo quede sin su rol RBAC.
    if (session.esAdmin) {
      await syncUserRoles(usuarioActualizado.id, {
        esAdmin: usuarioActualizado.esAdmin,
        esRrhh: usuarioActualizado.esRrhh,
        esDirector: usuarioActualizado.esDirector,
        esJefe: usuarioActualizado.esJefe,
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: usuarioActualizado,
    message: 'Usuario actualizado exitosamente'
  });
});

// DELETE: Eliminar usuario (soft delete)
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'usuarios.eliminar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso para eliminar usuarios' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID de usuario requerido' }, { status: 400 });
  }

  const usuarioId = Number.parseInt(id);

  const [usuarioDesactivado] = await db
    .update(usuarios)
    .set({
      activo: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(usuarios.id, usuarioId))
    .returning();

  return NextResponse.json({
    success: true,
    data: usuarioDesactivado,
    message: 'Usuario eliminado exitosamente'
  });
});
