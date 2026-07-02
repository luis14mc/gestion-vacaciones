import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { asignarRol } from '@/services/usuarios.service';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { syncFlagsFromRoles } from '@/services/rbac.service';
import { db } from '@/lib/db';
import { roles, usuariosRoles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withErrorHandler } from '@/lib/api-handler';
import { asignarRolSchema, ROL_CODIGOS } from '@/lib/validation/api-schemas';

/**
 * POST /api/usuarios/roles
 * Asignar rol a un usuario
 * Requiere permiso: usuarios.editar
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  if (!tienePermiso(session, 'usuarios.editar')) {
    return NextResponse.json(
      { error: 'No tienes permiso para asignar roles' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = asignarRolSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }

  const { usuarioId, rolCodigo } = parsed.data;
  void parsed.data.departamentoId;

  const rol = await db.query.roles.findFirst({
    where: eq(roles.codigo, rolCodigo)
  });

  if (!rol) {
    return NextResponse.json(
      { error: `Rol ${rolCodigo} no encontrado` },
      { status: 404 }
    );
  }

  await asignarRol(Number(usuarioId), rol.id);

  await syncFlagsFromRoles(Number(usuarioId));

  const { ipAddress, userAgent } = datosPeticion(request);
  await registrarAuditoria({
    usuarioId: session.id,
    accion: 'actualizar',
    tablaAfectada: 'usuarios',
    registroId: Number(usuarioId),
    detalles: { evento: 'asignar_rol', rol: rolCodigo },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    message: `Rol ${rolCodigo} asignado exitosamente`
  });
});

/**
 * DELETE /api/usuarios/roles
 * Remover rol de un usuario
 * Requiere permiso: usuarios.editar
 * Query params: usuarioId, rolCodigo
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  if (!tienePermiso(session, 'usuarios.editar')) {
    return NextResponse.json(
      { error: 'No tienes permiso para remover roles' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const usuarioId = searchParams.get('usuarioId');
  const rolCodigo = searchParams.get('rolCodigo');

  if (!usuarioId || !rolCodigo) {
    return NextResponse.json(
      { error: 'Faltan parámetros requeridos: usuarioId y rolCodigo' },
      { status: 400 }
    );
  }

  if (!ROL_CODIGOS.includes(rolCodigo as (typeof ROL_CODIGOS)[number])) {
    return NextResponse.json(
      { error: `Rol ${rolCodigo} no permitido` },
      { status: 400 }
    );
  }

  const rol = await db.query.roles.findFirst({
    where: eq(roles.codigo, rolCodigo)
  });

  if (!rol) {
    return NextResponse.json(
      { error: `Rol ${rolCodigo} no encontrado` },
      { status: 404 }
    );
  }

  await db
    .delete(usuariosRoles)
    .where(
      and(
        eq(usuariosRoles.usuarioId, Number(usuarioId)),
        eq(usuariosRoles.rolId, rol.id)
      )
    );

  await syncFlagsFromRoles(Number(usuarioId));

  const { ipAddress, userAgent } = datosPeticion(request);
  await registrarAuditoria({
    usuarioId: session.id,
    accion: 'actualizar',
    tablaAfectada: 'usuarios',
    registroId: Number(usuarioId),
    detalles: { evento: 'remover_rol', rol: rolCodigo },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    message: `Rol ${rolCodigo} removido exitosamente`
  });
});
