import { NextResponse } from "next/server";
import { getSession, tienePermiso } from "@/lib/auth";
import { db } from "@/lib/db";
import { balancesAusencias, solicitudes } from "@/lib/db/schema";
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
    console.log('🔍 Buscando balance para usuario ID:', usuarioId, 'Año:', anioActual);

    // Obtener balance activo del usuario para el año actual
    const balance = await db.query.balancesAusencias.findFirst({
      where: and(
        eq(balancesAusencias.usuarioId, usuarioId),
        eq(balancesAusencias.anio, anioActual),
        eq(balancesAusencias.estado, 'activo')
      )
    });

    console.log('💰 Balance encontrado:', balance);

    if (!balance) {
      console.log('⚠️ No se encontró balance para el usuario');
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

    const diasAsignados = Number(balance.cantidadAsignada || 0);
    const diasUsados = Number(balance.cantidadUtilizada || 0);

    console.log('📊 Días asignados:', diasAsignados, 'Días usados:', diasUsados);

    // Obtener solicitudes pendientes
    const [pendientes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
          isNull(solicitudes.deletedAt)
        )
      );

    // Calcular días pendientes de aprobación
    const solicitudesPendientesData = await db
      .select({ dias: solicitudes.cantidad })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
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
          sql`${solicitudes.estado} IN ('aprobada', 'aprobada_jefe', 'en_uso')`,
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
          sql`${solicitudes.estado} = 'rechazada'`,
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
          eq(solicitudes.estado, 'en_uso'),
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
