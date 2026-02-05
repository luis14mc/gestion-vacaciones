import { NextResponse } from "next/server";
import { getSession, tienePermiso } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes } from "@/core/infrastructure/database/schema";
import { desc, isNull, or, eq, and, inArray } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Verificar autenticación
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Determinar scope de actividades según permisos
    const puedeVerTodo = tienePermiso(session, 'vacaciones.solicitudes.ver_todas');
    const esJefe = session.roles?.some(r => r.codigo === 'JEFE');
    const esEmpleado = !puedeVerTodo && !esJefe;

    const actividades: any[] = [];

    // 3. Construir condiciones para solicitudes
    let solicitudesCondition: any = and(
      isNull(solicitudes.deletedAt),
      or(
        eq(solicitudes.estado, "pendiente"),
        eq(solicitudes.estado, "aprobada"),
        eq(solicitudes.estado, "aprobada_jefe")
      )
    );

    // Si es empleado, solo sus propias solicitudes
    if (esEmpleado) {
      solicitudesCondition = and(solicitudesCondition, eq(solicitudes.usuarioId, session.id));
    }
    // Si es jefe, solo su departamento
    else if (esJefe && session.departamentoId && !puedeVerTodo) {
      const usuariosDept = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(
          eq(usuarios.departamentoId, session.departamentoId),
          isNull(usuarios.deletedAt)
        ));
      const usuariosIds = usuariosDept.map(u => u.id);
      if (usuariosIds.length > 0) {
        solicitudesCondition = and(solicitudesCondition, inArray(solicitudes.usuarioId, usuariosIds));
      }
    }

    // Obtener últimas solicitudes (aprobadas, pendientes, creadas recientemente)
    const ultimasSolicitudes = await db
      .select({
        id: solicitudes.id,
        tipo: solicitudes.tipoAusenciaId,
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

    // Convertir solicitudes a actividades
    for (const solicitud of ultimasSolicitudes) {
      const fechaInicio = solicitud.fechaInicio ? new Date(solicitud.fechaInicio) : null;
      const fechaFin = solicitud.fechaFin ? new Date(solicitud.fechaFin) : null;
      
      let dias = 0;
      if (fechaInicio && fechaFin) {
        dias = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      const fechaRango = fechaInicio && fechaFin
        ? `${fechaInicio.toLocaleDateString("es-ES", { month: "short", day: "numeric" })}-${fechaFin.toLocaleDateString("es-ES", { day: "numeric" })}`
        : "Sin fechas";

      actividades.push({
        id: `solicitud-${solicitud.id}`,
        tipo: solicitud.estado === "aprobada" ? "aprobada" : "nueva_solicitud",
        titulo: solicitud.estado === "aprobada" ? "Solicitud Aprobada" : "Nueva Solicitud",
        descripcion: `${solicitud.usuario.nombre} ${solicitud.usuario.apellido} - ${dias} días (${fechaRango})`,
        fecha: solicitud.createdAt,
      });
    }

    // Obtener últimos usuarios creados
    const ultimosUsuarios = await db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
        departamentoId: usuarios.departamentoId,
        createdAt: usuarios.createdAt,
      })
      .from(usuarios)
      .where(isNull(usuarios.deletedAt))
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

    // Ordenar todas las actividades por fecha
    actividades.sort((a, b) => {
      const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
      const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
      return dateB - dateA;
    });

    // Tomar solo las primeras 5
    const actividadesFinales = actividades.slice(0, 5);

    return NextResponse.json({
      success: true,
      data: actividadesFinales,
    });
  } catch (error) {
    console.error("Error obteniendo actividad reciente:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener actividad reciente" },
      { status: 500 }
    );
  }
}
