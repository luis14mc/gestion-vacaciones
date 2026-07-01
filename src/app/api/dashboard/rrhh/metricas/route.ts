import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!session.esRrhh && !session.esAdmin) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

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
          sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Obtener usuarios en vacaciones hoy
    const hoy = new Date().toISOString().split('T')[0];
    const [enVacaciones] = await db
      .select({ count: sql<number>`count(DISTINCT ${solicitudes.usuarioId})` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada')`,
          sql`${solicitudes.fechaInicio} <= ${hoy}`,
          sql`${solicitudes.fechaFin} >= ${hoy}`,
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
          eq(solicitudes.aprobadaRrhhPor, session.id),
          sql`${solicitudes.aprobadaRrhhFecha} >= ${hoyInicio.toISOString()}`,
          sql`${solicitudes.aprobadaRrhhFecha} <= ${hoyFin.toISOString()}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Solicitudes rechazadas HOY por este RRHH
    const [rechazadasHoy] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_rrhh')`,
          eq(solicitudes.rechazadaPor, session.id),
          sql`${solicitudes.updatedAt} >= ${hoyInicio.toISOString()}`,
          sql`${solicitudes.updatedAt} <= ${hoyFin.toISOString()}`,
          isNull(solicitudes.deletedAt)
        )
      );

    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();
    const [cumpleanos] = await db
      .select({
        delMes: sql<number>`count(*) FILTER (WHERE ${usuarios.fechaNacimiento} IS NOT NULL AND EXTRACT(MONTH FROM ${usuarios.fechaNacimiento}) = ${mesActual})::int`,
        sinFecha: sql<number>`count(*) FILTER (WHERE ${usuarios.fechaNacimiento} IS NULL)::int`,
        elegiblesPendientes: sql<number>`count(*) FILTER (
          WHERE ${usuarios.fechaNacimiento} IS NOT NULL
            AND EXTRACT(MONTH FROM ${usuarios.fechaNacimiento}) = ${mesActual}
            AND NOT EXISTS (
              SELECT 1 FROM ${solicitudes} s
              WHERE s.usuario_id = ${usuarios.id}
                AND s.tipo = 'dia_cumpleanos'
                AND s.estado IN ('pendiente_jefe', 'aprobada_jefe', 'pendiente_rrhh', 'aprobada_rrhh', 'finalizada')
                AND s.deleted_at IS NULL
                AND EXTRACT(YEAR FROM s.fecha_inicio) = ${anioActual}
            )
        )::int`,
      })
      .from(usuarios)
      .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

    const metricas = {
      usuarios_totales: Number(totalUsuarios?.count || 0),
      usuarios_activos: Number(usuariosActivos?.count || 0),
      solicitudes_pendientes: Number(solicitudesPendientes?.count || 0),
      en_vacaciones: Number(enVacaciones?.count || 0),
      nuevos_este_mes: Number(nuevosEsteMes?.count || 0),
      aprobadas_hoy: Number(aprobadasHoy?.count || 0),
      rechazadas_hoy: Number(rechazadasHoy?.count || 0),
      cumpleanos_del_mes: Number(cumpleanos?.delMes || 0),
      cumpleanos_elegibles_pendientes: Number(cumpleanos?.elegiblesPendientes || 0),
      usuarios_sin_fecha_nacimiento: Number(cumpleanos?.sinFecha || 0),
    };

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
