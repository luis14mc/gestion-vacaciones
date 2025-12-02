import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import type { NuevoUsuario } from '@/types';

export const runtime = 'nodejs';

// GET: Listar usuarios con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departamentoId = searchParams.get('departamentoId');
    const search = searchParams.get('search');
    const soloActivos = searchParams.get('activo') === 'true';

    const conditions = [isNull(usuarios.deletedAt)];

    if (departamentoId) {
      conditions.push(eq(usuarios.departamentoId, Number.parseInt(departamentoId)));
    }

    if (soloActivos) {
      conditions.push(eq(usuarios.activo, true));
    }

    let results = await db.query.usuarios.findMany({
      where: and(...conditions),
      with: {
        departamento: true
      }
    });

    // Filtro de búsqueda en memoria (más flexible)
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter((u: any) => 
        u.nombre.toLowerCase().includes(searchLower) ||
        u.apellido.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
      );
    }

    // Eliminar password del resultado
    const usuariosSinPassword = results.map((usuario: any) => {
      const { password, ...resto } = usuario;
      return resto;
    });

    return NextResponse.json({
      success: true,
      data: usuariosSinPassword
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
    const body = await request.json();
    
    const {
      nombre,
      apellido,
      email,
      password,
      departamentoId,
      cargo,
      fechaIngreso,
      esJefe,
      esRrhh,
      esAdmin
    } = body;

    // Validaciones
    if (!nombre || !apellido || !email || !password || !departamentoId) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const usuarioExistente = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, email)
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { success: false, error: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Hash del password
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const nuevoUsuario: NuevoUsuario = {
      nombre,
      apellido,
      email,
      password: passwordHash,
      departamentoId,
      cargo: cargo || null,
      fechaIngreso: fechaIngreso || null,
      esJefe: esJefe || false,
      esRrhh: esRrhh || false,
      esAdmin: esAdmin || false,
      activo: true
    };

    const [usuarioCreado] = await db
      .insert(usuarios)
      .values(nuevoUsuario)
      .returning();

    // Obtener usuario con relaciones
    const usuarioCompleto = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, usuarioCreado.id),
      with: {
        departamento: true
      }
    });

    // Eliminar password del resultado
    const { password: _, ...usuarioSinPassword } = usuarioCompleto!;

    return NextResponse.json({
      success: true,
      data: usuarioSinPassword,
      message: 'Usuario creado exitosamente'
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar usuario
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, ...camposActualizar } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    // Si se proporciona password, hashearlo
    if (password) {
      camposActualizar.password = await bcrypt.hash(password, 10);
    }

    // Actualizar usuario
    await db
      .update(usuarios)
      .set(camposActualizar)
      .where(eq(usuarios.id, id));

    // Obtener usuario actualizado
    const usuarioActualizado = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, id),
      with: {
        departamento: true
      }
    });

    if (!usuarioActualizado) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const { password: _, ...usuarioSinPassword } = usuarioActualizado;

    return NextResponse.json({
      success: true,
      data: usuarioSinPassword,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar usuario (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    const usuarioId = Number.parseInt(id);

    // Verificar que el usuario existe
    const usuario = await db.query.usuarios.findFirst({
      where: and(
        eq(usuarios.id, usuarioId),
        isNull(usuarios.deletedAt)
      )
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete: actualizar deletedAt
    await db
      .update(usuarios)
      .set({ deletedAt: new Date() })
      .where(eq(usuarios.id, usuarioId));

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}
