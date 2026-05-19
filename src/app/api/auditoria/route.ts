import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { registrosAuditoria, usuarios } from '@/lib/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!session.esAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const pagina = parseInt(searchParams.get('pagina') || '1');
    const limite = parseInt(searchParams.get('limite') || '50');
    const accion = searchParams.get('accion');
    const tabla = searchParams.get('tabla');
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    const offset = (pagina - 1) * limite;

    const condiciones = [];

    if (accion && accion !== 'todas') {
      condiciones.push(eq(registrosAuditoria.accion, accion));
    }

    if (tabla && tabla !== 'todas') {
      condiciones.push(eq(registrosAuditoria.tablaAfectada, tabla));
    }

    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      condiciones.push(gte(registrosAuditoria.createdAt, inicio.toISOString()));
    }

    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      condiciones.push(lte(registrosAuditoria.createdAt, fin.toISOString()));
    }

    const whereClause = condiciones.length > 0 ? and(...condiciones) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrosAuditoria)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    const registros = await db.query.registrosAuditoria.findMany({
      where: whereClause,
      limit: limite,
      offset: offset,
      orderBy: [desc(registrosAuditoria.createdAt)],
      with: {
        usuario: {
          columns: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    // Mapear el formato que espera el frontend
    const dataFormatted = registros.map(r => ({
      id: r.id,
      usuario_id: r.usuarioId,
      accion: r.accion,
      tabla_afectada: r.tablaAfectada,
      registro_id: r.registroId,
      detalles: r.detalles,
      ip_address: r.ipAddress,
      user_agent: r.userAgent,
      fecha_creacion: r.createdAt,
      usuario: r.usuario,
    }));

    return NextResponse.json({
      success: true,
      data: dataFormatted,
      total,
      paginaActual: pagina,
      totalPaginas: Math.ceil(total / limite),
    });
  } catch (error) {
    console.error('Error fetching auditoria:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { accion, tablaAfectada, registroId, detalles } = body;

    if (!accion || !tablaAfectada) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await db.insert(registrosAuditoria).values({
      usuarioId: session.id,
      accion,
      tablaAfectada,
      registroId: registroId ? Number(registroId) : null,
      detalles: detalles ? JSON.stringify(detalles) : null,
      ipAddress: ipAddress.substring(0, 45),
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Evento registrado' });
  } catch (error) {
    console.error('Error saving auditoria:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
