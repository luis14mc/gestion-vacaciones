import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { balancesAusencias, usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    if (!session.user.esAdmin && !session.user.esRrhh) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { departamentoId, tipoAusenciaId, anio, cantidadAsignada, operacion = "reemplazar", fechaVencimiento, notas } = body;

    if (!departamentoId || !tipoAusenciaId || !anio || cantidadAsignada === undefined) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Obtener todos los usuarios activos del departamento
    const usuariosDepartamento = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre, apellido: usuarios.apellido })
      .from(usuarios)
      .where(and(eq(usuarios.departamentoId, departamentoId), eq(usuarios.activo, true)));

    if (usuariosDepartamento.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay usuarios activos en este departamento" },
        { status: 400 }
      );
    }

    let usuariosCreados = 0;
    let usuariosActualizados = 0;
    const errores: string[] = [];

    // Procesar cada usuario
    for (const usuario of usuariosDepartamento) {
      try {
        // Verificar si ya existe un balance para este usuario/tipo/año
        const balanceExistente = await db
          .select()
          .from(balancesAusencias)
          .where(
            and(
              eq(balancesAusencias.usuarioId, usuario.id),
              eq(balancesAusencias.tipoAusenciaId, tipoAusenciaId),
              eq(balancesAusencias.anio, anio)
            )
          )
          .limit(1);

        let cantidadFinal = Number.parseFloat(cantidadAsignada.toString());

        if (balanceExistente.length > 0) {
          // Actualizar existente
          const balanceActual = balanceExistente[0];
          
          // Calcular cantidad final según operación
          if (operacion === "sumar") {
            const cantidadActual = Number.parseFloat(balanceActual.cantidadAsignada);
            cantidadFinal = cantidadActual + cantidadFinal;
          } else if (operacion === "restar") {
            const cantidadActual = Number.parseFloat(balanceActual.cantidadAsignada);
            cantidadFinal = cantidadActual - cantidadFinal;
            if (cantidadFinal < 0) cantidadFinal = 0;
          }
          // Si es "reemplazar", cantidadFinal ya tiene el valor correcto

          await db
            .update(balancesAusencias)
            .set({
              cantidadAsignada: cantidadFinal.toString(),
              fechaVencimiento: fechaVencimiento || null,
              notas: notas || null,
              version: balanceActual.version + 1,
            })
            .where(eq(balancesAusencias.id, balanceActual.id));
          usuariosActualizados++;
        } else {
          // Crear nuevo (solo si es reemplazar o sumar, restar no tiene sentido si no existe)
          if (operacion === "restar") {
            // No crear balance si se intenta restar y no existe
            continue;
          }

          await db.insert(balancesAusencias).values({
            usuarioId: usuario.id,
            tipoAusenciaId,
            anio,
            cantidadAsignada: cantidadFinal.toString(),
            cantidadUtilizada: "0",
            cantidadPendiente: "0",
            fechaVencimiento: fechaVencimiento || null,
            notas: notas || null,
          });
          usuariosCreados++;
        }
      } catch (error) {
        console.error(`Error procesando usuario ${usuario.id}:`, error);
        errores.push(`${usuario.nombre} ${usuario.apellido}`);
      }
    }

    const totalProcesados = usuariosCreados + usuariosActualizados;

    return NextResponse.json({
      success: true,
      message: `Asignación masiva completada: ${usuariosCreados} creados, ${usuariosActualizados} actualizados`,
      usuariosAfectados: totalProcesados,
      usuariosCreados,
      usuariosActualizados,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (error) {
    console.error("Error en POST /api/asignacion-masiva:", error);
    return NextResponse.json(
      { success: false, error: "Error en la asignación masiva" },
      { status: 500 }
    );
  }
}
