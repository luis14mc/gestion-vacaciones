import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { balances, solicitudes, anosLaborales, usuarios } from "@/lib/db/schema";
import { mapBalanceRegistro, mapBalanceToFila } from "@/lib/domain/balance-display";
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

export const GET = withErrorHandler(async () => {
    const session = await getSession();

    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

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

    const anosCandidatos = [
      anoLaboralActivo?.id,
      anoLaboralActual?.id,
    ].filter((id, index, ids): id is number => Boolean(id) && ids.indexOf(id) === index);

    let balance: {
      cantidadInicial: string | null;
      cantidadAcumulada: string | null;
      cantidadUsada: string | null;
      cantidadPendiente: string | null;
      cantidadDisponible: string | null;
      anoLaboralId: number;
    } | null = null;
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
            cantidadUsada: 0,
            cantidadPendiente: 0,
            cantidadDisponible: 0,
          })
        : null;

      return NextResponse.json({
        success: true,
        data: {
          tieneBalance: false,
          ...mapBalanceRegistro({}),
          balanceDetalle: balanceDetalleSinBalance,
          anoLaboral: anoLaboral?.ano ?? anioActual,
          solicitudesPendientes: 0,
          solicitudesAprobadas: 0,
          solicitudesRechazadas: 0,
          enVacaciones: false,
        },
      });
    }

    const saldo = mapBalanceRegistro(balance);

    const balanceDetalle = usuario
      ? mapBalanceToFila({
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          fechaIngreso: usuario.fechaIngreso,
          cantidadInicial: balance.cantidadInicial,
          cantidadAcumulada: balance.cantidadAcumulada,
          cantidadUsada: balance.cantidadUsada,
          cantidadPendiente: balance.cantidadPendiente,
          cantidadDisponible: balance.cantidadDisponible,
        })
      : null;

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
        ...saldo,
        balanceDetalle,
        anoLaboral: anoLaboral?.ano ?? anioActual,
        solicitudesPendientes: Number(pendientes?.count || 0),
        solicitudesAprobadas: Number(aprobadas?.count || 0),
        solicitudesRechazadas: Number(rechazadas?.count || 0),
        enVacaciones: enVacacionesData.length > 0,
      },
    });
});
