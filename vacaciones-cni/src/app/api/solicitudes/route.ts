import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, tiposAusenciaConfig } from '@/lib/db/schema';
import type { NuevaSolicitud } from '@/types';
import { validarSolicitud, registrarDiasPendientes, calcularDiasLaborables } from '@/services/balance.service';
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

    // 🔐 2. AUTORIZACIÓN - Verificar permisos
    const puedeVerTodas = tienePermiso(sessionUser, 'vacaciones.solicitudes.ver_todas');
    const puedeVerPropias = tienePermiso(sessionUser, 'vacaciones.solicitudes.ver_propias');

    if (!puedeVerTodas && !puedeVerPropias) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver solicitudes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const usuarioIdParam = searchParams.get('usuarioId');
    const estado = searchParams.get('estado');
    const tipoAusenciaId = searchParams.get('tipoAusenciaId');
    const paraAprobar = searchParams.get('paraAprobar') === 'true';
    // Soportar ambos formatos: page/pageSize y pagina/limite
    const page = Number.parseInt(searchParams.get('page') || searchParams.get('pagina') || '1');
    const pageSize = Number.parseInt(searchParams.get('pageSize') || searchParams.get('limite') || '20');

    // Determinar roles usando RBAC
    const esAdmin = sessionUser.roles?.some(r => r.codigo === 'ADMIN') || false;
    const esRrhh = sessionUser.roles?.some(r => r.codigo === 'RRHH') || false;
    const esJefe = sessionUser.roles?.some(r => r.codigo === 'JEFE') || false;

    const conditions = [isNull(solicitudes.deletedAt)];
    
    // 🔐 3. FILTRADO SEGÚN PERMISOS
    if (puedeVerTodas) {
      // ADMIN/RRHH → Ver todas las solicitudes
      // Si se pasa usuarioId como filtro, respetarlo
      if (usuarioIdParam) {
        conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioIdParam)));
      }
      
      // Si es RRHH y busca para aprobar, filtrar por estado aprobada_jefe
      if (paraAprobar && esRrhh && !estado) {
        conditions.push(eq(solicitudes.estado, 'aprobada_jefe'));
        console.log('🔍 Filtrando solicitudes aprobada_jefe para RRHH');
      }
    } else if (puedeVerPropias) {
      // EMPLEADO/JEFE → Depende del contexto
      
      if (paraAprobar && esJefe && sessionUser.departamentoId) {
        // JEFE viendo solicitudes para aprobar → Ver solicitudes pendientes de su departamento
        console.log('✅ Permiso: Ver solicitudes de departamento para aprobar');
        
        // Buscar solicitudes pendientes de usuarios de su departamento (excepto las propias)
        const usuariosDeptQuery = await db
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(
            and(
              eq(usuarios.departamentoId, sessionUser.departamentoId),
              isNull(usuarios.deletedAt)
            )
          );
        
        const usuariosDeptIds = usuariosDeptQuery.map(u => u.id);
        
        if (usuariosDeptIds.length > 0) {
          conditions.push(inArray(solicitudes.usuarioId, usuariosDeptIds));
        } else {
          // No hay usuarios en el departamento, retornar vacío
          conditions.push(sql`false`);
        }
        
        // Si no se especifica estado, por defecto filtrar pendientes
        if (!estado) {
          conditions.push(eq(solicitudes.estado, 'pendiente'));
          console.log('🔍 Filtrando solicitudes pendientes para JEFE');
        }
      } else {
        // Solo sus propias solicitudes
        console.log('✅ Permiso: Ver solo solicitudes propias');
        conditions.push(eq(solicitudes.usuarioId, sessionUser.id));
      }
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

    // Calcular estadísticas para el frontend
    const [stats] = await db
      .select({
        pendientes: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('pendiente', 'aprobada_jefe'))::int`,
        aprobadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} = 'aprobada')::int`,
        rechazadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} = 'rechazada')::int`,
      })
      .from(solicitudes)
      .where(and(...conditions));

    // Formatear resultados para el frontend
    const solicitudesFormateadas = results.map((sol: any) => ({
      id: sol.id,
      usuarioId: sol.usuarioId,
      tipoAusenciaId: sol.tipoAusenciaId,
      fechaInicio: sol.fechaInicio,
      fechaFin: sol.fechaFin,
      dias: sol.cantidad,
      motivo: sol.motivo,
      estado: sol.estado,
      comentariosJefe: sol.comentariosJefe,
      comentariosRrhh: sol.comentariosRrhh,
      aprobadoPorJefeId: sol.aprobadoPorJefeId,
      aprobadoPorRrhhId: sol.aprobadoPorRrhhId,
      fechaAprobacionJefe: sol.fechaAprobacionJefe,
      fechaAprobacionRrhh: sol.fechaAprobacionRrhh,
      fechaCreacion: sol.createdAt,
      usuario: sol.usuario ? `${sol.usuario.nombre} ${sol.usuario.apellido}` : 'Desconocido',
      tipoAusencia: sol.tipoAusencia?.nombre || 'Desconocido',
      aprobadorJefe: sol.aprobador ? `${sol.aprobador.nombre} ${sol.aprobador.apellido}` : null,
      aprobadorRrhh: sol.aprobadorRrhh ? `${sol.aprobadorRrhh.nombre} ${sol.aprobadorRrhh.apellido}` : null,
    }));

    console.log(`✅ Retornando ${results.length} solicitudes (total: ${count})`);

    return NextResponse.json({
      success: true,
      solicitudes: solicitudesFormateadas,
      total: count,
      stats: {
        pendientes: stats?.pendientes || 0,
        aprobadas: stats?.aprobadas || 0,
        rechazadas: stats?.rechazadas || 0,
      },
      // Mantener compatibilidad con formato viejo
      data: results,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    });

  } catch (error) {
    console.error('❌ Error obteniendo solicitudes:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener solicitudes',
        details: error instanceof Error ? error.message : String(error)
      },
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
    
    // 📅 CALCULAR DÍAS LABORABLES (excluyendo sábados y domingos)
    const diasLaborables = calcularDiasLaborables(fechaInicioDate, fechaFinDate);
    
    console.log(`📊 Rango: ${fechaInicio} a ${fechaFin}`);
    console.log(`📊 Días laborables calculados: ${diasLaborables} (excluyendo fines de semana)`);
    
    // Usar días laborables en lugar de la cantidad enviada por el frontend
    const diasSolicitados = diasLaborables;

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
    // 🔐 1. AUTENTICACIÓN
    const sessionUser = await getSession();
    if (!sessionUser) {
      console.log('❌ PATCH /api/solicitudes - Sin sesión');
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log(`🔄 PATCH /api/solicitudes - Usuario: ${sessionUser.email}`);

    const body = await request.json();
    const { solicitudId, accion, motivo } = body;

    if (!solicitudId || !accion) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos (solicitudId, accion)' },
        { status: 400 }
      );
    }

    // Obtener solicitud actual con relaciones
    const solicitud = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
      with: {
        usuario: {
          with: { departamento: true }
        },
        tipoAusencia: true
      }
    });

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    console.log(`📋 Solicitud ${solicitud.codigo} - Estado actual: ${solicitud.estado}`);
    console.log(`🎯 Acción solicitada: ${accion}`);

    // 🔐 2. AUTORIZACIÓN Y VALIDACIÓN SEGÚN LA ACCIÓN
    let nuevoEstado = solicitud.estado;
    let camposActualizar: any = { version: solicitud.version + 1 };

    switch (accion) {
      case 'aprobar_jefe': {
        // Verificar permiso de aprobar como jefe
        const puedeAprobarJefe = tienePermiso(sessionUser, 'vacaciones.solicitudes.aprobar_jefe');
        if (!puedeAprobarJefe) {
          console.log('❌ Sin permiso para aprobar como jefe');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para aprobar solicitudes como jefe' },
            { status: 403 }
          );
        }

        // JEFE solo puede aprobar de su departamento (a menos que sea ADMIN/RRHH)
        const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
        if (!esAdminORrhh) {
          if (!sessionUser.departamentoId || sessionUser.departamentoId !== solicitud.usuario.departamentoId) {
            console.log(`❌ JEFE ${sessionUser.id} intenta aprobar solicitud de otro departamento`);
            return NextResponse.json(
              { success: false, error: 'Solo puedes aprobar solicitudes de tu departamento' },
              { status: 403 }
            );
          }
        }

        // Validar que la solicitud esté en estado pendiente
        if (solicitud.estado !== 'pendiente') {
          return NextResponse.json(
            { success: false, error: `No se puede aprobar una solicitud en estado: ${solicitud.estado}` },
            { status: 400 }
          );
        }

        nuevoEstado = 'aprobada_jefe';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.aprobadoPor = sessionUser.id;
        camposActualizar.fechaAprobacionJefe = new Date();
        console.log(`✅ Aprobación de jefe autorizada`);
        break;
      }

      case 'aprobar_rrhh': {
        // Verificar permiso de aprobar como RRHH
        const puedeAprobarRrhh = tienePermiso(sessionUser, 'vacaciones.solicitudes.aprobar_rrhh');
        if (!puedeAprobarRrhh) {
          console.log('❌ Sin permiso para aprobar como RRHH');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para aprobar solicitudes como RRHH' },
            { status: 403 }
          );
        }

        // Validar que la solicitud esté en estado aprobada_jefe
        if (solicitud.estado !== 'aprobada_jefe') {
          return NextResponse.json(
            { success: false, error: `Solo se pueden aprobar solicitudes previamente aprobadas por el jefe (estado actual: ${solicitud.estado})` },
            { status: 400 }
          );
        }

        nuevoEstado = 'aprobada';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.aprobadoRrhhPor = sessionUser.id;
        camposActualizar.fechaAprobacionRrhh = new Date();
        console.log(`✅ Aprobación de RRHH autorizada`);

        // 📊 MOVER DÍAS DE PENDIENTE A UTILIZADA EN BALANCE
        const anio = new Date(solicitud.fechaInicio).getFullYear();
        const diasSolicitud = parseFloat(solicitud.cantidad);
        
        // Restar de pendientes y sumar a utilizados
        await db.execute(sql`
          UPDATE balances_ausencias
          SET 
            cantidad_pendiente = cantidad_pendiente - ${diasSolicitud},
            cantidad_utilizada = cantidad_utilizada + ${diasSolicitud},
            updated_at = NOW()
          WHERE usuario_id = ${solicitud.usuarioId}
            AND tipo_ausencia_id = ${solicitud.tipoAusenciaId}
            AND anio = ${anio}
        `);
        
        console.log(`📊 Balance actualizado: ${diasSolicitud} días movidos de pendiente a utilizada`);
        break;
      }

      case 'rechazar': {
        // Verificar permiso de rechazar
        const puedeRechazar = tienePermiso(sessionUser, 'vacaciones.solicitudes.rechazar');
        if (!puedeRechazar) {
          console.log('❌ Sin permiso para rechazar solicitudes');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para rechazar solicitudes' },
            { status: 403 }
          );
        }

        // JEFE solo puede rechazar de su departamento (a menos que sea ADMIN/RRHH)
        const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
        if (!esAdminORrhh && !sessionUser.esRrhh) {
          if (!sessionUser.departamentoId || sessionUser.departamentoId !== solicitud.usuario.departamentoId) {
            console.log(`❌ JEFE ${sessionUser.id} intenta rechazar solicitud de otro departamento`);
            return NextResponse.json(
              { success: false, error: 'Solo puedes rechazar solicitudes de tu departamento' },
              { status: 403 }
            );
          }
        }

        // Validar que la solicitud esté en estado válido para rechazar
        if (!['pendiente', 'aprobada_jefe'].includes(solicitud.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede rechazar una solicitud en estado: ${solicitud.estado}` },
            { status: 400 }
          );
        }

        nuevoEstado = 'rechazada';
        camposActualizar.estado = nuevoEstado;
        camposActualizar.rechazadoPor = sessionUser.id;
        camposActualizar.fechaRechazo = new Date();
        camposActualizar.motivoRechazo = motivo || null;
        console.log(`✅ Rechazo autorizado`);

        // 📊 DEVOLVER DÍAS PENDIENTES AL BALANCE
        const anio = new Date(solicitud.fechaInicio).getFullYear();
        const diasSolicitud = parseFloat(solicitud.cantidad);
        
        await db.execute(sql`
          UPDATE balances_ausencias
          SET 
            cantidad_pendiente = cantidad_pendiente - ${diasSolicitud},
            updated_at = NOW()
          WHERE usuario_id = ${solicitud.usuarioId}
            AND tipo_ausencia_id = ${solicitud.tipoAusenciaId}
            AND anio = ${anio}
        `);
        
        console.log(`📊 Balance actualizado: ${diasSolicitud} días liberados de pendiente`);
        break;
      }

      case 'cancelar': {
        // Solo el usuario dueño o ADMIN/RRHH pueden cancelar
        const esPropietario = solicitud.usuarioId === sessionUser.id;
        const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
        
        if (!esPropietario && !esAdminORrhh) {
          console.log(`❌ Usuario ${sessionUser.id} intenta cancelar solicitud de otro usuario`);
          return NextResponse.json(
            { success: false, error: 'Solo puedes cancelar tus propias solicitudes' },
            { status: 403 }
          );
        }

        // Validar que la solicitud esté en estado válido para cancelar
        if (!['pendiente', 'aprobada_jefe'].includes(solicitud.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede cancelar una solicitud en estado: ${solicitud.estado}` },
            { status: 400 }
          );
        }

        nuevoEstado = 'cancelada';
        camposActualizar.estado = nuevoEstado;
        console.log(`✅ Cancelación autorizada`);

        // 📊 DEVOLVER DÍAS PENDIENTES AL BALANCE
        const anio = new Date(solicitud.fechaInicio).getFullYear();
        const diasSolicitud = parseFloat(solicitud.cantidad);
        
        await db.execute(sql`
          UPDATE balances_ausencias
          SET 
            cantidad_pendiente = cantidad_pendiente - ${diasSolicitud},
            updated_at = NOW()
          WHERE usuario_id = ${solicitud.usuarioId}
            AND tipo_ausencia_id = ${solicitud.tipoAusenciaId}
            AND anio = ${anio}
        `);
        
        console.log(`📊 Balance actualizado: ${diasSolicitud} días liberados de pendiente`);
        break;
      }

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

    console.log(`✅ ${mensaje} - Nuevo estado: ${nuevoEstado}`);

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
