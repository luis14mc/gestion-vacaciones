import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.esJefe || session.user?.esAdmin || session.user?.esRrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado - Solo para jefes" },
        { status: 403 }
      );
    }

    const departamentoId = session.user.departamentoId;

    if (!departamentoId) {
      return NextResponse.json(
        { success: false, error: "Jefe sin departamento asignado" },
        { status: 400 }
      );
    }

    console.log('👔 Jefe Dashboard - Departamento:', departamentoId);

    // Obtener usuarios del departamento
    const usuariosDept = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.departamentoId, departamentoId), isNull(usuarios.deletedAt)));

    const usuariosIds = usuariosDept.map(u => u.id);
    console.log('👥 Usuarios del departamento:', usuariosIds.length);

    // Total de usuarios del departamento
    const totalUsuarios = usuariosIds.length;

    // Obtener usuarios activos del departamento
    const [usuariosActivos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.activo, true),
          eq(usuarios.departamentoId, departamentoId),
          isNull(usuarios.deletedAt)
        )
      );

    // Solicitudes pendientes del departamento
    let solicitudesPendientes = { count: 0 };
    if (usuariosIds.length > 0) {
      [solicitudesPendientes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(solicitudes)
        .where(
          and(
            sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
            inArray(solicitudes.usuarioId, usuariosIds),
            isNull(solicitudes.deletedAt)
          )
        );
    }

    // Usuarios en vacaciones del departamento
    let enVacaciones = { count: 0 };
    if (usuariosIds.length > 0) {
      [enVacaciones] = await db
        .select({ count: sql<number>`count(DISTINCT ${solicitudes.usuarioId})` })
        .from(solicitudes)
        .where(
          and(
            eq(solicitudes.estado, "en_uso"),
            inArray(solicitudes.usuarioId, usuariosIds),
            isNull(solicitudes.deletedAt)
          )
        );
    }

    // Nuevos usuarios este mes en el departamento
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const [nuevosEsteMes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        and(
          sql`${usuarios.createdAt} >= ${primerDiaMes}`,
          eq(usuarios.departamentoId, departamentoId),
          isNull(usuarios.deletedAt)
        )
      );

    // Solicitudes aprobadas HOY por este jefe
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const [aprobadasHoy] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.aprobadoPor, session.user.id),
          sql`${solicitudes.fechaAprobacionJefe} >= ${hoyInicio}`,
          sql`${solicitudes.fechaAprobacionJefe} <= ${hoyFin}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Solicitudes rechazadas HOY por este jefe
    const [rechazadasHoy] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.estado, "rechazada"),
          eq(solicitudes.aprobadoPor, session.user.id),
          sql`${solicitudes.updatedAt} >= ${hoyInicio}`,
          sql`${solicitudes.updatedAt} <= ${hoyFin}`,
          isNull(solicitudes.deletedAt)
        )
      );

    const metricas = {
      usuarios_totales: totalUsuarios,
      usuarios_activos: Number(usuariosActivos?.count || 0),
      solicitudes_pendientes: Number(solicitudesPendientes?.count || 0),
      en_vacaciones: Number(enVacaciones?.count || 0),
      nuevos_este_mes: Number(nuevosEsteMes?.count || 0),
      aprobadas_hoy: Number(aprobadasHoy?.count || 0),
      rechazadas_hoy: Number(rechazadasHoy?.count || 0),
    };

    console.log('✅ Jefe métricas:', metricas);

    return NextResponse.json({
      success: true,
      data: metricas
    });
  } catch (error) {
    console.error("Error obteniendo métricas jefe:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
