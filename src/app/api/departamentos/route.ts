import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { departamentos, usuarios } from '@/lib/db/schema';
import { isNull, asc, eq, inArray, and, sql } from 'drizzle-orm';
import { getSession, tienePermiso } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Esquemas Zod para la API
const crearDepartamentoSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(20),
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().optional().nullable(),
  jefeId: z.number().int().positive().optional().nullable(),
});

const actualizarDepartamentoSchema = z.object({
  id: z.number().int().positive('ID requerido'),
  nombre: z.string().min(1).max(100).optional(),
  descripcion: z.string().optional().nullable(),
  jefeId: z.number().int().positive().optional().nullable(),
  activo: z.boolean().optional(),
});

async function enriquecerConJefes(deps: any[]) {
  const jefeIds = deps
    .map(d => d.jefeId)
    .filter((id): id is number => id !== null && id !== undefined);

  let jefesMap = new Map<number, { nombre: string; apellido: string }>();
  if (jefeIds.length > 0) {
    const jefes = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre, apellido: usuarios.apellido })
      .from(usuarios)
      .where(inArray(usuarios.id, jefeIds));
    jefesMap = new Map(jefes.map(j => [j.id, { nombre: j.nombre, apellido: j.apellido }]));
  }

  return deps.map(d => ({
    ...d,
    jefe: d.jefeId && jefesMap.has(d.jefeId)
      ? { id: d.jefeId, ...jefesMap.get(d.jefeId)! }
      : null,
  }));
}

// GET: Listar departamentos
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }

  const deps = await db.query.departamentos.findMany({
    where: isNull(departamentos.deletedAt),
    orderBy: [asc(departamentos.nombre)]
  });

  // Contar empleados por departamento
  const counts = await db
    .select({
      departamentoId: usuarios.departamentoId,
      total: sql<number>`count(*)::int`,
    })
    .from(usuarios)
    .where(and(isNull(usuarios.deletedAt), eq(usuarios.activo, true)))
    .groupBy(usuarios.departamentoId);

  const countMap = new Map(counts.map(c => [c.departamentoId, c.total]));

  const depsConJefe = await enriquecerConJefes(deps);
  const depsCompletos = depsConJefe.map(d => ({
    ...d,
    totalEmpleados: countMap.get(d.id) || 0,
  }));

  return NextResponse.json({ success: true, data: depsCompletos });
});

// POST: Crear departamento
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (!session.esAdmin && !session.esRrhh) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
  }

  const body = await request.json();
  const validatedData = crearDepartamentoSchema.parse(body);

  const { codigo, nombre, descripcion, jefeId } = validatedData;

  try {
    const [nuevo] = await db
      .insert(departamentos)
      .values({
        codigo: codigo.toUpperCase(),
        nombre,
        descripcion: descripcion || null,
        jefeId: jefeId || null,
        nivel: 1,
      })
      .returning();

    // Si se asignó un jefe, marcar al usuario como esDirector
    if (jefeId) {
      await db
        .update(usuarios)
        .set({ esDirector: true, updatedAt: new Date().toISOString() })
        .where(eq(usuarios.id, jefeId));
    }

    return NextResponse.json({
      success: true,
      data: nuevo,
      message: 'Departamento creado exitosamente',
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Ya existe un departamento con ese código' },
        { status: 409 }
      );
    }
    throw error; // Let the withErrorHandler catch it
  }
});

// PATCH: Actualizar departamento
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (!session.esAdmin && !session.esRrhh) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
  }

  const body = await request.json();
  const validatedData = actualizarDepartamentoSchema.parse(body);

  const { id, nombre, descripcion, jefeId, activo } = validatedData;

  const deptActual = await db.query.departamentos.findFirst({
    where: eq(departamentos.id, id),
  });

  if (!deptActual) {
    return NextResponse.json({ success: false, error: 'Departamento no encontrado' }, { status: 404 });
  }

  const campos: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (nombre !== undefined) campos.nombre = nombre;
  if (descripcion !== undefined) campos.descripcion = descripcion;
  if (activo !== undefined) campos.activo = activo;

  // Gestión del cambio de jefe
  if (jefeId !== undefined) {
    const nuevoJefeId = jefeId === null ? null : jefeId;
    campos.jefeId = nuevoJefeId;

    if (deptActual.jefeId && deptActual.jefeId !== nuevoJefeId) {
      const otrosDepts = await db.query.departamentos.findFirst({
        where: and(
          eq(departamentos.jefeId, deptActual.jefeId),
          isNull(departamentos.deletedAt),
          sql`${departamentos.id} != ${id}`
        ),
      });
      if (!otrosDepts) {
        await db
          .update(usuarios)
          .set({ esDirector: false, updatedAt: new Date().toISOString() })
          .where(eq(usuarios.id, deptActual.jefeId));
      }
    }

    if (nuevoJefeId) {
      await db
        .update(usuarios)
        .set({
          esDirector: true,
          departamentoId: id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(usuarios.id, nuevoJefeId));
    }
  }

  const [actualizado] = await db
    .update(departamentos)
    .set(campos)
    .where(eq(departamentos.id, id))
    .returning();

  return NextResponse.json({
    success: true,
    data: actualizado,
    message: 'Departamento actualizado exitosamente',
  });
});

// DELETE: Soft delete departamento
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (!session.esAdmin) {
    return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
  }

  const deptId = Number.parseInt(id);

  // Verificar que no tenga empleados activos
  const [empleadosCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(and(
      eq(usuarios.departamentoId, deptId),
      eq(usuarios.activo, true),
      isNull(usuarios.deletedAt)
    ));

  if (empleadosCount.count > 0) {
    return NextResponse.json(
      { success: false, error: `No se puede eliminar: tiene ${empleadosCount.count} empleado(s) activo(s)` },
      { status: 409 }
    );
  }

  await db
    .update(departamentos)
    .set({
      activo: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(departamentos.id, deptId));

  return NextResponse.json({
    success: true,
    message: 'Departamento eliminado exitosamente',
  });
});
