import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, tiposAusenciaConfig } from '@/lib/db/schema';
import type { NuevaSolicitud } from '@/types';

export const runtime = 'nodejs';

// GET: Obtener solicitudes con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const usuarioId = searchParams.get('usuarioId');
    const estado = searchParams.get('estado');
    const tipoAusenciaId = searchParams.get('tipoAusenciaId');
    const page = Number.parseInt(searchParams.get('page') || '1');
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '20');

    const conditions = [isNull(solicitudes.deletedAt)];
    
    if (usuarioId) {
      conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioId)));
    }
    
    if (estado) {
      conditions.push(eq(solicitudes.estado, estado as any));
    }
    
    if (tipoAusenciaId) {
      conditions.push(eq(solicitudes.tipoAusenciaId, Number.parseInt(tipoAusenciaId)));
    }

    const offset = (page - 1) * pageSize;

    // Consulta con relaciones
    const results = await db.query.solicitudes.findMany({
      where: and(...conditions),
      with: {
        usuario: {
          with: {
            departamento: true
          }
        },
        tipoAusencia: true,
        aprobador: true,
        aprobadorRrhh: true
      },
      orderBy: [desc(solicitudes.createdAt)],
      limit: pageSize,
      offset
    });

    // Contar total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(solicitudes)
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: results,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    });

  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener solicitudes' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva solicitud
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      usuarioId,
      tipoAusenciaId,
      fechaInicio,
      fechaFin,
      horaInicio,
      horaFin,
      cantidad,
      unidad,
      motivo,
      observaciones
    } = body;

    // Validaciones básicas
    if (!usuarioId || !tipoAusenciaId || !fechaInicio || !fechaFin || !cantidad) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe y está activo
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, usuarioId)
    });

    if (!usuario?.activo) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado o inactivo' },
        { status: 400 }
      );
    }

    // Verificar disponibilidad (si es vacaciones o permiso con balance)
    const tipoAusencia = await db.query.tiposAusenciaConfig.findFirst({
      where: eq(tiposAusenciaConfig.id, tipoAusenciaId)
    });

    if (!tipoAusencia?.activo) {
      return NextResponse.json(
        { success: false, error: 'Tipo de ausencia no válido' },
        { status: 400 }
      );
    }

    // Crear solicitud
    const nuevaSolicitud: NuevaSolicitud = {
      usuarioId,
      tipoAusenciaId,
      fechaInicio,
      fechaFin,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
      cantidad: cantidad.toString(),
      unidad: unidad || 'dias',
      estado: 'pendiente', // Auto-enviar a pendiente
      motivo: motivo || null,
      observaciones: observaciones || null,
      fechaSolicitud: new Date()
    };

    const [solicitudCreada] = await db
      .insert(solicitudes)
      .values(nuevaSolicitud)
      .returning();

    // Obtener solicitud completa con relaciones
    const solicitudCompleta = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudCreada.id),
      with: {
        usuario: {
          with: { departamento: true }
        },
        tipoAusencia: true
      }
    });

    return NextResponse.json({
      success: true,
      data: solicitudCompleta,
      message: 'Solicitud creada exitosamente'
    });

  } catch (error) {
    console.error('Error creando solicitud:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear solicitud' },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar estado de solicitud (aprobar/rechazar)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { solicitudId, accion, usuarioId, motivo } = body;

    if (!solicitudId || !accion || !usuarioId) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Obtener solicitud actual
    const solicitud = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId)
    });

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Determinar nuevo estado y campos según la acción
    let nuevoEstado = solicitud.estado;
    let camposActualizar: any = { version: solicitud.version + 1 };

    switch (accion) {
      case 'aprobar_jefe':
        nuevoEstado = 'aprobada_jefe';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.aprobadoPor = usuarioId;
        camposActualizar.fechaAprobacionJefe = new Date();
        break;

      case 'aprobar_rrhh':
        nuevoEstado = 'aprobada';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.aprobadoRrhhPor = usuarioId;
        camposActualizar.fechaAprobacionRrhh = new Date();
        break;

      case 'rechazar':
        nuevoEstado = 'rechazada';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.rechazadoPor = usuarioId;
        camposActualizar.fechaRechazo = new Date();
        camposActualizar.motivoRechazo = motivo || null;
        break;

      case 'cancelar':
        nuevoEstado = 'cancelada';
        camposActualizar.estado = nuevoEstado;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Acción no válida' },
          { status: 400 }
        );
    }

    // Actualizar solicitud
    await db
      .update(solicitudes)
      .set(camposActualizar)
      .where(eq(solicitudes.id, solicitudId));

    // Obtener solicitud actualizada
    const solicitudActualizada = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
      with: {
        usuario: { with: { departamento: true } },
        tipoAusencia: true,
        aprobador: true,
        aprobadorRrhh: true
      }
    });

    let mensaje = 'Solicitud actualizada exitosamente';
    if (accion === 'aprobar_jefe') mensaje = 'Solicitud aprobada por jefe';
    else if (accion === 'aprobar_rrhh') mensaje = 'Solicitud aprobada por RRHH';
    else if (accion === 'rechazar') mensaje = 'Solicitud rechazada';
    else if (accion === 'cancelar') mensaje = 'Solicitud cancelada';

    return NextResponse.json({
      success: true,
      data: solicitudActualizada,
      message: mensaje
    });

  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar solicitud' },
      { status: 500 }
    );
  }
}
