import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, departamentos, balances, anosLaborales } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

// Solo datos de contacto/identidad personales; el cargo y los roles los
// gestiona RRHH/Admin, no el propio usuario.
const perfilSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100).optional(),
  apellido: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres").max(100).optional(),
  telefono: z.string().trim().max(50).optional(),
  direccion: z.string().trim().max(500).optional(),
});

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

    const parsed = perfilSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const camposPermitidos: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) camposPermitidos[k] = v;
    }

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
