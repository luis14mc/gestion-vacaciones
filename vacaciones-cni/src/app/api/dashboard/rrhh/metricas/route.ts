import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.esRrhh || session.user?.esAdmin) {
      return NextResponse.json(
        { success: false, error: "No autorizado - Solo para RRHH" },
        { status: 403 }
      );
    }

    console.log('👥 RRHH Dashboard - Obteniendo métricas globales');

    // Obtener total de usuarios (RRHH ve todo)
    const [totalUsuarios] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(isNull(usuarios.deletedAt));

    // Obtener usuarios activos
    const [usuariosActivos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

    // Obtener solicitudes pendientes (todas)
    const [solicitudesPendientes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Obtener usuarios en vacaciones
    const [enVacaciones] = await db
      .select({ count: sql<number>`count(DISTINCT ${solicitudes.usuarioId})` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.estado, "en_uso"),
          isNull(solicitudes.deletedAt)
        )
      );

    // Obtener nuevos usuarios este mes
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const [nuevosEsteMes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        and(
          sql`${usuarios.createdAt} >= ${primerDiaMes}`,
          isNull(usuarios.deletedAt)
        )
      );

    // Solicitudes aprobadas HOY por este RRHH (aprobación final)
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const [aprobadasHoy] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.aprobadoRrhhPor, session.user.id),
          sql`${solicitudes.fechaAprobacionRrhh} >= ${hoyInicio}`,
          sql`${solicitudes.fechaAprobacionRrhh} <= ${hoyFin}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Solicitudes rechazadas HOY por este RRHH
    const [rechazadasHoy] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.estado, "rechazada"),
          eq(solicitudes.aprobadoRrhhPor, session.user.id),
          sql`${solicitudes.updatedAt} >= ${hoyInicio}`,
          sql`${solicitudes.updatedAt} <= ${hoyFin}`,
          isNull(solicitudes.deletedAt)
        )
      );

    const metricas = {
      usuarios_totales: Number(totalUsuarios?.count || 0),
      usuarios_activos: Number(usuariosActivos?.count || 0),
      solicitudes_pendientes: Number(solicitudesPendientes?.count || 0),
      en_vacaciones: Number(enVacaciones?.count || 0),
      nuevos_este_mes: Number(nuevosEsteMes?.count || 0),
      aprobadas_hoy: Number(aprobadasHoy?.count || 0),
      rechazadas_hoy: Number(rechazadasHoy?.count || 0),
    };

    console.log('✅ RRHH métricas:', metricas);

    return NextResponse.json({
      success: true,
      data: metricas
    });
  } catch (error) {
    console.error("Error obteniendo métricas RRHH:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
