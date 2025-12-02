import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import type { LoginRequest, SessionUser } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario por email con su departamento
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, email.toLowerCase()),
      with: {
        departamento: true
      }
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return NextResponse.json(
        { success: false, error: 'Usuario inactivo' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Actualizar último acceso
    await db
      .update(usuarios)
      .set({ ultimoAcceso: new Date() })
      .where(eq(usuarios.id, usuario.id));

    // Crear objeto de sesión
    const sessionUser: SessionUser = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      departamentoId: usuario.departamentoId,
      departamentoNombre: usuario.departamento?.nombre,
      cargo: usuario.cargo || undefined,
      esJefe: usuario.esJefe,
      esRrhh: usuario.esRrhh,
      esAdmin: usuario.esAdmin
    };

    return NextResponse.json({
      success: true,
      user: sessionUser
    });

  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { success: false, error: 'Error en el servidor' },
      { status: 500 }
    );
  }
}
