import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { validarPasswordPolitica } from "@/lib/config/password-policy";
import { metadataConPasswordActualizada } from "@/lib/config/password-expiry";
import bcrypt from "bcryptjs";
import { withErrorHandler } from "@/lib/api-handler";
import { cambiarPasswordSchema } from "@/lib/validation/api-schemas";

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const userId = session.id;
  const body = await request.json();
  const parsed = cambiarPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const errorPolitica = await validarPasswordPolitica(newPassword);
  if (errorPolitica) {
    return NextResponse.json(
      { success: false, error: errorPolitica },
      { status: 400 }
    );
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, userId),
  });

  if (!usuario) {
    return NextResponse.json(
      { success: false, error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  const passwordMatch = await bcrypt.compare(currentPassword, usuario.passwordHash);

  if (!passwordMatch) {
    return NextResponse.json(
      { success: false, error: "La contraseña actual es incorrecta" },
      { status: 401 }
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const metadataActual = (usuario.metadata as Record<string, unknown>) || {};

  await db
    .update(usuarios)
    .set({
      passwordHash: hashedPassword,
      metadata: metadataConPasswordActualizada(metadataActual, { quitarDebeCambiar: true }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usuarios.id, userId));

  return NextResponse.json({
    success: true,
    message: "Contraseña actualizada correctamente",
  });
});
