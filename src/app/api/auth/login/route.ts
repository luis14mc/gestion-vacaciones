import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { obtenerRolesYPermisos } from '@/services/rbac.service';
import { loginLimiter, checkRateLimit } from '@/lib/security/rate-limiter';
import type { LoginRequest, SessionUser } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 intentos por minuto por IP
    const limited = checkRateLimit(request, loginLimiter);
    if (limited) return limited;

    const body: LoginRequest = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, email.toLowerCase())
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
    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValida) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Actualizar último acceso
    await db
      .update(usuarios)
      .set({ ultimoAcceso: new Date().toISOString() })
      .where(eq(usuarios.id, usuario.id));

    // 🆕 Obtener roles y permisos del usuario
    const usuarioConRBAC = await obtenerRolesYPermisos(usuario.id);

    // Crear objeto de sesión con RBAC
    const sessionUser: SessionUser = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      departamentoId: usuario.departamentoId || undefined,
      departamentoNombre: undefined, // Se carga por separado si lo necesitas
      cargo: usuario.cargo || undefined,
      // 🆕 RBAC: Roles y permisos del sistema
      roles: usuarioConRBAC?.roles || [],
      permisos: usuarioConRBAC?.permisos || [],
      // ⚠️ Legacy: Calculados desde roles para compatibilidad
      esAdmin: usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'ADMIN') || false,
      esRrhh: usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'RRHH') || false,
      esJefe: usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'JEFE') || false,
    };

    // 🍪 Crear respuesta y guardar sesión en cookie
    const response = NextResponse.json({
      success: true,
      user: sessionUser
    });

    // Configurar cookie de sesión (httpOnly para seguridad)
    response.cookies.set('session', JSON.stringify(sessionUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { success: false, error: 'Error en el servidor' },
      { status: 500 }
    );
  }
}
