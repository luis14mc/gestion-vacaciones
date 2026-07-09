import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { resolverIdsEquipo } from "@/lib/domain/equipo-jefe";
import { withErrorHandler } from "@/lib/api-handler";

export const GET = withErrorHandler(async () => {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const rawId = session.id;
    const userId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!userId || Number.isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, error: "Sesión inválida" },
        { status: 401 }
      );
    }

    const [usuarioBd] = await db
      .select({
        id: usuarios.id,
        activo: usuarios.activo,
        deletedAt: usuarios.deletedAt,
        esAdmin: usuarios.esAdmin,
        esRrhh: usuarios.esRrhh,
        esDirector: usuarios.esDirector,
        esJefe: usuarios.esJefe,
        departamentoId: usuarios.departamentoId,
      })
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!usuarioBd || usuarioBd.deletedAt || !usuarioBd.activo) {
      return NextResponse.json(
        { success: false, error: "Usuario no disponible" },
        { status: 403 }
      );
    }

    const esJefeODirector =
      usuarioBd.esJefe || usuarioBd.esDirector;
    const esAdminORrhh = usuarioBd.esAdmin || usuarioBd.esRrhh;

    if (!esJefeODirector && !esAdminORrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const usuariosIds = await resolverIdsEquipo({
      jefeId: userId,
      esDirector: usuarioBd.esDirector,
      departamentoId: usuarioBd.departamentoId,
    });

    const equipoVacio = usuariosIds.length === 0;

    const countFrom = (row: { count: number } | undefined): number =>
      Number(row?.count ?? 0);

    let empleadosBajoCargo = 0;
    let solicitudesPendientesAprobacion = 0;
    let aprobadasHoy = 0;
    let rechazadasHoy = 0;

    if (!equipoVacio) {
      const empleadosRow = await db
        .select({ count: sql<number>`count(*)` })
        .from(usuarios)
        .where(
          and(
            eq(usuarios.activo, true),
            inArray(usuarios.id, usuariosIds),
            isNull(usuarios.deletedAt)
          )
        );
      empleadosBajoCargo = countFrom(empleadosRow[0]);

      const pendientesRow = await db
        .select({ count: sql<number>`count(*)` })
        .from(solicitudes)
        .where(
          and(
            sql`${solicitudes.estado} IN ('pendiente_jefe')`,
            inArray(solicitudes.usuarioId, usuariosIds),
            isNull(solicitudes.deletedAt)
          )
        );
      solicitudesPendientesAprobacion = countFrom(pendientesRow[0]);

      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);
      const hoyFin = new Date();
      hoyFin.setHours(23, 59, 59, 999);

      const aprobadasRow = await db
        .select({ count: sql<number>`count(*)` })
        .from(solicitudes)
        .where(
          and(
            eq(solicitudes.aprobadaJefePor, userId),
            sql`${solicitudes.aprobadaJefeFecha} >= ${hoyInicio.toISOString()}`,
            sql`${solicitudes.aprobadaJefeFecha} <= ${hoyFin.toISOString()}`,
            inArray(solicitudes.usuarioId, usuariosIds),
            isNull(solicitudes.deletedAt)
          )
        );
      aprobadasHoy = countFrom(aprobadasRow[0]);

      const rechazadasRow = await db
        .select({ count: sql<number>`count(*)` })
        .from(solicitudes)
        .where(
          and(
            eq(solicitudes.rechazadaPor, userId),
            sql`${solicitudes.estado} IN ('rechazada_jefe')`,
            sql`${solicitudes.updatedAt} >= ${hoyInicio.toISOString()}`,
            sql`${solicitudes.updatedAt} <= ${hoyFin.toISOString()}`,
            inArray(solicitudes.usuarioId, usuariosIds),
            isNull(solicitudes.deletedAt)
          )
        );
      rechazadasHoy = countFrom(rechazadasRow[0]);
    }

    const metricasOperativas = {
      empleados_bajo_cargo: empleadosBajoCargo,
      solicitudes_pendientes_aprobacion: solicitudesPendientesAprobacion,
      solicitudes_aprobadas_hoy: aprobadasHoy,
      solicitudes_rechazadas_hoy: rechazadasHoy,
    };

    return NextResponse.json({
      success: true,
      data: metricasOperativas,
    });
  } catch (error) {
    console.error('[dashboard/jefe/metricas]', error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Ocurrió un error inesperado al procesar la solicitud. Contacte a soporte si el problema persiste.",
      },
      { status: 500 }
    );
  }
});