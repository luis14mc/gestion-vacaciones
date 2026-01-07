import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes, balancesAusencias, departamentos, auditoria } from "@/lib/db/schema";
import { eq, isNull, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Solo Admin y RRHH pueden exportar
    if (!session.user.esAdmin && !session.user.esRrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo") as string;
    const formato = searchParams.get("formato") || "excel";
    const incluirEliminados = searchParams.get("incluirEliminados") === "true";
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    let datos: any[] = [];
    let nombreArchivo = "";

    switch (tipo) {
      case "usuarios":
        datos = await exportarUsuarios(incluirEliminados);
        nombreArchivo = `usuarios_${new Date().getTime()}`;
        break;
      case "solicitudes":
        datos = await exportarSolicitudes(incluirEliminados, fechaInicio, fechaFin);
        nombreArchivo = `solicitudes_${new Date().getTime()}`;
        break;
      case "balances":
        datos = await exportarBalances(incluirEliminados);
        nombreArchivo = `balances_${new Date().getTime()}`;
        break;
      case "departamentos":
        datos = await exportarDepartamentos(incluirEliminados);
        nombreArchivo = `departamentos_${new Date().getTime()}`;
        break;
      case "auditoria":
        datos = await exportarAuditoria(fechaInicio, fechaFin);
        nombreArchivo = `auditoria_${new Date().getTime()}`;
        break;
      case "completo":
        return await exportarCompleto(incluirEliminados);
      default:
        return NextResponse.json(
          { success: false, error: "Tipo de exportación no válido" },
          { status: 400 }
        );
    }

    // Generar el archivo según el formato
    if (formato === "json") {
      return new NextResponse(JSON.stringify(datos, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${nombreArchivo}.json"`,
        },
      });
    } else if (formato === "csv") {
      const csv = convertirACSV(datos);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nombreArchivo}.csv"`,
        },
      });
    } else {
      // Excel - requiere instalación de librería
      return NextResponse.json(
        { 
          success: false, 
          error: "Formato Excel no implementado. Instala: pnpm add xlsx",
          data: datos // Devolver datos en JSON temporalmente
        },
        { status: 501 }
      );
    }
  } catch (error) {
    console.error("Error en exportación:", error);
    return NextResponse.json(
      { success: false, error: "Error al exportar datos" },
      { status: 500 }
    );
  }
}

async function exportarUsuarios(incluirEliminados: boolean) {
  const condiciones = incluirEliminados ? undefined : isNull(usuarios.deletedAt);
  
  const resultado = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      departamento_id: usuarios.departamentoId,
      cargo: usuarios.cargo,
      es_jefe: usuarios.esJefe,
      es_rrhh: usuarios.esRrhh,
      es_admin: usuarios.esAdmin,
      activo: usuarios.activo,
      fecha_ingreso: usuarios.fechaIngreso,
      created_at: usuarios.createdAt,
      deleted_at: usuarios.deletedAt,
    })
    .from(usuarios)
    .where(condiciones)
    .orderBy(usuarios.apellido, usuarios.nombre);

  return resultado;
}

async function exportarSolicitudes(incluirEliminados: boolean, fechaInicio?: string | null, fechaFin?: string | null) {
  const condiciones = [];
  
  if (!incluirEliminados) {
    condiciones.push(isNull(solicitudes.deletedAt));
  }

  if (fechaInicio) {
    condiciones.push(gte(solicitudes.createdAt, new Date(fechaInicio)));
  }

  if (fechaFin) {
    const fechaFinDate = new Date(fechaFin);
    fechaFinDate.setHours(23, 59, 59, 999);
    condiciones.push(lte(solicitudes.createdAt, fechaFinDate));
  }

  const whereClause = condiciones.length > 0 ? and(...condiciones) : undefined;

  const resultado = await db
    .select()
    .from(solicitudes)
    .where(whereClause)
    .orderBy(solicitudes.createdAt);

  return resultado;
}

async function exportarBalances(incluirEliminados: boolean) {
  const resultado = await db
    .select()
    .from(balancesAusencias)
    .orderBy(balancesAusencias.usuarioId, balancesAusencias.anio);

  return resultado;
}

async function exportarDepartamentos(incluirEliminados: boolean) {
  const condiciones = incluirEliminados ? undefined : isNull(departamentos.deletedAt);
  
  const resultado = await db
    .select()
    .from(departamentos)
    .where(condiciones)
    .orderBy(departamentos.nombre);

  return resultado;
}

async function exportarAuditoria(fechaInicio?: string | null, fechaFin?: string | null) {
  const condiciones = [];

  if (fechaInicio) {
    condiciones.push(gte(auditoria.fechaCreacion, new Date(fechaInicio)));
  }

  if (fechaFin) {
    const fechaFinDate = new Date(fechaFin);
    fechaFinDate.setHours(23, 59, 59, 999);
    condiciones.push(lte(auditoria.fechaCreacion, fechaFinDate));
  }

  const whereClause = condiciones.length > 0 ? and(...condiciones) : undefined;

  const resultado = await db
    .select()
    .from(auditoria)
    .where(whereClause)
    .orderBy(auditoria.fechaCreacion);

  return resultado;
}

async function exportarCompleto(incluirEliminados: boolean) {
  // Para exportación completa, necesitaríamos generar un ZIP
  // Por ahora retornamos un error con instrucciones
  return NextResponse.json(
    { 
      success: false, 
      error: "Exportación completa no implementada. Requiere: pnpm add archiver"
    },
    { status: 501 }
  );
}

function convertirACSV(datos: any[]): string {
  if (datos.length === 0) return "";

  // Obtener headers
  const headers = Object.keys(datos[0]);
  
  // Crear filas
  const filas = datos.map(obj => {
    return headers.map(header => {
      const valor = obj[header];
      // Escapar comillas y wrap en comillas si contiene comas
      if (valor === null || valor === undefined) return "";
      const valorStr = String(valor);
      if (valorStr.includes(",") || valorStr.includes('"') || valorStr.includes("\n")) {
        return `"${valorStr.replace(/"/g, '""')}"`;
      }
      return valorStr;
    }).join(",");
  });

  // Combinar headers y filas
  return [headers.join(","), ...filas].join("\n");
}
