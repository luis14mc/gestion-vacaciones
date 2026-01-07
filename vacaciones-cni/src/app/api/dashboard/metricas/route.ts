import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Determinar si es jefe (y no admin/RRHH) para filtrar por departamento
    const esJefe = session.user?.esJefe && !session.user?.esAdmin && !session.user?.esRrhh;
    const departamentoId = session.user?.departamentoId;

    // Condición base para usuarios
    const baseConditionUsuarios = esJefe && departamentoId
      ? and(eq(usuarios.departamentoId, departamentoId), isNull(usuarios.deletedAt))
      : isNull(usuarios.deletedAt);

    // Obtener total de usuarios (filtrado por departamento si es jefe)
    const [totalUsuarios] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(baseConditionUsuarios);

    // Obtener usuarios activos (filtrado por departamento si es jefe)
    const [usuariosActivos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        esJefe && departamentoId
          ? and(eq(usuarios.activo, true), eq(usuarios.departamentoId, departamentoId), isNull(usuarios.deletedAt))
          : and(eq(usuarios.activo, true), isNull(usuarios.deletedAt))
      );

    // Obtener IDs de usuarios del departamento (si es jefe)
    let usuariosIds: number[] = [];
    if (esJefe && departamentoId) {
      const usuariosDept = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(eq(usuarios.departamentoId, departamentoId), isNull(usuarios.deletedAt)));
      usuariosIds = usuariosDept.map(u => u.id);
    }

    // Obtener solicitudes pendientes (filtrado por departamento si es jefe)
    const solicitudesPendientesCondition = esJefe && usuariosIds.length > 0
      ? and(
          sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
          inArray(solicitudes.usuarioId, usuariosIds),
          isNull(solicitudes.deletedAt)
        )
      : esJefe && usuariosIds.length === 0
      ? sql`1=0` // No hay usuarios, retornar 0
      : and(
          sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        );

    const [solicitudesPendientes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(solicitudesPendientesCondition);

    // Obtener usuarios en vacaciones (filtrado por departamento si es jefe)
    const enVacacionesCondition = esJefe && usuariosIds.length > 0
      ? and(
          eq(solicitudes.estado, "en_uso"),
          inArray(solicitudes.usuarioId, usuariosIds),
          isNull(solicitudes.deletedAt)
        )
      : esJefe && usuariosIds.length === 0
      ? sql`1=0` // No hay usuarios, retornar 0
      : and(
          eq(solicitudes.estado, "en_uso"),
          isNull(solicitudes.deletedAt)
        );

    const [enVacaciones] = await db
      .select({ count: sql<number>`count(DISTINCT ${solicitudes.usuarioId})` })
      .from(solicitudes)
      .where(enVacacionesCondition);

    // Obtener nuevos usuarios este mes (filtrado por departamento si es jefe)
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const [nuevosEsteMes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        esJefe && departamentoId
          ? and(
              sql`${usuarios.createdAt} >= ${primerDiaMes}`,
              eq(usuarios.departamentoId, departamentoId),
              isNull(usuarios.deletedAt)
            )
          : and(
              sql`${usuarios.createdAt} >= ${primerDiaMes}`,
              isNull(usuarios.deletedAt)
            )
      );

    return NextResponse.json({
      success: true,
      data: {
        usuarios_totales: Number(totalUsuarios?.count || 0),
        usuarios_activos: Number(usuariosActivos?.count || 0),
        solicitudes_pendientes: Number(solicitudesPendientes?.count || 0),
        en_vacaciones: Number(enVacaciones?.count || 0),
        nuevos_este_mes: Number(nuevosEsteMes?.count || 0),
      },
    });
  } catch (error) {
    console.error("Error obteniendo métricas del dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
