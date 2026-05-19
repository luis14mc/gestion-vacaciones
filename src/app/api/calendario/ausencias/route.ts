/**
 * API: GET /api/calendario/ausencias
 * Retorna ausencias aprobadas agrupadas por fecha para un mes.
 * Query: mes (1-12), anio (YYYY)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const now = new Date();
    const mes = parseInt(searchParams.get('mes') || String(now.getMonth() + 1));
    const anio = parseInt(searchParams.get('anio') || String(now.getFullYear()));
    const departamentoId = searchParams.get('departamentoId');

    if (mes < 1 || mes > 12 || anio < 2020 || anio > 2100) {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Primer y último día del mes
    const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];

    const query = sql`
      SELECT
        s.id,
        s.codigo,
        s.tipo,
        s.fecha_inicio,
        s.fecha_fin,
        s.dias_solicitados,
        s.estado,
        u.id AS usuario_id,
        u.nombre || ' ' || u.apellido AS nombre_completo,
        u.departamento_id,
        COALESCE(d.nombre, 'Sin asignar') AS departamento
      FROM solicitudes s
      INNER JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      WHERE s.estado IN ('aprobada_rrhh', 'finalizada')
        AND s.fecha_inicio IS NOT NULL
        AND s.fecha_fin IS NOT NULL
        AND s.fecha_inicio <= ${ultimoDia}
        AND s.fecha_fin >= ${primerDia}
        ${departamentoId ? sql`AND u.departamento_id = ${parseInt(departamentoId)}` : sql``}
      ORDER BY s.fecha_inicio
    `;

    const ausencias = await db.execute(query) as any[];

    // Agrupar por fecha (expandir rangos)
    const diasMes: Record<string, Array<{
      id: number;
      codigo: string;
      tipo: string;
      usuario: string;
      departamento: string;
    }>> = {};

    for (const a of ausencias) {
      const inicio = new Date(a.fecha_inicio);
      const fin = new Date(a.fecha_fin);
      const mesInicio = new Date(anio, mes - 1, 1);
      const mesFin = new Date(anio, mes, 0);

      // Iterar cada día del rango dentro del mes
      const dStart = inicio < mesInicio ? mesInicio : inicio;
      const dEnd = fin > mesFin ? mesFin : fin;

      const current = new Date(dStart);
      while (current <= dEnd) {
        const key = current.toISOString().split('T')[0];
        if (!diasMes[key]) diasMes[key] = [];
        diasMes[key].push({
          id: a.id,
          codigo: a.codigo,
          tipo: a.tipo,
          usuario: a.nombre_completo,
          departamento: a.departamento,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mes,
        anio,
        primerDia,
        ultimoDia,
        totalAusencias: ausencias.length,
        dias: diasMes,
      },
    });
  } catch (error) {
    console.error('Error calendario:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
