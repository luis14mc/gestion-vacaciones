import { NextResponse } from "next/server";
import { getSession, tienePermiso } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/lib/db/schema";
import { desc, isNull, or, eq, and, inArray, sql } from "drizzle-orm";
import { resolverIdsEquipo } from "@/lib/domain/equipo-jefe";
import { withErrorHandler } from "@/lib/api-handler";
import { formatDate, parseSafeDate } from "@/lib/utils/date-format";

export const GET = withErrorHandler(async () => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const puedeVerTodo = tienePermiso(session, 'solicitudes.ver_todas');
  const esDirectorOJefe = session.roles?.some(r => r.codigo === 'JEFE' || r.codigo === 'DIRECTOR') || session.esDirector || session.esJefe;
  const esEmpleado = !puedeVerTodo && !esDirectorOJefe;

  const actividades: any[] = [];

  let solicitudesCondition: any = and(
    isNull(solicitudes.deletedAt),
    or(
      eq(solicitudes.estado, "pendiente_jefe"),
      eq(solicitudes.estado, "aprobada_rrhh"),
      eq(solicitudes.estado, "aprobada_jefe")
    )
  );

  if (esEmpleado) {
    solicitudesCondition = and(solicitudesCondition, eq(solicitudes.usuarioId, session.id));
  }
  else if (esDirectorOJefe && !puedeVerTodo) {
    const usuariosScopeIds = await resolverIdsEquipo({
      jefeId: session.id,
      esDirector: session.esDirector,
      departamentoId: session.departamentoId,
    });
    solicitudesCondition = usuariosScopeIds.length > 0
      ? and(solicitudesCondition, inArray(solicitudes.usuarioId, usuariosScopeIds))
      : and(solicitudesCondition, sql`false`);
  }

  const ultimasSolicitudes = await db
    .select({
      id: solicitudes.id,
      tipo: solicitudes.tipo,
      estado: solicitudes.estado,
      fechaInicio: solicitudes.fechaInicio,
      fechaFin: solicitudes.fechaFin,
      createdAt: solicitudes.createdAt,
      usuario: {
        id: usuarios.id,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
      },
    })
    .from(solicitudes)
    .innerJoin(usuarios, eq(solicitudes.usuarioId, usuarios.id))
    .where(solicitudesCondition)
    .orderBy(desc(solicitudes.createdAt))
    .limit(5);

  for (const solicitud of ultimasSolicitudes) {
    const fechaInicio = parseSafeDate(solicitud.fechaInicio);
    const fechaFin = parseSafeDate(solicitud.fechaFin);

    let dias = 0;
    if (fechaInicio && fechaFin) {
      dias =
        Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const fechaRango =
      solicitud.fechaInicio && solicitud.fechaFin
        ? `${formatDate(solicitud.fechaInicio)} - ${formatDate(solicitud.fechaFin)}`
        : "Sin fechas";

    actividades.push({
      id: `solicitud-${solicitud.id}`,
      tipo: ['aprobada_rrhh', 'finalizada'].includes(solicitud.estado) ? "aprobada" : "nueva_solicitud",
      titulo: ['aprobada_rrhh', 'finalizada'].includes(solicitud.estado) ? "Solicitud Aprobada" : "Nueva Solicitud",
      descripcion: `${solicitud.usuario.nombre} ${solicitud.usuario.apellido} - ${dias} días (${fechaRango})`,
      fecha: solicitud.createdAt,
    });
  }

  let usuariosCondition: any | null = null;
  if (!esEmpleado) {
    usuariosCondition = isNull(usuarios.deletedAt);

    if (esDirectorOJefe && !puedeVerTodo) {
      const usuariosScopeIds = await resolverIdsEquipo({
        jefeId: session.id,
        esDirector: session.esDirector,
        departamentoId: session.departamentoId,
      });
      usuariosCondition = usuariosScopeIds.length > 0
        ? and(usuariosCondition, inArray(usuarios.id, usuariosScopeIds))
        : and(usuariosCondition, sql`false`);
    }
  }

  if (usuariosCondition) {
    const ultimosUsuarios = await db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
        departamentoId: usuarios.departamentoId,
        createdAt: usuarios.createdAt,
      })
      .from(usuarios)
      .where(usuariosCondition)
      .orderBy(desc(usuarios.createdAt))
      .limit(3);

    for (const usuario of ultimosUsuarios) {
      actividades.push({
        id: `usuario-${usuario.id}`,
        tipo: "nuevo_usuario",
        titulo: "Nuevo Usuario",
        descripcion: `${usuario.nombre} ${usuario.apellido}${usuario.departamentoId ? ` - Dept. ID ${usuario.departamentoId}` : ""}`,
        fecha: usuario.createdAt,
      });
    }
  }

  actividades.sort((a, b) => {
    const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
    const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
    return dateB - dateA;
  });

  const actividadesFinales = actividades.slice(0, 5);

  return NextResponse.json({
    success: true,
    data: actividadesFinales,
  });
});
