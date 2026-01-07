import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, balancesAusencias, solicitudes } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import type { NuevoUsuario } from '@/types';
import { auth } from '@/auth';

export const runtime = 'nodejs';

// GET: Listar usuarios con filtros
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    const { searchParams } = new URL(request.url);
    const departamentoId = searchParams.get('departamentoId');
    const search = searchParams.get('search');
    const soloActivos = searchParams.get('activo') === 'true';

    const conditions = [];

    // Si es jefe (y no es admin ni RRHH), solo mostrar su departamento
    if (session?.user?.esJefe && !session?.user?.esAdmin && !session?.user?.esRrhh) {
      if (session.user.departamentoId) {
        conditions.push(eq(usuarios.departamentoId, session.user.departamentoId));
      }
    }
    // Si se especifica departamento en query params
    else if (departamentoId) {
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

    // Obtener balance y solicitudes pendientes para cada usuario
    const usuariosConBalance = await Promise.all(results.map(async (usuario: any) => {
      const { password, ...resto } = usuario;
      
      // Obtener balance de días
      const balance = await db.query.balancesAusencias.findFirst({
        where: and(
          eq(balancesAusencias.usuarioId, usuario.id),
          eq(balancesAusencias.estado, 'activo')
        )
      });

      // Calcular días disponibles (asignado - utilizado - pendiente)
      const diasAsignados = balance ? Number(balance.cantidadAsignada) : 0;
      const diasUsados = balance ? Number(balance.cantidadUtilizada) : 0;
      const diasPendientes = balance ? Number(balance.cantidadPendiente) : 0;
      const diasDisponibles = diasAsignados - diasUsados - diasPendientes;

      // Contar solicitudes pendientes
      const solicitudesPendientes = await db
        .select({ count: sql<number>`count(*)` })
        .from(solicitudes)
        .where(
          and(
            eq(solicitudes.usuarioId, usuario.id),
            eq(solicitudes.estado, 'pendiente')
          )
        );

      // Verificar si está en vacaciones actualmente
      const hoy = new Date();
      const enVacaciones = await db.query.solicitudes.findFirst({
        where: and(
          eq(solicitudes.usuarioId, usuario.id),
          eq(solicitudes.estado, 'en_uso'),
          sql`${solicitudes.fechaInicio} <= ${hoy}`,
          sql`${solicitudes.fechaFin} >= ${hoy}`
        )
      });

      return {
        ...resto,
        estado: usuario.activo ? 'activo' : 'inactivo',
        departamento: usuario.departamento?.nombre || null,
        diasAsignados: diasAsignados,
        diasDisponibles: diasDisponibles,
        diasUsados: diasUsados,
        solicitudesPendientes: Number(solicitudesPendientes[0]?.count || 0),
        enVacaciones: !!enVacaciones
      };
    }));

    return NextResponse.json({
      success: true,
      usuarios: usuariosConBalance
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
