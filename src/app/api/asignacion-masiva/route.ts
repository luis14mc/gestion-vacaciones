import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { balances, usuarios } from "@/lib/db/schema";
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
    const { departamentoId, tipoAusencia, anoLaboralId, cantidadAsignada, operacion = "reemplazar" } = body;

    if (!departamentoId || !tipoAusencia || !anoLaboralId || cantidadAsignada === undefined) {
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
        const balanceExistente = await db.query.balances.findFirst({
          where: and(
            eq(balances.usuarioId, usuario.id),
            eq(balances.tipoAusencia, tipoAusencia as any),
            eq(balances.anoLaboralId, anoLaboralId)
          )
        });

        let cantidadFinal = Number.parseFloat(cantidadAsignada.toString());

        if (balanceExistente) {
          // Actualizar existente
          const balanceActual = balanceExistente;
          
          // Calcular cantidad final según operación
          if (operacion === "sumar") {
            const cantidadActual = Number.parseFloat(balanceActual.cantidadInicial);
            cantidadFinal = cantidadActual + cantidadFinal;
          } else if (operacion === "restar") {
            const cantidadActual = Number.parseFloat(balanceActual.cantidadInicial);
            cantidadFinal = cantidadActual - cantidadFinal;
            if (cantidadFinal < 0) cantidadFinal = 0;
          }

          await db
            .update(balances)
            .set({
              cantidadInicial: cantidadFinal.toString(),
              version: balanceActual.version + 1,
              updatedAt: new Date().toISOString()
            })
            .where(eq(balances.id, balanceActual.id));
          usuariosActualizados++;
        } else {
          // Crear nuevo (solo si es reemplazar o sumar, restar no tiene sentido si no existe)
          if (operacion === "restar") {
            // No crear balance si se intenta restar y no existe
            continue;
          }

          await db.insert(balances).values({
            usuarioId: usuario.id,
            tipoAusencia: tipoAusencia as any,
            anoLaboralId,
            cantidadInicial: cantidadFinal.toString()
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
