import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { asignarRolAUsuario } from '@/core/application/rbac/rbac.service';

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

    // 5. Asignar rol usando servicio RBAC
    console.log(`✅ Usuario ${session.email} asignando rol ${rolCodigo} a usuario ${usuarioId}`);
    const resultado = await asignarRolAUsuario(
      Number(usuarioId),
      rolCodigo,
      departamentoId ? Number(departamentoId) : undefined
    );

    // 6. Verificar resultado
    if (!resultado.success) {
      return NextResponse.json(
        { error: resultado.message || 'Error al asignar rol' },
        { status: 400 }
      );
    }

    // 7. Respuesta exitosa
    return NextResponse.json({
      success: true,
      message: `Rol ${rolCodigo} asignado exitosamente`,
      data: resultado.data
    });

  } catch (error) {
    console.error('Error en POST /api/usuarios/roles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
