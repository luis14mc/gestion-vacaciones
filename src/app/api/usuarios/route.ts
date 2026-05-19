import { NextRequest, NextResponse } from 'next/server';
import { getSession, tienePermiso } from '@/lib/auth';
import { db } from '@/lib/db';
import { usuarios, departamentos, usuariosRoles, roles, balances, anosLaborales } from '@/lib/db/schema';
import { eq, and, like, or, isNull, inArray, asc, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { 
  crearUsuario,
  obtenerUsuarioPorId
} from '@/services/usuarios.service';

export const runtime = 'nodejs';

// GET: Listar usuarios con filtros
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.ver') && !session.esRrhh && !session.esJefe) {
      return NextResponse.json(
        { success: false, error: 'Sin permiso para ver usuarios' },
        { status: 403 }
      );
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
      try {
        const departamentosData = await db
          .select({ id: departamentos.id, nombre: departamentos.nombre, codigo: departamentos.codigo })
          .from(departamentos)
          .where(inArray(departamentos.id, deptIds));
        departamentosMap = new Map(departamentosData.map((d) => [d.id, d]));
      } catch (err) {
        console.error('⚠️ Error cargando departamentos:', err);
      }
    }

    let rolesByUser = new Map<number, Array<{ rol: { id: number; codigo: string; nombre: string } }>>();
    try {
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
    } catch (err) {
      console.error('⚠️ Error cargando roles:', err);
    }

    // Balances: días disponibles del año laboral activo (tipo vacaciones)
    let balancesMap = new Map<number, number>();
    try {
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
    } catch (err) {
      console.error('⚠️ Error cargando balances:', err);
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

  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.crear')) {
      return NextResponse.json(
        { success: false, error: 'Sin permiso para crear usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const {
      nombre,
      apellido,
      email,
      password,
      departamentoId,
      cargo,
      fechaIngreso,
      esAdmin,
      esRrhh,
      esDirector,
      esJefe,
      jefeSuperiorId,
      numeroEmpleado,
      telefono,
      direccion,
    } = body;

    if (!nombre || !apellido || !email || !password || !departamentoId) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const usuarioCreado = await crearUsuario({
      nombre,
      apellido,
      email,
      password,
      departamentoId,
      cargo,
      fechaIngreso: fechaIngreso ? new Date(fechaIngreso).toISOString() : new Date().toISOString(),
      esAdmin,
      esRrhh,
      esDirector,
      esJefe,
      numeroEmpleado,
      telefono,
      direccion
    });

    if (usuarioCreado?.id) {
      // Asignar jefe superior
      if (jefeSuperiorId) {
        await db
          .update(usuarios)
          .set({ jefeSuperiorId })
          .where(eq(usuarios.id, usuarioCreado.id));
      }

      // Si es Director, asignarlo como jefe del departamento
      if (esDirector && departamentoId) {
        await db
          .update(departamentos)
          .set({ jefeId: usuarioCreado.id, updatedAt: new Date().toISOString() })
          .where(eq(departamentos.id, departamentoId));
      }
    }

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
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.editar')) {
      return NextResponse.json(
        { success: false, error: 'Sin permiso para editar usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    const camposPermitidos: Record<string, any> = {};
    if (body.nombre !== undefined) camposPermitidos.nombre = body.nombre;
    if (body.apellido !== undefined) camposPermitidos.apellido = body.apellido;
    if (body.email !== undefined) camposPermitidos.email = body.email.toLowerCase();
    if (body.cargo !== undefined) camposPermitidos.cargo = body.cargo;
    if (body.departamentoId !== undefined) camposPermitidos.departamentoId = body.departamentoId;
    if (body.activo !== undefined) camposPermitidos.activo = body.activo;
    if (body.fechaIngreso !== undefined) camposPermitidos.fechaIngreso = body.fechaIngreso;
    if (body.jefeSuperiorId !== undefined) camposPermitidos.jefeSuperiorId = body.jefeSuperiorId;
    if (body.numeroEmpleado !== undefined) camposPermitidos.numeroEmpleado = body.numeroEmpleado;
    if (body.telefono !== undefined) camposPermitidos.telefono = body.telefono;
    if (body.direccion !== undefined) camposPermitidos.direccion = body.direccion;
    if (body.password && body.password.trim().length > 0) {
      camposPermitidos.passwordHash = await bcrypt.hash(body.password, 10);
    }

    if (session.esAdmin) {
      if (body.esAdmin !== undefined) camposPermitidos.esAdmin = body.esAdmin;
      if (body.esRrhh !== undefined) camposPermitidos.esRrhh = body.esRrhh;
      if (body.esDirector !== undefined) camposPermitidos.esDirector = body.esDirector;
      if (body.esJefe !== undefined) camposPermitidos.esJefe = body.esJefe;
    }

    if (Object.keys(camposPermitidos).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      );
    }

    const [usuarioActualizado] = await db
      .update(usuarios)
      .set({
        ...camposPermitidos,
        updatedAt: new Date().toISOString()
      })
      .where(eq(usuarios.id, id))
      .returning();

    // Sincronizar departamentos.jefeId con esDirector
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
    }

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
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tienePermiso(session, 'usuarios.eliminar')) {
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

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al eliminar usuario';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
