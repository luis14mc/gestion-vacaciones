import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { usuarios, balances, solicitudes, anosLaborales } from "@/lib/db/schema";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import {
  buildHistorialDesdeBalances,
  mapSaldosAResumenDepartamento,
  sumarSaldos,
} from "@/lib/domain/balance-display";
import { puedeVerReporteDepartamento } from "@/lib/domain/reportes/access";

export const runtime = 'nodejs';

const RESUMEN_VACIO = {
  totalColaboradores: 0,
  colaboradoresActivos: 0,
  enVacacionesHoy: 0,
  diasTotalesVencidos: 0,
  diasTotalesProporcionales: 0,
  diasTotalesAsignados: 0,
  diasTotalesUsados: 0,
  diasTotalesPendientes: 0,
  diasTotalesDisponibles: 0,
  promedioUsoPorPersona: 0,
};

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // Política Fase 1 (Fase 1 — Seguridad de jefes): los reportes
    // departamentales están restringidos a Admin/RRHH. Jefe/Director ya
    // tienen el Dashboard operativo y la bandeja de aprobación; no
    // necesitan reportes institucionales.
    if (!puedeVerReporteDepartamento(session)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get("mes") || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get("anio") || String(new Date().getFullYear()));

    let usuariosDept: Array<typeof usuarios.$inferSelect> = [];

    // Después del gate `puedeVerReporteDepartamento` solo pasan Admin/RRHH.
    // La vista es siempre organizacional (todos los usuarios activos).
    usuariosDept = await db.query.usuarios.findMany({
      where: isNull(usuarios.deletedAt),
    });

    const usuariosIds = usuariosDept.map(u => u.id);
    const totalColaboradores = usuariosDept.length;
    const colaboradoresActivos = usuariosDept.filter(u => u.activo).length;

    const anoLaboral = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.ano, anio)
    });

    let balancesData: Array<typeof balances.$inferSelect> = [];
    let totalesSaldos = sumarSaldos([]);

    if (anoLaboral && usuariosIds.length > 0) {
      balancesData = await db.query.balances.findMany({
        where: and(
          eq(balances.anoLaboralId, anoLaboral.id),
          eq(balances.tipoAusencia, 'vacaciones' as any),
          inArray(balances.usuarioId, usuariosIds)
        )
      });

      totalesSaldos = sumarSaldos(balancesData);
    }

    const totalesResumen = mapSaldosAResumenDepartamento(totalesSaldos);
    const promedioUsoPorPersona = totalColaboradores > 0 && totalesResumen.diasTotalesAsignados > 0
      ? Math.round((totalesResumen.diasTotalesUsados / totalesResumen.diasTotalesAsignados) * 100)
      : 0;

    const primerDia = new Date(anio, mes - 1, 1).toISOString().slice(0, 10);
    const ultimoDia = new Date(anio, mes, 0).toISOString().slice(0, 10);

    const solicitudesDept = usuariosIds.length > 0 ? await db
      .select({
        id: solicitudes.id,
        usuarioId: solicitudes.usuarioId,
        estado: solicitudes.estado,
        fechaInicio: solicitudes.fechaInicio,
        fechaFin: solicitudes.fechaFin,
        dias: solicitudes.diasSolicitados,
        usuario: sql<string>`${usuarios.nombre} || ' ' || ${usuarios.apellido}`,
      })
      .from(solicitudes)
      .leftJoin(usuarios, eq(solicitudes.usuarioId, usuarios.id))
      .where(
        and(
          inArray(solicitudes.usuarioId, usuariosIds),
          sql`${solicitudes.fechaInicio} <= ${ultimoDia}`,
          sql`${solicitudes.fechaFin} >= ${primerDia}`,
          isNull(solicitudes.deletedAt)
        )
      ) : [];

    const solicitudesAprobadas = solicitudesDept.filter(
      (s: any) => ['aprobada_rrhh', 'finalizada'].includes(s.estado)
    ).length;
    const solicitudesPendientes = solicitudesDept.filter(
      (s: any) => ['pendiente_jefe', 'aprobada_jefe'].includes(s.estado)
    ).length;
    const solicitudesRechazadas = solicitudesDept.filter(
      (s: any) => ['rechazada_jefe', 'rechazada_rrhh'].includes(s.estado)
    ).length;

    const usuariosMap = new Map(
      usuariosDept.map((usuario) => [
        usuario.id,
        `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() || usuario.email,
      ])
    );

    const historialDias = buildHistorialDesdeBalances(balancesData, usuariosMap);

    const hoy = new Date().toISOString().slice(0, 10);
    const enVacacionesHoy = solicitudesDept.filter(
      (s: any) =>
        ['aprobada_rrhh', 'finalizada'].includes(s.estado) &&
        s.fechaInicio &&
        s.fechaFin &&
        s.fechaInicio <= hoy &&
        s.fechaFin >= hoy
    ).length;

    const proximasVacaciones = solicitudesDept
      .filter(
        (s: any) =>
          ['aprobada_rrhh', 'finalizada'].includes(s.estado) &&
          s.fechaInicio &&
          s.fechaFin
      )
      .map((solicitud: any) => ({
        usuario: solicitud.usuario || usuariosMap.get(solicitud.usuarioId) || 'Usuario sin nombre',
        fechaInicio: solicitud.fechaInicio,
        fechaFin: solicitud.fechaFin,
        dias: Number(solicitud.dias ?? 0),
      }))
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

    // Después del gate, solo Admin/RRHH consumen este endpoint, por lo
    // que siempre se devuelven balances completos.
    return NextResponse.json({
      success: true,
      data: {
        periodo: { mes, anio },
        resumen: {
          totalColaboradores,
          colaboradoresActivos,
          enVacacionesHoy,
          ...totalesResumen,
          promedioUsoPorPersona,
        },
        solicitudes: {
          total: solicitudesDept.length,
          aprobadas: solicitudesAprobadas,
          pendientes: solicitudesPendientes,
          rechazadas: solicitudesRechazadas,
        },
        proximasVacaciones,
        topUsuarios: historialDias,
        historialDias,
        detalle: solicitudesDept,
      },
    });

});
