import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, solicitudes, balances, departamentos } from "@/lib/db/schema";
import { eq, isNull, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!session.esAdmin && !session.esRrhh) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo") as string;
    const formato = searchParams.get("formato") || "json";
    const incluirEliminados = searchParams.get("incluirEliminados") === "true";
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    let datos: any[] = [];
    let nombreArchivo = "";

    switch (tipo) {
      case "usuarios":
        datos = await exportarUsuarios(incluirEliminados);
        nombreArchivo = `usuarios_${Date.now()}`;
        break;
      case "solicitudes":
        datos = await exportarSolicitudes(incluirEliminados, fechaInicio, fechaFin);
        nombreArchivo = `solicitudes_${Date.now()}`;
        break;
      case "balances":
        datos = await exportarBalances();
        nombreArchivo = `balances_${Date.now()}`;
        break;
      case "departamentos":
        datos = await exportarDepartamentos(incluirEliminados);
        nombreArchivo = `departamentos_${Date.now()}`;
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Tipo de exportación no válido" },
          { status: 400 }
        );
    }

    if (formato === "csv") {
      const csv = convertirACSV(datos);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nombreArchivo}.csv"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(datos, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.json"`,
      },
    });
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
  return await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      departamento_id: usuarios.departamentoId,
      cargo: usuarios.cargo,
      activo: usuarios.activo,
      fecha_ingreso: usuarios.fechaIngreso,
      created_at: usuarios.createdAt,
    })
    .from(usuarios)
    .where(condiciones)
    .orderBy(usuarios.apellido, usuarios.nombre);
}

async function exportarSolicitudes(incluirEliminados: boolean, fechaInicio?: string | null, fechaFin?: string | null) {
  const condiciones = [];
  
  if (!incluirEliminados) {
    condiciones.push(isNull(solicitudes.deletedAt));
  }

  if (fechaInicio) {
    condiciones.push(gte(solicitudes.createdAt, fechaInicio));
  }

  if (fechaFin) {
    condiciones.push(lte(solicitudes.createdAt, fechaFin));
  }

  const whereClause = condiciones.length > 0 ? and(...condiciones) : undefined;
  return await db.select().from(solicitudes).where(whereClause).orderBy(solicitudes.createdAt);
}

async function exportarBalances() {
  return await db.select().from(balances).orderBy(balances.usuarioId);
}

async function exportarDepartamentos(incluirEliminados: boolean) {
  const condiciones = incluirEliminados ? undefined : isNull(departamentos.deletedAt);
  return await db.select().from(departamentos).where(condiciones).orderBy(departamentos.nombre);
}

function convertirACSV(datos: any[]): string {
  if (datos.length === 0) return "";
  const headers = Object.keys(datos[0]);
  const rows = datos.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
