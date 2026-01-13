import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

// PATCH: Cambiar contraseña del usuario autenticado
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

    const { currentPassword, newPassword } = body;

    // Validaciones
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "La contraseña actual y la nueva son obligatorias" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Obtener usuario
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, userId),
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar contraseña actual
    const passwordMatch = await bcrypt.compare(currentPassword, usuario.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: "La contraseña actual es incorrecta" },
        { status: 401 }
      );
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await db
      .update(usuarios)
      .set({
        password: hashedPassword,
      })
      .where(eq(usuarios.id, userId));

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al cambiar contraseña",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
