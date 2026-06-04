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

    if (anoLaboral && usuariosIds.length > 0) {
      const balancesData = await db.query.balances.findMany({
        where: and(
          eq(balances.anoLaboralId, anoLaboral.id),
          eq(balances.tipoAusencia, 'vacaciones' as any),
          inArray(balances.usuarioId, usuariosIds)
        )
      });

      diasTotalesAsignados = balancesData.reduce((sum, b) => sum + Number(b.cantidadInicial), 0);
      diasTotalesUsados = balancesData.reduce((sum, b) => sum + Number(b.cantidadUsada), 0);
    }

    const diasTotalesDisponibles = diasTotalesAsignados - diasTotalesUsados;
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
          sql`${solicitudes.fechaFin} >= ${primerDia}`
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

    return NextResponse.json({
      success: true,
      data: {
        periodo: { mes, anio },
        resumen: {
          totalColaboradores,
          colaboradoresActivos,
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
