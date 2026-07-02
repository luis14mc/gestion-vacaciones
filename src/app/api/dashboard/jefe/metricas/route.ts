import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { resolverIdsEquipo } from "@/lib/domain/equipo-jefe";
import { withErrorHandler } from "@/lib/api-handler";

export const GET = withErrorHandler(async () => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  if (!session.esDirector && !session.esJefe && !session.esAdmin && !session.esRrhh) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 }
    );
  }

  const usuariosIds = await resolverIdsEquipo({
    jefeId: session.id,
    esDirector: session.esDirector,
    departamentoId: session.departamentoId,
  });

  const totalUsuarios = usuariosIds.length;

  const countFrom = (rows: { count: number }[]) => Number(rows[0]?.count ?? 0);

  let usuariosActivosCount = 0;
  if (usuariosIds.length > 0) {
    usuariosActivosCount = countFrom(await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.activo, true),
          inArray(usuarios.id, usuariosIds),
          isNull(usuarios.deletedAt)
        )
      ));
  }

  let solicitudesPendientesCount = 0;
  if (usuariosIds.length > 0) {
    solicitudesPendientesCount = countFrom(await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
          inArray(solicitudes.usuarioId, usuariosIds),
          isNull(solicitudes.deletedAt)
        )
      ));
  }

  const hoy = new Date().toISOString().slice(0, 10);
  let enVacacionesCount = 0;
  if (usuariosIds.length > 0) {
    enVacacionesCount = countFrom(await db
      .select({ count: sql<number>`count(DISTINCT ${solicitudes.usuarioId})` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada')`,
          sql`${solicitudes.fechaInicio} <= ${hoy}`,
          sql`${solicitudes.fechaFin} >= ${hoy}`,
          inArray(solicitudes.usuarioId, usuariosIds),
          isNull(solicitudes.deletedAt)
        )
      ));
  }

  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  primerDiaMes.setHours(0, 0, 0, 0);

  let nuevosEsteMesCount = 0;
  if (usuariosIds.length > 0) {
    nuevosEsteMesCount = countFrom(await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(
        and(
          sql`${usuarios.createdAt} >= ${primerDiaMes}`,
          inArray(usuarios.id, usuariosIds),
          isNull(usuarios.deletedAt)
        )
      ));
  }

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  const aprobadasHoyCount = countFrom(await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .where(
      and(
        eq(solicitudes.aprobadaJefePor, session.id),
        sql`${solicitudes.aprobadaJefeFecha} >= ${hoyInicio.toISOString()}`,
        sql`${solicitudes.aprobadaJefeFecha} <= ${hoyFin.toISOString()}`,
        isNull(solicitudes.deletedAt)
      )
    ));

  const rechazadasHoyCount = countFrom(await db
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
    ));

  const metricas = {
    usuarios_totales: totalUsuarios,
    usuarios_activos: usuariosActivosCount,
    solicitudes_pendientes: solicitudesPendientesCount,
    en_vacaciones: enVacacionesCount,
    nuevos_este_mes: nuevosEsteMesCount,
    aprobadas_hoy: aprobadasHoyCount,
    rechazadas_hoy: rechazadasHoyCount,
  };

  return NextResponse.json({
    success: true,
    data: metricas
  });
});
