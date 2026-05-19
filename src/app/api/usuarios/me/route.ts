import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, departamentos, balances, anosLaborales } from "@/lib/db/schema";
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

    // Obtener usuario usando query API
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, userId),
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Obtener departamento si existe
    let departamentoNombre = "Sin departamento";
    let departamentoIdVal = 0;
    if (usuario.departamentoId) {
      const dept = await db.query.departamentos.findFirst({
        where: eq(departamentos.id, usuario.departamentoId),
      });
      if (dept) {
        departamentoNombre = dept.nombre;
        departamentoIdVal = dept.id;
      }
    }

    // Obtener año laboral activo
    const anoLaboral = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.activo, true)
    });

    // Obtener balance de vacaciones del año activo
    const balance = anoLaboral ? await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, userId),
        eq(balances.tipoAusencia, 'vacaciones'),
        eq(balances.anoLaboralId, anoLaboral.id)
      )
    }) : null;

    // Formatear respuesta
    const response = {
      id: usuario.id,
      nombre: `${usuario.nombre} ${usuario.apellido}`,
      email: usuario.email,
      fechaContratacion: usuario.fechaIngreso,
      diasVacacionesAnuales: balance ? parseFloat(balance.cantidadInicial) : 0,
      diasAcumulados: balance ? parseFloat(balance.cantidadDisponible) : 0,
      departamento: {
        id: departamentoIdVal,
        nombre: departamentoNombre,
      },
      puesto: {
        id: 0,
        nombre: usuario.cargo || "Sin cargo",
      },
      numeroEmpleado: usuario.numeroEmpleado || "",
      telefono: usuario.telefono || "",
      direccion: usuario.direccion || "",
      roles: session.roles || [],
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

// PATCH: Actualizar información personal del usuario (solo nombre, apellido, cargo)
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

    const camposPermitidos: Record<string, any> = {};
    if (body.nombre !== undefined) camposPermitidos.nombre = body.nombre;
    if (body.apellido !== undefined) camposPermitidos.apellido = body.apellido;
    if (body.cargo !== undefined) camposPermitidos.cargo = body.cargo;
    if (body.telefono !== undefined) camposPermitidos.telefono = body.telefono;
    if (body.direccion !== undefined) camposPermitidos.direccion = body.direccion;

    if (Object.keys(camposPermitidos).length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron campos válidos" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(usuarios)
      .set({ ...camposPermitidos, updatedAt: new Date().toISOString() })
      .where(eq(usuarios.id, userId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    let departamentoNombrePatch = "Sin departamento";
    let departamentoIdPatch = 0;
    if (updated.departamentoId) {
      const dept = await db.query.departamentos.findFirst({
        where: eq(departamentos.id, updated.departamentoId),
      });
      if (dept) {
        departamentoNombrePatch = dept.nombre;
        departamentoIdPatch = dept.id;
      }
    }

    const response = {
      id: updated.id,
      nombre: `${updated.nombre} ${updated.apellido}`,
      email: updated.email,
      fechaContratacion: updated.fechaIngreso,
      departamento: {
        id: departamentoIdPatch,
        nombre: departamentoNombrePatch,
      },
      puesto: {
        id: 0,
        nombre: updated.cargo || "Sin cargo",
      },
      numeroEmpleado: updated.numeroEmpleado || "",
      telefono: updated.telefono || "",
      direccion: updated.direccion || "",
      roles: session.roles || [],
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
