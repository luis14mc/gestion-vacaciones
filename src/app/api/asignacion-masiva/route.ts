import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { getSession } from "@/lib/auth";
import { registrarAuditoria, datosPeticion } from "@/services/auditoria.service";
import { db } from "@/lib/db";
import { balances, usuarios, anosLaborales } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { asignacionMasivaSchema } from "@/lib/validation/api-schemas";

class VersionConflictError extends Error {
  constructor() {
    super('CONFLICTO_VERSION');
    this.name = 'VersionConflictError';
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (!session.esAdmin && !session.esRrhh) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = asignacionMasivaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { departamentoId, tipoAusencia, cantidadAsignada, operacion } = parsed.data;
    let anoLaboralId = parsed.data.anoLaboralId;
    const anio = parsed.data.anio;

    if (!anoLaboralId && anio) {
      const anoResult = await db
        .select({ id: anosLaborales.id })
        .from(anosLaborales)
        .where(eq(anosLaborales.ano, anio))
        .limit(1);

      const [anoLaboral] = anoResult;
      if (!anoLaboral) {
        return NextResponse.json(
          { success: false, error: `No existe año laboral configurado para ${anio}` },
          { status: 400 }
        );
      }
      anoLaboralId = anoLaboral.id;
    }

    if (!anoLaboralId) {
      return NextResponse.json(
        { success: false, error: "Se requiere anoLaboralId o anio" },
        { status: 400 }
      );
    }

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

    try {
      await db.transaction(async (tx) => {
        for (const usuario of usuariosDepartamento) {
          const balanceExistente = await tx.query.balances.findFirst({
            where: and(
              eq(balances.usuarioId, usuario.id),
              eq(balances.tipoAusencia, tipoAusencia as any),
              eq(balances.anoLaboralId, anoLaboralId)
            )
          });

          let cantidadFinal = cantidadAsignada;

          if (balanceExistente) {
            const balanceActual = balanceExistente;

            if (operacion === "sumar") {
              cantidadFinal = Number.parseFloat(balanceActual.cantidadInicial) + cantidadFinal;
            } else if (operacion === "restar") {
              cantidadFinal = Number.parseFloat(balanceActual.cantidadInicial) - cantidadFinal;
              if (cantidadFinal < 0) cantidadFinal = 0;
            }

            const updated = await tx
              .update(balances)
              .set({
                cantidadInicial: cantidadFinal.toFixed(2),
                version: balanceActual.version + 1,
                updatedAt: new Date().toISOString()
              })
              .where(and(
                eq(balances.id, balanceActual.id),
                eq(balances.version, balanceActual.version)
              ))
              .returning({ id: balances.id });

            if (updated.length === 0) {
              throw new VersionConflictError();
            }

            usuariosActualizados++;
          } else {
            if (operacion === "restar") {
              continue;
            }

            const cantidadStr = cantidadFinal.toFixed(2);
            await tx.insert(balances).values({
              usuarioId: usuario.id,
              tipoAusencia: tipoAusencia as any,
              anoLaboralId,
              cantidadInicial: cantidadStr,
            });
            usuariosCreados++;
          }
        }
      });
    } catch (error) {
      if (error instanceof VersionConflictError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Los datos cambiaron mientras procesabas la asignación. Recarga e intenta de nuevo.',
          },
          { status: 409 }
        );
      }
      throw error;
    }

    const totalProcesados = usuariosCreados + usuariosActualizados;

    const { ipAddress, userAgent } = datosPeticion(request);
    await registrarAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      tablaAfectada: 'balances',
      detalles: {
        evento: 'asignacion_masiva',
        departamentoId,
        tipoAusencia,
        cantidadAsignada,
        operacion,
        usuariosCreados,
        usuariosActualizados,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Asignación masiva completada: ${usuariosCreados} creados, ${usuariosActualizados} actualizados`,
      usuariosAfectados: totalProcesados,
      usuariosCreados,
      usuariosActualizados,
    });
});
