import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { usuarios, balances, anosLaborales } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

function calcularDiasSegunAntiguedad(fechaIngreso: string): number {
  const ingreso = new Date(fechaIngreso);
  const hoy = new Date();
  
  let anos = hoy.getFullYear() - ingreso.getFullYear();
  const mes = hoy.getMonth() - ingreso.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < ingreso.getDate())) {
    anos--;
  }

  if (anos < 1) return 0; // Menos de 1 año no recibe días completos automáticamente (o prorrateo según política)
  if (anos === 1) return 10;
  if (anos === 2) return 12;
  if (anos === 3) return 15;
  return 20; // 4 años o más
}

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session || (!session.esRrhh && !session.esAdmin)) {
      return NextResponse.json({ success: false, error: 'No autorizado. Se requiere rol RRHH o Administrador.' }, { status: 403 });
    }

    // Obtener año laboral activo
    const [anoLaboral] = await db
      .select()
      .from(anosLaborales)
      .where(eq(anosLaborales.activo, true))
      .limit(1);

    if (!anoLaboral) {
      return NextResponse.json({ success: false, error: 'No hay un año laboral activo.' }, { status: 400 });
    }

    // Obtener todos los usuarios activos
    const usuariosActivos = await db
      .select({
        id: usuarios.id,
        fechaIngreso: usuarios.fechaIngreso,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido
      })
      .from(usuarios)
      .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)));

    let asignados = 0;
    let actualizados = 0;
    let omitidos = 0;

    // Atomico: si falla cualquier fila, no queda asignacion parcial.
    await db.transaction(async (tx) => {
      for (const user of usuariosActivos) {
        if (!user.fechaIngreso) {
          omitidos++;
          continue;
        }

        const diasAsignados = calcularDiasSegunAntiguedad(user.fechaIngreso);
        if (diasAsignados === 0) {
          omitidos++;
          continue;
        }

        // Buscar si ya tiene balance
        const [balanceExistente] = await tx
          .select()
          .from(balances)
          .where(
            and(
              eq(balances.usuarioId, user.id),
              eq(balances.anoLaboralId, anoLaboral.id),
              eq(balances.tipoAusencia, 'vacaciones')
            )
          )
          .limit(1);

        if (balanceExistente) {
          // cantidad_disponible la recalcula el trigger de BD a partir de
          // inicial + acumulada - usada - pendiente.
          await tx
            .update(balances)
            .set({
              cantidadInicial: diasAsignados.toString(),
              updatedAt: new Date().toISOString(),
              version: balanceExistente.version + 1
            })
            .where(eq(balances.id, balanceExistente.id));
          actualizados++;
        } else {
          // Crear nuevo balance (el trigger calcula cantidad_disponible)
          await tx
            .insert(balances)
            .values({
              usuarioId: user.id,
              anoLaboralId: anoLaboral.id,
              tipoAusencia: 'vacaciones',
              cantidadInicial: diasAsignados.toString(),
              cantidadUsada: '0',
              cantidadPendiente: '0',
            });
          asignados++;
        }
      }
    });

    const { ipAddress, userAgent } = datosPeticion(request);
    await registrarAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      tablaAfectada: 'balances',
      detalles: { evento: 'asignar_dias_antiguedad', asignados, actualizados, omitidos },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Asignación de días completada',
      resultados: { asignados, actualizados, omitidos }
    });

});
