import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, tiposAusenciaConfig } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';
import { 
  crearSolicitud, 
  aprobarSolicitudJefe, 
  aprobarSolicitudRRHH, 
  rechazarSolicitud 
} from '@/core/application/services/solicitudes.service';

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
      cantidad,
      motivo,
      observaciones
    } = body;

    // Validaciones básicas
    if (!usuarioId || !tipoAusenciaId || !fechaInicio || !fechaFin) {
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

    // 4. USAR SERVICIO PARA CREAR SOLICITUD
    const solicitudCreada: any = await crearSolicitud({
      usuarioId,
      tipoAusenciaId,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      cantidad: cantidad || 0,
      motivo: motivo || '',
      esPermiso: false,
      direccionDuranteAusencia: observaciones || undefined,
      telefonoDuranteAusencia: undefined
    });

    // 5. Obtener solicitud completa con relaciones para respuesta
    if (!solicitudCreada || !solicitudCreada.id) {
      throw new Error('Error al crear solicitud');
    }

    const solicitudCompleta = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, Number(solicitudCreada.id)),
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
    const errorMessage = error instanceof Error ? error.message : 'Error al crear solicitud';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
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

    console.log(`🎯 Acción solicitada: ${accion} para solicitud ${solicitudId}`);

    // 2. EJECUTAR ACCIÓN USANDO SERVICIOS
    let mensaje = '';

    switch (accion) {
      case 'aprobar_jefe': {
        // Verificar permiso
        const puedeAprobarJefe = tienePermiso(sessionUser, 'vacaciones.solicitudes.aprobar_jefe');
        if (!puedeAprobarJefe) {
          console.log('❌ Sin permiso para aprobar como jefe');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para aprobar solicitudes como jefe' },
            { status: 403 }
          );
        }

        await aprobarSolicitudJefe(solicitudId, sessionUser.id);
        mensaje = 'Solicitud aprobada por jefe';
        console.log(`✅ ${mensaje}`);
        break;
      }

      case 'aprobar_rrhh': {
        // Verificar permiso
        const puedeAprobarRrhh = tienePermiso(sessionUser, 'vacaciones.solicitudes.aprobar_rrhh');
        if (!puedeAprobarRrhh) {
          console.log('❌ Sin permiso para aprobar como RRHH');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para aprobar solicitudes como RRHH' },
            { status: 403 }
          );
        }

        await aprobarSolicitudRRHH(solicitudId, sessionUser.id);
        mensaje = 'Solicitud aprobada por RRHH';
        console.log(`✅ ${mensaje}`);
        break;
      }

      case 'rechazar': {
        // Verificar permiso
        const puedeRechazar = tienePermiso(sessionUser, 'vacaciones.solicitudes.rechazar');
        if (!puedeRechazar) {
          console.log('❌ Sin permiso para rechazar solicitudes');
          return NextResponse.json(
            { success: false, error: 'No tienes permiso para rechazar solicitudes' },
            { status: 403 }
          );
        }

        if (!motivo) {
          return NextResponse.json(
            { success: false, error: 'El motivo de rechazo es obligatorio' },
            { status: 400 }
          );
        }

        await rechazarSolicitud(solicitudId, sessionUser.id, motivo);
        mensaje = 'Solicitud rechazada';
        console.log(`✅ ${mensaje}`);
        break;
      }

      case 'cancelar': {
        // Solo el usuario dueño o ADMIN/RRHH pueden cancelar
        const solicitud = await db.query.solicitudes.findFirst({
          where: eq(solicitudes.id, solicitudId)
        });

        if (!solicitud) {
          return NextResponse.json(
            { success: false, error: 'Solicitud no encontrada' },
            { status: 404 }
          );
        }

        const esPropietario = solicitud.usuarioId === sessionUser.id;
        const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
        
        if (!esPropietario && !esAdminORrhh) {
          console.log(`❌ Usuario ${sessionUser.id} intenta cancelar solicitud de otro usuario`);
          return NextResponse.json(
            { success: false, error: 'Solo puedes cancelar tus propias solicitudes' },
            { status: 403 }
          );
        }

        // Cancelar es como rechazar pero sin motivo obligatorio
        await rechazarSolicitud(
          solicitudId, 
          sessionUser.id, 
          motivo || 'Cancelada por el usuario'
        );
        
        // Actualizar estado a cancelada
        await db
          .update(solicitudes)
          .set({ estado: 'cancelada' })
          .where(eq(solicitudes.id, solicitudId));

        mensaje = 'Solicitud cancelada';
        console.log(`✅ ${mensaje}`);
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Acción no válida' },
          { status: 400 }
        );
    }

    // 3. Obtener solicitud actualizada con relaciones para respuesta
    const solicitudCompleta = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId),
      with: {
        usuario: { with: { departamento: true } },
        tipoAusencia: true,
        aprobador: true,
        aprobadorRrhh: true,
        rechazador: true
      }
    });

    return NextResponse.json({
      success: true,
      data: solicitudCompleta,
      message: mensaje
    });

  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al actualizar solicitud';
    
    // Manejar errores específicos (404, 403)
    if (errorMessage.includes('404')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 404 }
      );
    }
    
    if (errorMessage.includes('403') || errorMessage.includes('permiso')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
