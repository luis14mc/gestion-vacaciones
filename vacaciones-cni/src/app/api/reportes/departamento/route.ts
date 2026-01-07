import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, balancesAusencias, solicitudes } from "@/lib/db/schema";
import { eq, and, sql, gte, lte, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get("mes") || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get("anio") || String(new Date().getFullYear()));

    // Filtro de departamento (solo para jefes)
    let departamentoCondition = undefined;
    if (session.user.esJefe && !session.user.esAdmin && !session.user.esRrhh) {
      if (session.user.departamentoId) {
        departamentoCondition = eq(usuarios.departamentoId, session.user.departamentoId);
      }
    }

    // Obtener usuarios del departamento
    const usuariosDept = await db.query.usuarios.findMany({
      where: departamentoCondition ? and(isNull(usuarios.deletedAt), departamentoCondition) : isNull(usuarios.deletedAt)
    });

    const usuariosIds = usuariosDept.map(u => u.id);
    const totalColaboradores = usuariosDept.length;
    const colaboradoresActivos = usuariosDept.filter(u => u.activo).length;

    // Balances de días
    const balances = await db.query.balancesAusencias.findMany({
      where: and(
        sql`${balancesAusencias.usuarioId} IN ${usuariosIds}`,
        eq(balancesAusencias.estado, 'activo')
      )
    });

    const diasTotalesAsignados = balances.reduce((sum, b) => sum + Number(b.cantidadAsignada), 0);
    const diasTotalesUsados = balances.reduce((sum, b) => sum + Number(b.cantidadUtilizada), 0);
    const diasTotalesDisponibles = diasTotalesAsignados - diasTotalesUsados;
    const promedioUsoPorPersona = totalColaboradores > 0 
      ? Math.round((diasTotalesUsados / diasTotalesAsignados) * 100) 
      : 0;

    // Solicitudes del período
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);

    const solicitudesDept = await db
      .select({
        id: solicitudes.id,
        usuarioId: solicitudes.usuarioId,
        estado: solicitudes.estado,
        fechaInicio: solicitudes.fechaInicio,
        fechaFin: solicitudes.fechaFin,
        dias: solicitudes.cantidad,
        usuario: sql<string>`${usuarios.nombre} || ' ' || ${usuarios.apellido}`,
      })
      .from(solicitudes)
      .leftJoin(usuarios, eq(solicitudes.usuarioId, usuarios.id))
      .where(
        and(
          sql`${solicitudes.usuarioId} IN ${usuariosIds}`,
          sql`${solicitudes.fechaInicio} <= ${ultimoDia}`,
          sql`${solicitudes.fechaFin} >= ${primerDia}`
        )
      );

    const solicitudesPendientes = solicitudesDept.filter(s => s.estado === 'pendiente').length;
    const solicitudesAprobadas = solicitudesDept.filter(s => 
      s.estado === 'aprobada' || s.estado === 'aprobada_jefe' || s.estado === 'en_uso'
    ).length;
    const solicitudesRechazadas = solicitudesDept.filter(s => 
      s.estado === 'rechazada'
    ).length;

    // En vacaciones hoy
    const hoy = new Date();
    const enVacacionesHoy = solicitudesDept.filter(s => 
      s.estado === 'en_uso' &&
      new Date(s.fechaInicio) <= hoy &&
      new Date(s.fechaFin) >= hoy
    ).length;

    // Próximas vacaciones (próximos 30 días)
    const dentro30dias = new Date();
    dentro30dias.setDate(dentro30dias.getDate() + 30);

    const proximasVacaciones = solicitudesDept
      .filter(s => 
        (s.estado === 'aprobada' || s.estado === 'aprobada_jefe') &&
        new Date(s.fechaInicio) >= hoy &&
        new Date(s.fechaInicio) <= dentro30dias
      )
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
      .slice(0, 5)
      .map(s => ({
        usuario: s.usuario,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        dias: s.dias
      }));

    // Top usuarios por uso
    const usuariosConBalance = await Promise.all(
      usuariosDept.slice(0, 10).map(async (usuario) => {
        const balance = balances.find(b => b.usuarioId === usuario.id);
        const diasUsados = balance ? Number(balance.cantidadUtilizada) : 0;
        const diasAsignados = balance ? Number(balance.cantidadAsignada) : 0;
        const diasDisponibles = diasAsignados - diasUsados;

        return {
          usuario: `${usuario.nombre} ${usuario.apellido}`,
          diasUsados,
          diasDisponibles
        };
      })
    );

    const topUsuarios = usuariosConBalance
      .sort((a, b) => b.diasUsados - a.diasUsados)
      .slice(0, 5);

    const reporte = {
      totalColaboradores,
      colaboradoresActivos,
      enVacacionesHoy,
      solicitudesPendientes,
      solicitudesAprobadas,
      solicitudesRechazadas,
      diasTotalesAsignados,
      diasTotalesUsados,
      diasTotalesDisponibles,
      promedioUsoPorPersona,
      proximasVacaciones,
      topUsuarios
    };

    return NextResponse.json({
      success: true,
      reporte
    });
  } catch (error) {
    console.error("Error generando reporte:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
