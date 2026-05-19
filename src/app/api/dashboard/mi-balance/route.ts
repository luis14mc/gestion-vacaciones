import { NextResponse } from "next/server";
import { getSession, tienePermiso } from "@/lib/auth";
import { db } from "@/lib/db";
import { balances, solicitudes, anosLaborales } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Verificar autenticación
    const session = await getSession();

    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Este endpoint SIEMPRE retorna el balance del usuario actual (propio)
    // No necesita permiso especial, todos pueden ver su propio balance
    const usuarioId = session.id;
    const anioActual = new Date().getFullYear();

    // Obtener año laboral activo
    const anoLaboral = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.activo, true)
    });

    // Obtener balance activo del usuario para el año actual
    const balance = anoLaboral ? await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, usuarioId),
        eq(balances.anoLaboralId, anoLaboral.id),
        eq(balances.tipoAusencia, 'vacaciones')
      )
    }) : null;

    if (!balance) {
      return NextResponse.json({
        success: true,
        data: {
          diasAsignados: 0,
          diasUsados: 0,
          diasPendientes: 0,
          diasDisponibles: 0,
          solicitudesPendientes: 0,
          solicitudesAprobadas: 0,
          solicitudesRechazadas: 0,
          enVacaciones: false
        }
      });
    }

    const diasAsignados = Number(balance.cantidadInicial || 0);
    const diasUsados = Number(balance.cantidadUsada || 0);

    // Obtener solicitudes pendientes
    const [pendientes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Calcular días pendientes de aprobación
    const solicitudesPendientesData = await db
      .select({ dias: solicitudes.diasSolicitados })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    const diasPendientes = solicitudesPendientesData.reduce(
      (sum, sol) => sum + Number(sol.dias),
      0
    );

    // Obtener solicitudes aprobadas (este año)
    const inicioAnio = new Date(new Date().getFullYear(), 0, 1);
    const [aprobadas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada')`,
          sql`${solicitudes.createdAt} >= ${inicioAnio}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Obtener solicitudes rechazadas (este año)
    const [rechazadas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_rrhh')`,
          sql`${solicitudes.createdAt} >= ${inicioAnio}`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Verificar si está en vacaciones actualmente
    const hoy = new Date();
    const enVacacionesData = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada')`,
          sql`${solicitudes.fechaInicio} <= ${hoy}`,
          sql`${solicitudes.fechaFin} >= ${hoy}`,
          isNull(solicitudes.deletedAt)
        )
      )
      .limit(1);

    const diasDisponibles = diasAsignados - diasUsados - diasPendientes;

    return NextResponse.json({
      success: true,
      data: {
        diasAsignados,
        diasUsados,
        diasPendientes,
        diasDisponibles,
        solicitudesPendientes: Number(pendientes?.count || 0),
        solicitudesAprobadas: Number(aprobadas?.count || 0),
        solicitudesRechazadas: Number(rechazadas?.count || 0),
        enVacaciones: enVacacionesData.length > 0
      }
    });
  } catch (error) {
    console.error("Error obteniendo balance personal:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener balance" },
      { status: 500 }
    );
  }
}
