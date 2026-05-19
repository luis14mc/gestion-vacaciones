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

    if (!session.esAdmin && !session.esRrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Total usuarios
    const totalResult = await db
      .select({ value: sql`count(*)` })
      .from(usuarios)
      .where(isNull(usuarios.deletedAt));

    // Usuarios activos
    const activosResult = await db
      .select({ value: sql`count(*)` })
      .from(usuarios)
      .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

    // Solicitudes pendientes
    const pendientesResult = await db
      .select({ value: sql`count(*)` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    // En vacaciones hoy
    const hoy = new Date().toISOString().split('T')[0];
    const vacacionesResult = await db
      .select({ value: sql`count(DISTINCT ${solicitudes.usuarioId})` })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada')`,
          sql`${solicitudes.fechaInicio} <= ${hoy}`,
          sql`${solicitudes.fechaFin} >= ${hoy}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Nuevos este mes
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);
    const nuevosResult = await db
      .select({ value: sql`count(*)` })
      .from(usuarios)
      .where(
        and(
          sql`${usuarios.createdAt} >= ${primerDiaMes.toISOString()}`,
          isNull(usuarios.deletedAt)
        )
      );

    const toNum = (rows: any[]): number => {
      const raw = rows?.[0]?.value;
      if (raw === null || raw === undefined) return 0;
      const n = Number(raw);
      return isNaN(n) ? 0 : n;
    };

    const metricas = {
      usuarios_totales: toNum(totalResult),
      usuarios_activos: toNum(activosResult),
      solicitudes_pendientes: toNum(pendientesResult),
      en_vacaciones: toNum(vacacionesResult),
      nuevos_este_mes: toNum(nuevosResult),
    };

    return NextResponse.json({
      success: true,
      data: metricas
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo métricas admin:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
