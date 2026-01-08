import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, tiposAusenciaConfig } from '@/lib/db/schema';
import type { NuevaSolicitud } from '@/types';
import { validarSolicitud, registrarDiasPendientes } from '@/services/balance.service';
import { getSession, tienePermiso } from '@/lib/auth';

export const runtime = 'nodejs';

// GET: Obtener solicitudes con filtros (con RBAC)
export async function GET(request: NextRequest) {
  try {
    // 🔐 1. AUTENTICACIÓN - Obtener sesión del usuario
    const sessionUser = await getSession();
    
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log('📋 GET /api/solicitudes - Usuario:', sessionUser.email);

    // 🔐 2. AUTORIZACIÓN - Verificar permisos
    const puedeVerTodas = tienePermiso(sessionUser, 'vacaciones.solicitudes.ver_todas');
    const puedeVerPropias = tienePermiso(sessionUser, 'vacaciones.solicitudes.ver_propias');

    if (!puedeVerTodas && !puedeVerPropias) {
      console.log('❌ Sin permisos para ver solicitudes');
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver solicitudes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const usuarioIdParam = searchParams.get('usuarioId');
    const estado = searchParams.get('estado');
    const tipoAusenciaId = searchParams.get('tipoAusenciaId');
    const page = Number.parseInt(searchParams.get('page') || '1');
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '20');

    const conditions = [isNull(solicitudes.deletedAt)];
    
    // 🔐 3. FILTRADO SEGÚN PERMISOS
    if (puedeVerTodas) {
      // ADMIN/RRHH → Ver todas las solicitudes
      console.log('✅ Permiso: Ver todas las solicitudes');
      
      // Si se pasa usuarioId como filtro, respetarlo
      if (usuarioIdParam) {
        conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioIdParam)));
      }
    } else if (puedeVerPropias) {
      // EMPLEADO/JEFE → Solo sus propias solicitudes
      console.log('✅ Permiso: Ver solo solicitudes propias');
      
      // Forzar filtro por usuario actual (ignorar usuarioIdParam)
      conditions.push(eq(solicitudes.usuarioId, sessionUser.id));
    }

    // Filtros adicionales
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

    console.log(`✅ Retornando ${results.length} solicitudes (total: ${count})`);

    return NextResponse.json({
      success: true,
      data: results,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    });

  } catch (error) {
    console.error('❌ Error obteniendo solicitudes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener solicitudes' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva solicitud
export async function POST(request: NextRequest) {
  // 🔐 1. AUTENTICACIÓN
  const sessionUser = await getSession();
  
  if (!sessionUser) {
    console.log('❌ POST /api/solicitudes - Sin sesión');
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }

  console.log(`📝 POST /api/solicitudes - Usuario: ${sessionUser.email}`);

  // 🔐 2. AUTORIZACIÓN - Permiso para crear solicitudes
  const puedeCrear = tienePermiso(sessionUser, 'vacaciones.solicitudes.crear');
  
  if (!puedeCrear) {
    console.log('❌ Sin permiso para crear solicitudes');
    return NextResponse.json(
      { success: false, error: 'No tienes permiso para crear solicitudes' },
      { status: 403 }
    );
  }

  console.log('✅ Permiso: Crear solicitudes');

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

    // 🔐 3. VALIDACIÓN DE PROPIEDAD
    // Solo ADMIN y RRHH pueden crear solicitudes para otros usuarios
    const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
    
    if (!esAdminORrhh && usuarioId !== sessionUser.id) {
      console.log(`❌ Usuario ${sessionUser.id} intentó crear solicitud para usuario ${usuarioId}`);
      return NextResponse.json(
        { success: false, error: 'Solo puedes crear solicitudes para ti mismo' },
        { status: 403 }
      );
    }

    console.log(`✅ Creando solicitud para usuario: ${usuarioId}`);

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

    // 🔐 VALIDAR SOLICITUD CON BALANCE SERVICE
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    const diasSolicitados = parseFloat(cantidad);

    const validacion = await validarSolicitud(
      usuarioId,
      diasSolicitados,
      fechaInicioDate,
      fechaFinDate
    );

    if (!validacion.valido) {
      console.log(`❌ Validación fallida para usuario ${usuarioId}:`, validacion.error);
      return NextResponse.json(
        { success: false, error: validacion.error },
        { status: 400 }
      );
    }

    console.log(`✅ Validación exitosa para usuario ${usuarioId} - ${diasSolicitados} días`);

    // Generar código de solicitud
    const codigoSolicitud = `SOL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    // Crear solicitud
    const nuevaSolicitud: NuevaSolicitud = {
      codigo: codigoSolicitud,
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

    // 📝 REGISTRAR DÍAS PENDIENTES EN BALANCE
    const anio = fechaInicioDate.getFullYear();
    await registrarDiasPendientes(usuarioId, diasSolicitados, anio);
    console.log(`📊 Registrados ${diasSolicitados} días pendientes para usuario ${usuarioId}`)

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
