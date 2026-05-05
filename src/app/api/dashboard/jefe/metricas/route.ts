import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

export async function GET() {
  try {
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

    const departamentoId = session.departamentoId;

    if (!departamentoId) {
      return NextResponse.json(
        { success: false, error: "Jefe sin departamento asignado" },
        { status: 400 }
      );
    }

    // Obtener usuarios del departamento
    const usuariosDept = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.departamentoId, departamentoId), isNull(usuarios.deletedAt)));

    const usuariosIds = usuariosDept.map(u => u.id);

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
            sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
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
            eq(solicitudes.estado, "finalizada"),
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
          eq(solicitudes.aprobadaJefePor, session.id),
          sql`${solicitudes.aprobadaJefeFecha} >= ${hoyInicio.toISOString()}`,
          sql`${solicitudes.aprobadaJefeFecha} <= ${hoyFin.toISOString()}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Solicitudes rechazadas HOY por este jefe
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

    const metricas = {
      usuarios_totales: totalUsuarios,
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
  } catch (error) {
    console.error("Error obteniendo métricas jefe:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
