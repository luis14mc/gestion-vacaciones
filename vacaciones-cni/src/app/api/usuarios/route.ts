import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, balancesAusencias, solicitudes, usuariosRoles } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import type { NuevoUsuario } from '@/types';
import { auth } from '@/auth';
import { getSession, tienePermiso } from '@/lib/auth';
import { asignarRolAUsuario } from '@/core/application/rbac/rbac.service';
import { 
  obtenerUsuarios, 
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario
} from '@/core/application/services/usuarios.service';

export const runtime = 'nodejs';

// GET: Listar usuarios con filtros
export async function GET(request: NextRequest) {
  try {
    // 🔐 RBAC: Verificar autenticación y permiso usuarios.ver
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.ver')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.ver`);
      return NextResponse.json(
        { success: false, error: 'Sin permiso para ver usuarios' },
        { status: 403 }
      );
    }

    console.log(`✅ Usuario ${session.email} consultando usuarios`);
    
    const { searchParams } = new URL(request.url);
    const departamentoId = searchParams.get('departamentoId');
    const search = searchParams.get('search');
    const soloActivos = searchParams.get('activo') === 'true';

    // 🔒 SCOPE: Si es JEFE (y no ADMIN/RRHH), filtrar solo su departamento
    let filtroDepto = departamentoId ? Number.parseInt(departamentoId) : undefined;
    
    if (session.esJefe && !session.esAdmin && !session.esRrhh) {
      if (session.departamentoId) {
        console.log(`🔍 JEFE ${session.email} - Filtrando por departamento ${session.departamentoId}`);
        filtroDepto = session.departamentoId;
      }
    }

    // Usar servicio para obtener usuarios
    const usuariosData = await obtenerUsuarios({
      departamentoId: filtroDepto,
      search: search || undefined,
      soloActivos
    });

    return NextResponse.json({
      success: true,
      usuarios: usuariosData
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    // 🔐 RBAC: Verificar autenticación y permiso usuarios.crear
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.crear')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.crear`);
      return NextResponse.json(
        { success: false, error: 'Sin permiso para crear usuarios' },
        { status: 403 }
      );
    }

    console.log(`✅ Usuario ${session.email} creando nuevo usuario`);

    const body = await request.json();
    
    const {
      nombre,
      apellido,
      email,
      password,
      departamentoId,
      cargo,
      fechaIngreso,
      cedula
    } = body;

    // Validaciones
    if (!nombre || !apellido || !email || !password || !departamentoId) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Usar servicio para crear usuario
    const usuarioCreado = await crearUsuario({
      nombre,
      apellido,
      email,
      password,
      departamentoId,
      cargo,
      cedula,
      fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date()
    });

    return NextResponse.json({
      success: true,
      data: usuarioCreado,
      message: 'Usuario creado exitosamente'
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

// PATCH: Actualizar usuario
export async function PATCH(request: NextRequest) {
  try {
    // 🔐 RBAC: Verificar autenticación y permiso usuarios.editar
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.editar')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.editar`);
      return NextResponse.json(
        { success: false, error: 'Sin permiso para editar usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...camposActualizar } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    console.log(`✅ Usuario ${session.email} editando usuario ID ${id}`);

    // Usar servicio para actualizar usuario
    const usuarioActualizado = await actualizarUsuario(
      id,
      camposActualizar,
      session.id
    );

    return NextResponse.json({
      success: true,
      data: usuarioActualizado,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al actualizar usuario';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

// DELETE: Eliminar usuario (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    // 🔐 RBAC: Verificar autenticación y permiso usuarios.eliminar
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.eliminar')) {
      console.log(`❌ Usuario ${session.email} sin permiso usuarios.eliminar`);
      return NextResponse.json(
        { success: false, error: 'Sin permiso para eliminar usuarios' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    const usuarioId = Number.parseInt(id);

    console.log(`✅ Usuario ${session.email} eliminando usuario ID ${usuarioId}`);

    // Usar servicio para desactivar usuario
    const usuarioDesactivado = await desactivarUsuario(
      usuarioId,
      session.id,
      'Desactivado desde interfaz de administración'
    );

    return NextResponse.json({
      success: true,
      data: usuarioDesactivado,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al eliminar usuario';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
