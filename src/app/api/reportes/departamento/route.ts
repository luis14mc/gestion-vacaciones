import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, tienePermiso } from "@/lib/auth";
import { usuarios, balances, solicitudes, anosLaborales } from "@/lib/db/schema";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const esDirectorOJefe = session.roles?.some(r => ['JEFE', 'DIRECTOR'].includes(r.codigo)) || session.esDirector || session.esJefe;
    const esAdminORrhh = session.roles?.some(r => ['ADMIN', 'RRHH'].includes(r.codigo)) || session.esAdmin || session.esRrhh;

    if (!tienePermiso(session, 'reportes.departamento') && !esDirectorOJefe && !esAdminORrhh) {
      return NextResponse.json(
        { error: 'No tienes permiso para consultar reportes por departamento' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get("mes") || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get("anio") || String(new Date().getFullYear()));

    // Filtro contextual: Si es JEFE, solo su departamento
    let departamentoCondition = undefined;
    if (esDirectorOJefe && !esAdminORrhh) {
      if (session.departamentoId) {
        departamentoCondition = eq(usuarios.departamentoId, session.departamentoId);
      } else {
        return NextResponse.json(
          { success: false, error: 'Usuario JEFE sin departamento asignado' },
          { status: 403 }
        );
      }
    }

    // Obtener usuarios
    const usuariosDept = await db.query.usuarios.findMany({
      where: departamentoCondition 
        ? and(isNull(usuarios.deletedAt), departamentoCondition) 
        : isNull(usuarios.deletedAt)
    });

    const usuariosIds = usuariosDept.map(u => u.id);
    const totalColaboradores = usuariosDept.length;
    const colaboradoresActivos = usuariosDept.filter(u => u.activo).length;

    // Obtener año laboral activo
    const anoLaboral = await db.query.anosLaborales.findFirst({
      where: eq(anosLaborales.ano, anio)
    });

    // Balances de días
    let diasTotalesAsignados = 0;
    let diasTotalesUsados = 0;
    let diasTotalesDisponibles = 0;
    let balancesData: Array<typeof balances.$inferSelect> = [];

    if (anoLaboral && usuariosIds.length > 0) {
      balancesData = await db.query.balances.findMany({
        where: and(
          eq(balances.anoLaboralId, anoLaboral.id),
          eq(balances.tipoAusencia, 'vacaciones' as any),
          inArray(balances.usuarioId, usuariosIds)
        )
      });

      diasTotalesAsignados = balancesData.reduce((sum, b) => sum + Number(b.cantidadInicial) + Number(b.cantidadAcumulada), 0);
      diasTotalesUsados = balancesData.reduce((sum, b) => sum + Number(b.cantidadUsada), 0);
      diasTotalesDisponibles = balancesData.reduce((sum, b) => sum + Number(b.cantidadDisponible), 0);
    }

    const promedioUsoPorPersona = totalColaboradores > 0 && diasTotalesAsignados > 0
      ? Math.round((diasTotalesUsados / diasTotalesAsignados) * 100)
      : 0;

    // Solicitudes del período
    const primerDia = new Date(anio, mes - 1, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];

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

    const topUsuarios = balancesData
      .map((balance) => ({
        usuario: usuariosMap.get(balance.usuarioId) || 'Usuario sin nombre',
        diasAsignados: Number(balance.cantidadInicial) + Number(balance.cantidadAcumulada),
        diasUsados: Number(balance.cantidadUsada),
        diasPendientes: Number(balance.cantidadPendiente),
        diasDisponibles: Number(balance.cantidadDisponible),
      }))
      .filter((usuario) =>
        usuario.diasAsignados > 0 ||
        usuario.diasUsados > 0 ||
        usuario.diasPendientes > 0 ||
        usuario.diasDisponibles > 0
      )
      .sort((a, b) =>
        b.diasUsados - a.diasUsados ||
        b.diasAsignados - a.diasAsignados ||
        a.usuario.localeCompare(b.usuario)
      );

    const hoy = new Date().toISOString().split('T')[0];
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

    return NextResponse.json({
      success: true,
      data: {
        periodo: { mes, anio },
        resumen: {
          totalColaboradores,
          colaboradoresActivos,
          enVacacionesHoy,
          diasTotalesAsignados,
          diasTotalesUsados,
          diasTotalesDisponibles,
          promedioUsoPorPersona,
        },
        solicitudes: {
          total: solicitudesDept.length,
          aprobadas: solicitudesAprobadas,
          pendientes: solicitudesPendientes,
          rechazadas: solicitudesRechazadas,
        },
        proximasVacaciones,
        topUsuarios,
        historialDias: topUsuarios,
        detalle: solicitudesDept,
      },
    });

  } catch (error) {
    console.error("Error en reporte departamento:", error);
    return NextResponse.json(
      { success: false, error: "Error al generar reporte" },
      { status: 500 }
    );
  }
}
