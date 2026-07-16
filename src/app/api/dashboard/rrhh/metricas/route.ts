import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withErrorHandler } from "@/lib/api-handler";

export const GET = withErrorHandler(async () => {
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

  const [totalUsuarios] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios)
    .where(isNull(usuarios.deletedAt));

  const [usuariosActivos] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

  const [solicitudesPendientes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .where(
      and(
        sql`${solicitudes.estado} = 'pendiente_rrhh'`,
        isNull(solicitudes.deletedAt)
      )
    );

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

  const [rechazadasHoy] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .where(
      and(
        sql`${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_director', 'rechazada_secretario_general', 'rechazada_rrhh')`,
        eq(solicitudes.rechazadaPor, session.id),
        sql`${solicitudes.updatedAt} >= ${hoyInicio.toISOString()}`,
        sql`${solicitudes.updatedAt} <= ${hoyFin.toISOString()}`,
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

  return NextResponse.json({
    success: true,
    data: metricas
  });
});
