import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { removerRolDeUsuario } from '@/core/application/rbac/rbac.service';
import { asignarRolConValidacion } from '@/core/application/services/usuarios.service';
import { db } from '@/lib/db';
import { roles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/usuarios/roles
 * Asignar rol a un usuario
 * Requiere permiso: usuarios.editar
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Verificar permiso
    if (!tienePermiso(session, 'usuarios.editar')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.editar`);
      return NextResponse.json(
        { error: 'No tienes permiso para asignar roles' },
        { status: 403 }
      );
    }

    // 3. Obtener datos del body
    const { usuarioId, rolCodigo, departamentoId } = await request.json();

    // 4. Validar datos requeridos
    if (!usuarioId || !rolCodigo) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: usuarioId y rolCodigo' },
        { status: 400 }
      );
    }

    // 5. Obtener ID del rol desde el código
    const rol = await db.query.roles.findFirst({
      where: eq(roles.codigo, rolCodigo)
    });

    if (!rol) {
      return NextResponse.json(
        { error: `Rol ${rolCodigo} no encontrado` },
        { status: 404 }
      );
    }

    // 6. Asignar rol usando servicio con validaciones
    console.log(`✅ Usuario ${session.email} asignando rol ${rolCodigo} a usuario ${usuarioId}`);
    const usuarioActualizado = await asignarRolConValidacion({
      usuarioId: Number(usuarioId),
      rolId: rol.id,
      departamentoId: departamentoId ? Number(departamentoId) : undefined,
      asignadoPor: session.id
    });

    // 7. Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: usuarioActualizado,
      message: `Rol ${rolCodigo} asignado exitosamente`
    });

  } catch (error) {
    console.error('Error en POST /api/usuarios/roles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al asignar rol';
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/usuarios/roles
 * Remover rol de un usuario
 * Requiere permiso: usuarios.editar
 * Query params: usuarioId, rolCodigo
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Verificar permiso
    if (!tienePermiso(session, 'usuarios.editar')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.editar`);
      return NextResponse.json(
        { error: 'No tienes permiso para remover roles' },
        { status: 403 }
      );
    }

    // 3. Obtener parámetros de query
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');
    const rolCodigo = searchParams.get('rolCodigo');

    // 4. Validar parámetros requeridos
    if (!usuarioId || !rolCodigo) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: usuarioId y rolCodigo' },
        { status: 400 }
      );
    }

    // 5. Remover rol usando servicio RBAC
    console.log(`✅ Usuario ${session.email} removiendo rol ${rolCodigo} de usuario ${usuarioId}`);
    const resultado = await removerRolDeUsuario(
      Number(usuarioId),
      rolCodigo
    );

    // 6. Verificar resultado
    if (!resultado.success) {
      return NextResponse.json(
        { error: resultado.error || 'Error al remover rol' },
        { status: 400 }
      );
    }

    // 7. Respuesta exitosa
    return NextResponse.json({
      success: true,
      message: `Rol ${rolCodigo} removido exitosamente`
    });

  } catch (error) {
    console.error('Error en DELETE /api/usuarios/roles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
