import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { solicitudes, usuarios } from '@/lib/db/schema';
import { calcularElegibilidadCumpleanos, ESTADOS_DIA_CUMPLEANOS_ACTIVOS } from '@/lib/domain/cumpleanos';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const [usuario] = await db
      .select({ fechaNacimiento: usuarios.fechaNacimiento })
      .from(usuarios)
      .where(eq(usuarios.id, session.id))
      .limit(1);

    const anioActual = new Date().getFullYear();

    const [existente] = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(
        and(
          eq(solicitudes.usuarioId, session.id),
          eq(solicitudes.tipo, 'dia_cumpleanos'),
          inArray(solicitudes.estado, [...ESTADOS_DIA_CUMPLEANOS_ACTIVOS]),
          isNull(solicitudes.deletedAt),
          sql`EXTRACT(YEAR FROM ${solicitudes.fechaInicio}) = ${anioActual}`
        )
      )
      .limit(1);

    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: usuario?.fechaNacimiento,
      yaTomado: Boolean(existente),
    });

    return NextResponse.json({
      success: true,
      data: elegibilidad,
    });
  } catch (error) {
    console.error('Error consultando elegibilidad de cumpleaños:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar elegibilidad de cumpleaños' },
      { status: 500 }
    );
  }
}
