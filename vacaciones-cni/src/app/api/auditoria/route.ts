import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auditoria, usuarios } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Solo Admin y RRHH pueden ver auditoría
    if (!session.user.esAdmin && !session.user.esRrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const pagina = Number.parseInt(searchParams.get("pagina") || "1");
    const limite = Number.parseInt(searchParams.get("limite") || "50");
    const accion = searchParams.get("accion");
    const tabla = searchParams.get("tabla");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    const offset = (pagina - 1) * limite;

    // Construir condiciones
    const condiciones = [];

    if (accion && accion !== "todas") {
      condiciones.push(eq(auditoria.accion, accion));
    }

    if (tabla && tabla !== "todas") {
      condiciones.push(eq(auditoria.tablaAfectada, tabla));
    }

    if (fechaInicio) {
      condiciones.push(gte(auditoria.fechaCreacion, new Date(fechaInicio)));
    }

    if (fechaFin) {
      const fechaFinDate = new Date(fechaFin);
      fechaFinDate.setHours(23, 59, 59, 999);
      condiciones.push(lte(auditoria.fechaCreacion, fechaFinDate));
    }

    // Consulta con join a usuarios
    const whereClause = condiciones.length > 0 ? and(...condiciones) : undefined;

    const registros = await db
      .select({
        id: auditoria.id,
        usuario_id: auditoria.usuarioId,
        accion: auditoria.accion,
        tabla_afectada: auditoria.tablaAfectada,
        registro_id: auditoria.registroId,
        detalles: auditoria.detalles,
        ip_address: auditoria.ipAddress,
        user_agent: auditoria.userAgent,
        fecha_creacion: auditoria.fechaCreacion,
        usuario: {
          id: usuarios.id,
          nombre: usuarios.nombre,
          apellido: usuarios.apellido,
          email: usuarios.email,
        },
      })
      .from(auditoria)
      .innerJoin(usuarios, eq(auditoria.usuarioId, usuarios.id))
      .where(whereClause)
      .orderBy(desc(auditoria.fechaCreacion))
      .limit(limite)
      .offset(offset);

    // Contar total de registros
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditoria)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);
    const totalPaginas = Math.ceil(total / limite);

    return NextResponse.json({
      success: true,
      data: registros,
      paginaActual: pagina,
      totalPaginas,
      totalRegistros: total,
      registrosPorPagina: limite,
    });
  } catch (error) {
    console.error("Error en GET /api/auditoria:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener registros de auditoría" },
      { status: 500 }
    );
  }
}
