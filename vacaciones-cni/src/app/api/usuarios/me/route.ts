import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, departamentos, usuariosRoles, roles, balancesAusencias } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET: Obtener perfil del usuario autenticado
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = session.id;

    // Obtener usuario básico
    const [usuario] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Obtener departamento
    const [departamento] = await db
      .select()
      .from(departamentos)
      .where(eq(departamentos.id, usuario.departamentoId))
      .limit(1);

    // Obtener roles del usuario
    const usuarioRolesData = await db
      .select({
        rolId: usuariosRoles.rolId,
        nombre: roles.nombre,
        codigo: roles.codigo,
      })
      .from(usuariosRoles)
      .innerJoin(roles, eq(usuariosRoles.rolId, roles.id))
      .where(eq(usuariosRoles.usuarioId, userId));

    // Obtener balance de vacaciones del año actual (tipo_ausencia_id = 1 es vacaciones)
    const anioActual = new Date().getFullYear();
    const [balance] = await db
      .select()
      .from(balancesAusencias)
      .where(
        and(
          eq(balancesAusencias.usuarioId, userId),
          eq(balancesAusencias.tipoAusenciaId, 1),
          eq(balancesAusencias.anio, anioActual)
        )
      )
      .limit(1);

    // Formatear respuesta
    const response = {
      id: usuario.id,
      nombre: `${usuario.nombre} ${usuario.apellido}`,
      email: usuario.email,
      telefono: usuario.telefono || null,
      direccion: usuario.direccion || null,
      fechaContratacion: usuario.fechaIngreso,
      diasVacacionesAnuales: balance ? parseFloat(balance.cantidadAsignada) : 0,
      diasAcumulados: balance ? parseFloat(balance.cantidadAsignada) - parseFloat(balance.cantidadUtilizada) - parseFloat(balance.cantidadPendiente) : 0,
      departamento: {
        id: departamento?.id || 0,
        nombre: departamento?.nombre || "Sin departamento",
      },
      puesto: {
        id: 0,
        nombre: usuario.cargo || "Sin cargo",
      },
      roles: usuarioRolesData.map((r) => ({
        id: r.rolId,
        nombre: r.nombre,
        codigo: r.codigo,
      })),
    };

    return NextResponse.json({
      success: true,
      usuario: response,
    });
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener perfil",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar información personal del usuario
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = session.id;
    const body = await request.json();

    const { telefono, direccion } = body;

    // Actualizar solo campos editables por el usuario
    await db
      .update(usuarios)
      .set({
        telefono: telefono || null,
        direccion: direccion || null,
      })
      .where(eq(usuarios.id, userId));

    // Obtener usuario actualizado
    const [usuarioActualizado] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!usuarioActualizado) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Obtener departamento
    const [departamento] = await db
      .select()
      .from(departamentos)
      .where(eq(departamentos.id, usuarioActualizado.departamentoId))
      .limit(1);

    // Obtener roles del usuario
    const usuarioRolesData = await db
      .select({
        rolId: usuariosRoles.rolId,
        nombre: roles.nombre,
        codigo: roles.codigo,
      })
      .from(usuariosRoles)
      .innerJoin(roles, eq(usuariosRoles.rolId, roles.id))
      .where(eq(usuariosRoles.usuarioId, userId));

    // Obtener balance de vacaciones del año actual
    const anioActual = new Date().getFullYear();
    const [balance] = await db
      .select()
      .from(balancesAusencias)
      .where(
        and(
          eq(balancesAusencias.usuarioId, userId),
          eq(balancesAusencias.tipoAusenciaId, 1),
          eq(balancesAusencias.anio, anioActual)
        )
      )
      .limit(1);

    // Formatear respuesta
    const response = {
      id: usuarioActualizado.id,
      nombre: `${usuarioActualizado.nombre} ${usuarioActualizado.apellido}`,
      email: usuarioActualizado.email,
      telefono: usuarioActualizado.telefono || null,
      direccion: usuarioActualizado.direccion || null,
      fechaContratacion: usuarioActualizado.fechaIngreso,
      diasVacacionesAnuales: balance ? parseFloat(balance.cantidadAsignada) : 0,
      diasAcumulados: balance ? parseFloat(balance.cantidadAsignada) - parseFloat(balance.cantidadUtilizada) - parseFloat(balance.cantidadPendiente) : 0,
      departamento: {
        id: departamento?.id || 0,
        nombre: departamento?.nombre || "Sin departamento",
      },
      puesto: {
        id: 0,
        nombre: usuarioActualizado.cargo || "Sin cargo",
      },
      roles: usuarioRolesData.map((r) => ({
        id: r.rolId,
        nombre: r.nombre,
        codigo: r.codigo,
      })),
    };

    return NextResponse.json({
      success: true,
      usuario: response,
      message: "Perfil actualizado correctamente",
    });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar perfil",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
