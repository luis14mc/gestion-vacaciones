import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { balances, solicitudes, anosLaborales, usuarios } from "@/lib/db/schema";
import { mapBalanceToFila } from "@/lib/domain/balance-display";
import {
  calcularConsumoBalance,
  calcularDisponibleBalance,
} from "@/lib/domain/balance-consumo";
import { desc, eq, and, isNull, sql } from "drizzle-orm";

const balanceSelect = {
  id: balances.id,
  usuarioId: balances.usuarioId,
  anoLaboralId: balances.anoLaboralId,
  tipoAusencia: balances.tipoAusencia,
  cantidadInicial: balances.cantidadInicial,
  cantidadAcumulada: balances.cantidadAcumulada,
  cantidadUsada: balances.cantidadUsada,
  cantidadPendiente: balances.cantidadPendiente,
  cantidadDisponible: balances.cantidadDisponible,
  updatedAt: balances.updatedAt,
};

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

    const [usuario] = await db
      .select({
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
        fechaIngreso: usuarios.fechaIngreso,
      })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    // Obtener año laboral activo
    const [anoLaboralActivo] = await db
      .select({ id: anosLaborales.id, ano: anosLaborales.ano })
      .from(anosLaborales)
      .where(eq(anosLaborales.activo, true))
      .limit(1);

    const [anoLaboralActual] = await db
      .select({ id: anosLaborales.id, ano: anosLaborales.ano })
      .from(anosLaborales)
      .where(eq(anosLaborales.ano, anioActual))
      .limit(1);

    // Obtener balance activo del usuario para el año actual
    const anosCandidatos = [
      anoLaboralActivo?.id,
      anoLaboralActual?.id,
    ].filter((id, index, ids): id is number => Boolean(id) && ids.indexOf(id) === index);

    let balance: any = null;
    for (const anoLaboralId of anosCandidatos) {
      const [balanceDelAno] = await db
        .select(balanceSelect)
        .from(balances)
        .where(and(
          eq(balances.usuarioId, usuarioId),
          eq(balances.anoLaboralId, anoLaboralId),
          eq(balances.tipoAusencia, 'vacaciones')
        ))
        .limit(1);

      balance = balanceDelAno ?? null;

      if (balance) break;
    }

    if (!balance) {
      const [balanceReciente] = await db
        .select(balanceSelect)
        .from(balances)
        .where(and(
          eq(balances.usuarioId, usuarioId),
          eq(balances.tipoAusencia, 'vacaciones')
        ))
        .orderBy(desc(balances.updatedAt))
        .limit(1);

      balance = balanceReciente ?? null;
    }

    const anoLaboral = anoLaboralActivo ?? anoLaboralActual ?? null;

    if (!balance) {
      const balanceDetalleSinBalance = usuario
        ? mapBalanceToFila({
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            fechaIngreso: usuario.fechaIngreso,
            cantidadInicial: 0,
            cantidadAcumulada: 0,
            cantidadDisponible: 0,
          })
        : null;

      return NextResponse.json({
        success: true,
        data: {
          tieneBalance: false,
          diasAsignados: 0,
          diasAcumulados: 0,
          diasUsados: 0,
          diasPendientes: 0,
          diasDisponibles: 0,
          diasVencidos: 0,
          diasProporcionales: 0,
          balanceDetalle: balanceDetalleSinBalance,
          anoLaboral: anoLaboral?.ano ?? anioActual,
          solicitudesPendientes: 0,
          solicitudesAprobadas: 0,
          solicitudesRechazadas: 0,
          enVacaciones: false
        }
      });
    }

    const diasAsignados = Number(balance.cantidadInicial || 0);
    const diasAcumulados = Number(balance.cantidadAcumulada || 0);
    const baseBalance = diasAsignados + diasAcumulados;

    const solicitudesConsumo = await db
      .select({
        estado: solicitudes.estado,
        diasSolicitados: solicitudes.diasSolicitados,
        tipo: solicitudes.tipo,
        duracionPermiso: solicitudes.duracionPermiso,
      })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, usuarioId),
          eq(solicitudes.anoLaboralId, balance.anoLaboralId),
          isNull(solicitudes.deletedAt)
        )
      );

    const { usada: diasUsados, pendiente: diasPendientes } =
      calcularConsumoBalance(solicitudesConsumo);
    const diasDisponibles = calcularDisponibleBalance(
      baseBalance,
      diasUsados,
      diasPendientes
    );

    const balanceDetalle = usuario
      ? mapBalanceToFila({
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          fechaIngreso: usuario.fechaIngreso,
          cantidadInicial: balance.cantidadInicial,
          cantidadAcumulada: balance.cantidadAcumulada,
          cantidadDisponible: diasDisponibles,
        })
      : null;

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

    // Obtener solicitudes aprobadas (este año)
    const inicioAnio = `${anioActual}-01-01`;
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
    const hoy = new Date().toISOString().split('T')[0];
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

    return NextResponse.json({
      success: true,
      data: {
        tieneBalance: true,
        diasAsignados: baseBalance,
        diasAcumulados,
        diasUsados,
        diasPendientes,
        diasDisponibles,
        diasVencidos: diasAsignados,
        diasProporcionales: diasAcumulados,
        balanceDetalle,
        anoLaboral: anoLaboral?.ano ?? anioActual,
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
