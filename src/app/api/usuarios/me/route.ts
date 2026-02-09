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

    // Por ahora, solo retornamos el perfil actualizado
    // Obtener usuario actualizado
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
    let departamentoNombrePatch = "Sin departamento";
    let departamentoIdPatch = 0;
    if (usuario.departamentoId) {
      const dept = await db.query.departamentos.findFirst({
        where: eq(departamentos.id, usuario.departamentoId),
      });
      if (dept) {
        departamentoNombrePatch = dept.nombre;
        departamentoIdPatch = dept.id;
      }
    }

    // Obtener año laboral activo
    const anoLaboral = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.activo, true)
    });

    // Obtener balance de vacaciones
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
        id: departamentoIdPatch,
        nombre: departamentoNombrePatch,
      },
      puesto: {
        id: 0,
        nombre: usuario.cargo || "Sin cargo",
      },
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
