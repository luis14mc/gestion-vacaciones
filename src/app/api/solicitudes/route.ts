import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, inArray, ne, or, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, departamentos } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';
import { crearSolicitud } from '@/services/solicitudes.service';
import { notificarNuevaSolicitudAJefe } from '@/services/email.service';
import { registrarAuditoria, datosPeticion } from '@/services/auditoria.service';
import { obtenerConfigs, asBool } from '@/lib/config/service';
import { validarAdjuntos } from '@/lib/security/adjuntos';
import { withErrorHandler } from '@/lib/api-handler';
import { z } from 'zod';

export const runtime = 'nodejs';

// Esquema de validación estricto para la API (OWASP A03)
const crearSolicitudSchema = z.object({
  usuarioId: z.number().int().positive(),
  tipo: z.enum(['vacaciones', 'permiso_salida', 'licencia_medica', 'permiso_personal', 'dia_cumpleanos']),
  fechaInicio: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  fechaFin: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  diasSolicitados: z.number().min(0).optional(),
  duracionPermiso: z.enum(['1-2h', '2-4h', 'dia_completo']).optional(),
  horaSalida: z.string().optional(),
  horaRegreso: z.string().optional(),
  motivo: z.string().nullish(),
  observaciones: z.string().nullish(),
  documentosAdjuntos: z.array(
    z.object({
      nombre: z.string(),
      data: z.string(),
      tipo: z.string().optional()
    })
  ).optional()
});

// GET: Obtener solicitudes con filtros (con RBAC)
export const GET = withErrorHandler(async (request: NextRequest) => {
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

  const esAdmin = sessionUser.esAdmin || sessionUser.roles?.some(r => r.codigo === 'ADMIN') || false;
  const esRrhh = sessionUser.esRrhh || sessionUser.roles?.some(r => r.codigo === 'RRHH') || false;
  const esDirector = sessionUser.esDirector || false;
  const esJefe = sessionUser.esJefe || false;

  const conditions: SQL[] = [isNull(solicitudes.deletedAt)];
  let inboxConditions: SQL[] | null = null;

  if (paraAprobar) {
    const approvalScopes: SQL[] = [];

    if (esAdmin) {
      approvalScopes.push(inArray(solicitudes.estado, ['pendiente_jefe', 'aprobada_jefe']));
    } else {
      if (esRrhh) {
        approvalScopes.push(eq(solicitudes.estado, 'aprobada_jefe'));
      }

      if (esJefe || esDirector) {
        const subordinadosDirectos = await db
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(and(
            eq(usuarios.jefeSuperiorId, sessionUser.id),
            eq(usuarios.activo, true),
            isNull(usuarios.deletedAt)
          ));

        let subordinadoIds = subordinadosDirectos.map(usuario => usuario.id);

        if (esDirector && subordinadoIds.length === 0 && sessionUser.departamentoId != null) {
          const subordinadosDepartamento = await db
            .select({ id: usuarios.id })
            .from(usuarios)
            .where(and(
              eq(usuarios.departamentoId, sessionUser.departamentoId),
              ne(usuarios.id, sessionUser.id),
              eq(usuarios.activo, true),
              isNull(usuarios.deletedAt)
            ));

          subordinadoIds = subordinadosDepartamento.map(usuario => usuario.id);
        }

        if (subordinadoIds.length > 0) {
          const scopeJefe = and(
            eq(solicitudes.estado, 'pendiente_jefe'),
            inArray(solicitudes.usuarioId, subordinadoIds)
          );
          if (scopeJefe) approvalScopes.push(scopeJefe);
        }
      }
    }

    const roleScope = approvalScopes.length > 0 ? or(...approvalScopes) : sql`false`;
    inboxConditions = [
      isNull(solicitudes.deletedAt),
      ne(solicitudes.usuarioId, sessionUser.id),
      roleScope!,
    ];
    conditions.splice(0, conditions.length, ...inboxConditions);
  } else if (puedeVerTodas) {
    if (usuarioIdParam) {
      conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioIdParam)));
    }
  } else if (puedeVerPropias) {
    conditions.push(eq(solicitudes.usuarioId, sessionUser.id));
  }

  // Filtros adicionales
  if (estado) {
    conditions.push(eq(solicitudes.estado, estado as any));
  }

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
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(solicitudes)
    .where(and(...conditions));
  const count = Number(countResult[0]?.count ?? 0);

  let statsResponse: {
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
    aprobadas_hoy: number;
    rechazadas_hoy: number;
  };

  if (paraAprobar && inboxConditions) {
    const fechaLocalEsHoy = (campo: { getSQL(): SQL }) =>
      sql`${campo} IS NOT NULL AND (${campo} AT TIME ZONE 'America/Tegucigalpa')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date`;
    const aprobadasHoyScopes: SQL[] = [];
    const rechazadasHoyScopes: SQL[] = [];

    if (esAdmin || esJefe || esDirector) {
      const aprobadasJefe = and(
        eq(solicitudes.aprobadaJefePor, sessionUser.id),
        fechaLocalEsHoy(solicitudes.aprobadaJefeFecha)
      );
      const rechazadasJefe = and(
        eq(solicitudes.estado, 'rechazada_jefe'),
        eq(solicitudes.rechazadaPor, sessionUser.id),
        fechaLocalEsHoy(solicitudes.rechazadaFecha)
      );
      if (aprobadasJefe) aprobadasHoyScopes.push(aprobadasJefe);
      if (rechazadasJefe) rechazadasHoyScopes.push(rechazadasJefe);
    }

    if (esAdmin || esRrhh) {
      const aprobadasRrhh = and(
        eq(solicitudes.aprobadaRrhhPor, sessionUser.id),
        fechaLocalEsHoy(solicitudes.aprobadaRrhhFecha)
      );
      const rechazadasRrhh = and(
        eq(solicitudes.estado, 'rechazada_rrhh'),
        eq(solicitudes.rechazadaPor, sessionUser.id),
        fechaLocalEsHoy(solicitudes.rechazadaFecha)
      );
      if (aprobadasRrhh) aprobadasHoyScopes.push(aprobadasRrhh);
      if (rechazadasRrhh) rechazadasHoyScopes.push(rechazadasRrhh);
    }

    const [inboxStats] = await db
      .select({ pendientes: sql<number>`count(*)::int` })
      .from(solicitudes)
      .where(and(...inboxConditions));

    const aprobadasHoyFilter = or(...aprobadasHoyScopes) ?? sql`false`;
    const rechazadasHoyFilter = or(...rechazadasHoyScopes) ?? sql`false`;
    const [procesadasHoy] = await db
      .select({
        aprobadas_hoy: sql<number>`count(*) FILTER (WHERE ${aprobadasHoyFilter})::int`,
        rechazadas_hoy: sql<number>`count(*) FILTER (WHERE ${rechazadasHoyFilter})::int`,
      })
      .from(solicitudes)
      .where(isNull(solicitudes.deletedAt));

    statsResponse = {
      pendientes: inboxStats?.pendientes || 0,
      aprobadas: procesadasHoy?.aprobadas_hoy || 0,
      rechazadas: procesadasHoy?.rechazadas_hoy || 0,
      aprobadas_hoy: procesadasHoy?.aprobadas_hoy || 0,
      rechazadas_hoy: procesadasHoy?.rechazadas_hoy || 0,
    };
  } else {
    const [stats] = await db
      .select({
        pendientes: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe'))::int`,
        aprobadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada'))::int`,
        rechazadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_rrhh'))::int`,
      })
      .from(solicitudes)
      .where(and(...conditions));

    statsResponse = {
      pendientes: stats?.pendientes || 0,
      aprobadas: stats?.aprobadas || 0,
      rechazadas: stats?.rechazadas || 0,
      aprobadas_hoy: 0,
      rechazadas_hoy: 0,
    };
  }

  const tiposMap: Record<string, string> = {
    vacaciones: 'Vacaciones',
    licencia_medica: 'Licencia Médica',
    permiso_personal: 'Permiso Personal',
    permiso_salida: 'Permiso de Salida',
    dia_cumpleanos: 'Día libre por cumpleaños',
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
    stats: { ...statsResponse },
    data: solicitudesDetalle,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize)
  });
});

// POST: Crear nueva solicitud
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 🔐 1. AUTENTICACIÓN
  const sessionUser = await getSession();
  
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    );
  }

  const body = await request.json();
  
  // Zod Validation (OWASP A03:2026)
  const validatedData = crearSolicitudSchema.parse(body);

  const {
    usuarioId,
    tipo,
    fechaInicio,
    diasSolicitados,
    duracionPermiso,
    horaSalida,
    horaRegreso,
    motivo,
    observaciones,
    documentosAdjuntos
  } = validatedData;

  const fechaFin = validatedData.fechaFin || fechaInicio;
  const motivoNormalizado = motivo?.trim() || '';

  if (tipo === 'permiso_salida' && motivoNormalizado.length < 5) {
    return NextResponse.json(
      { success: false, error: 'Para permisos de salida es obligatorio indicar un motivo de al menos 5 caracteres.' },
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

  // Validación de seguridad de adjuntos (tipo real, tamaño y cantidad)
  const errorAdjuntos = validarAdjuntos(documentosAdjuntos);
  if (errorAdjuntos) {
    return NextResponse.json({ success: false, error: errorAdjuntos }, { status: 400 });
  }

  // 4. USAR SERVICIO PARA CREAR SOLICITUD
  const solicitudCreada: any = await crearSolicitud({
    usuarioId,
    tipo,
    fechaInicio,
    fechaFin,
    diasSolicitados: diasSolicitados || 0,
    duracionPermiso,
    horaSalida,
    horaRegreso,
    motivo: motivoNormalizado,
    comentarioEmpleado: observaciones || undefined,
    esDirector: sessionUser.esDirector || false,
    documentosAdjuntos
  });

  // 5. Obtener solicitud completa con relaciones para respuesta
  if (!solicitudCreada || !solicitudCreada.id) {
    throw new Error('Error al crear solicitud en la base de datos');
  }

  const solicitudCompleta = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, Number(solicitudCreada.id)),
    with: {
      usuario: true
    }
  });

  // Enviar notificación por correo al jefe (si el toggle está activo)
  const notificarJefe = asBool(
    (await obtenerConfigs(['notificaciones.notificar_jefe_nueva_solicitud']))[
      'notificaciones.notificar_jefe_nueva_solicitud'
    ]
  );
  if (notificarJefe && solicitudCompleta?.usuario?.jefeSuperiorId) {
    // Fire and forget, no usamos await para no bloquear la respuesta
    db.select({ email: usuarios.email, nombre: usuarios.nombre, apellido: usuarios.apellido })
      .from(usuarios)
      .where(eq(usuarios.id, solicitudCompleta.usuario.jefeSuperiorId))
      .limit(1)
      .then(([jefe]) => {
        if (jefe && jefe.email) {
          const nombreCompleto = `${solicitudCompleta.usuario.nombre} ${solicitudCompleta.usuario.apellido}`;
          notificarNuevaSolicitudAJefe(
            jefe.email, 
            `${jefe.nombre} ${jefe.apellido}`, 
            nombreCompleto, 
            solicitudCompleta.tipo, 
            Number(solicitudCompleta.diasSolicitados) || 0
          ).catch(e => console.error('[Notificación Error]', e));
        }
      })
      .catch(e => console.error('[Jefe Lookup Error]', e));
  }

  const { ipAddress, userAgent } = datosPeticion(request);
  await registrarAuditoria({
    usuarioId: sessionUser.id,
    accion: 'crear',
    tablaAfectada: 'solicitudes',
    registroId: Number(solicitudCreada.id),
    detalles: {
      evento: 'crear_solicitud',
      tipo,
      usuarioSolicitanteId: usuarioId,
      codigo: solicitudCreada.codigo,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    data: solicitudCompleta,
    message: 'Solicitud creada exitosamente'
  });
});
