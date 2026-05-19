import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, departamentos } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';
import { 
  crearSolicitud, 
  aprobarSolicitudJefe, 
  aprobarSolicitudRRHH, 
  rechazarSolicitud 
} from '@/services/solicitudes.service';
import { notificarNuevaSolicitudAJefe } from '@/services/email.service';

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

    const puedeVerTodas = tienePermiso(sessionUser, 'solicitudes.ver_todas') || sessionUser.esRrhh;
    // Todos los usuarios autenticados pueden ver sus propias solicitudes
    const puedeVerPropias = true;

    const { searchParams } = new URL(request.url);
    
    const usuarioIdParam = searchParams.get('usuarioId');
    const estado = searchParams.get('estado');
    const tipoAusenciaId = searchParams.get('tipoAusenciaId');
    const paraAprobar = searchParams.get('paraAprobar') === 'true';
    // Soportar ambos formatos: page/pageSize y pagina/limite
    const page = Number.parseInt(searchParams.get('page') || searchParams.get('pagina') || '1');
    const pageSize = Number.parseInt(searchParams.get('pageSize') || searchParams.get('limite') || '20');

    const esAdmin = sessionUser.roles?.some(r => r.codigo === 'ADMIN') || false;
    const esRrhh = sessionUser.roles?.some(r => r.codigo === 'RRHH') || false;
    const esDirector = sessionUser.esDirector || false;
    const esJefe = sessionUser.esJefe || false;

    const conditions = [isNull(solicitudes.deletedAt)];
    
    if (puedeVerTodas) {
      if (usuarioIdParam) {
        conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioIdParam)));
      }
      
      if (paraAprobar && !estado) {
        if (esAdmin) {
          conditions.push(sql`${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe')`);
        } else if (esRrhh) {
          conditions.push(eq(solicitudes.estado, 'aprobada_jefe'));
        }
      }
    } else if (puedeVerPropias) {
      if (paraAprobar && (esDirector || esJefe)) {
        const subordinadosQuery = await db
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(
            and(
              eq(usuarios.jefeSuperiorId, sessionUser.id),
              isNull(usuarios.deletedAt)
            )
          );
        
        const subordinadoIds = subordinadosQuery.map(u => u.id);
        
        if (subordinadoIds.length > 0) {
          conditions.push(inArray(solicitudes.usuarioId, subordinadoIds));
        } else {
          conditions.push(sql`false`);
        }
        
        if (!estado) {
          conditions.push(eq(solicitudes.estado, 'pendiente_jefe'));
        }
      } else {
        conditions.push(eq(solicitudes.usuarioId, sessionUser.id));
      }
    }

    // Filtros adicionales
    if (estado) {
      conditions.push(eq(solicitudes.estado, estado as any));
    }
    
    // Nota: tipoAusenciaId ya no existe en CNI, filtrado por 'tipo' enum
    // Si necesitas filtrar por tipo, usa searchParams.get('tipo')

    const offset = (page - 1) * pageSize;

    // Consulta con relaciones
    const results = await db.query.solicitudes.findMany({
      where: and(...conditions),
      with: {
        usuario: true
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
        pendientes: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe'))::int`,
        aprobadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada'))::int`,
        rechazadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_rrhh'))::int`,
      })
      .from(solicitudes)
      .where(and(...conditions));

    const tiposMap: Record<string, string> = {
      vacaciones: 'Vacaciones',
      licencia_medica: 'Licencia Médica',
      permiso_personal: 'Permiso Personal',
      permiso_salida: 'Permiso de Salida',
    };

    const solicitudesListado = results.map((sol: any) => ({
      id: sol.id,
      codigo: sol.codigo,
      usuarioId: sol.usuarioId,
      tipo: sol.tipo,
      fechaInicio: sol.fechaInicio,
      fechaFin: sol.fechaFin,
      dias: sol.diasSolicitados,
      motivo: sol.motivo,
      estado: sol.estado,
      comentarioJefe: sol.comentarioJefe,
      comentarioRrhh: sol.comentarioRrhh,
      aprobadaJefePor: sol.aprobadaJefePor,
      aprobadaRrhhPor: sol.aprobadaRrhhPor,
      aprobadaJefeFecha: sol.aprobadaJefeFecha,
      aprobadaRrhhFecha: sol.aprobadaRrhhFecha,
      fechaCreacion: sol.createdAt,
      usuario: sol.usuario ? `${sol.usuario.nombre} ${sol.usuario.apellido}` : 'Desconocido',
      tipoAusencia: tiposMap[sol.tipo] || sol.tipo,
      metadata: sol.metadata,
    }));

    const solicitudesDetalle = results.map((sol: any) => ({
      id: sol.id,
      codigo: sol.codigo,
      usuarioId: sol.usuarioId,
      tipo: sol.tipo,
      fechaInicio: sol.fechaInicio,
      fechaFin: sol.fechaFin,
      cantidad: sol.diasSolicitados,
      motivo: sol.motivo,
      estado: sol.estado,
      createdAt: sol.createdAt,
      usuario: sol.usuario
        ? { id: sol.usuario.id, nombre: sol.usuario.nombre, apellido: sol.usuario.apellido, email: sol.usuario.email }
        : { id: 0, nombre: 'Desconocido', apellido: '', email: '' },
      tipoAusencia: { id: sol.tipo, nombre: tiposMap[sol.tipo] || sol.tipo, tipo: sol.tipo },
      metadata: sol.metadata,
    }));

    return NextResponse.json({
      success: true,
      solicitudes: solicitudesListado,
      total: count,
      stats: {
        pendientes: stats?.pendientes || 0,
        aprobadas: stats?.aprobadas || 0,
        rechazadas: stats?.rechazadas || 0,
      },
      data: solicitudesDetalle,
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
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    
    const {
      usuarioId,
      tipo = 'vacaciones',
      fechaInicio,
      diasSolicitados,
      motivo,
      observaciones,
      documentosAdjuntos
    } = body;

    const fechaFin = body.fechaFin || fechaInicio;

    if (!usuarioId || !tipo || !fechaInicio) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos (usuarioId, tipo, fechaInicio)' },
        { status: 400 }
      );
    }

    // 🔐 3. VALIDACIÓN DE PROPIEDAD
    // Solo ADMIN y RRHH pueden crear solicitudes para otros usuarios
    const esAdminORrhh = sessionUser.esAdmin || sessionUser.esRrhh;
    
    if (!esAdminORrhh && usuarioId !== sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'Solo puedes crear solicitudes para ti mismo' },
        { status: 403 }
      );
    }

    // Validación: Directores deben adjuntar VoBo del Ministro (aprobación externa)
    if (sessionUser.esDirector && usuarioId === sessionUser.id) {
      const adjuntos = Array.isArray(documentosAdjuntos) ? documentosAdjuntos : [];
      const tieneVoBo = adjuntos.some(
        (a: any) => a?.nombre === 'vobo_ministro' && typeof a?.data === 'string' && a.data.length > 0
      );
      if (!tieneVoBo) {
        return NextResponse.json(
          { success: false, error: 'Para Directores es obligatorio adjuntar el VoBo del Ministro.' },
          { status: 400 }
        );
      }
    }

    // Validación: licencia médica requiere constancia
    if (tipo === 'licencia_medica') {
      const adjuntos = Array.isArray(documentosAdjuntos) ? documentosAdjuntos : [];
      const tieneConstancia = adjuntos.some(
        (a: any) => a?.nombre === 'constancia_medica' && typeof a?.data === 'string' && a.data.length > 0
      );
      if (!tieneConstancia) {
        return NextResponse.json(
          { success: false, error: 'Para licencia médica es obligatorio adjuntar la constancia médica.' },
          { status: 400 }
        );
      }
    }

    // 4. USAR SERVICIO PARA CREAR SOLICITUD
    const solicitudCreada: any = await crearSolicitud({
      usuarioId,
      tipo: tipo as 'vacaciones' | 'permiso_salida' | 'licencia_medica' | 'permiso_personal',
      fechaInicio,
      fechaFin,
      diasSolicitados: diasSolicitados || 0,
      motivo: motivo || '',
      comentarioEmpleado: observaciones || undefined,
      esDirector: sessionUser.esDirector || false,
      documentosAdjuntos
    });

    // 5. Obtener solicitud completa con relaciones para respuesta
    if (!solicitudCreada || !solicitudCreada.id) {
      throw new Error('Error al crear solicitud');
    }

    const solicitudCompleta = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, Number(solicitudCreada.id)),
      with: {
        usuario: true
      }
    });

    // Enviar notificación por correo al jefe
    if (solicitudCompleta?.usuario?.jefeSuperiorId) {
      try {
        const [jefe] = await db
          .select({ email: usuarios.email, nombre: usuarios.nombre, apellido: usuarios.apellido })
          .from(usuarios)
          .where(eq(usuarios.id, solicitudCompleta.usuario.jefeSuperiorId))
          .limit(1);

        if (jefe && jefe.email) {
          const nombreCompleto = `${solicitudCompleta.usuario.nombre} ${solicitudCompleta.usuario.apellido}`;
          notificarNuevaSolicitudAJefe(
            jefe.email, 
            `${jefe.nombre} ${jefe.apellido}`, 
            nombreCompleto, 
            solicitudCompleta.tipo, 
            Number(solicitudCompleta.diasSolicitados) || 0
          ).catch(e => console.error('Error enviando email al jefe:', e));
        }
      } catch (error) {
        console.error('Error al notificar al jefe:', error);
      }
    }

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


