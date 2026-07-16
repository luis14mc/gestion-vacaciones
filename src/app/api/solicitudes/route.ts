import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes, usuarios, departamentos } from '@/lib/db/schema';
import { getSession, tienePermiso } from '@/lib/auth';
import { crearSolicitud } from '@/services/solicitudes.service';
import { notificarNuevaSolicitudAJefe } from '@/services/email.service';
import {
  registrarAuditoria,
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import { obtenerConfigs, asBool } from '@/lib/config/service';
import { validarAdjuntos } from '@/lib/security/adjuntos';
import {
  construirCondicionesBandejaAprobacion,
  calcularStatsBandejaAprobacion,
} from '@/lib/domain/aprobacion-inbox-queries';
import { puedeAccederBandejaAprobacion } from '@/lib/domain/aprobacion-inbox';
import { validarEstructuraSolicitudCumpleanos } from '@/lib/domain/cumpleanos';
import { esErrorValidacionNegocioCrearSolicitud } from '@/lib/domain/solicitud-errores-negocio';
import {
  cargarDatosFlujoSolicitante,
  resolverFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';
import {
  resolverRequisitosAdjuntosSolicitud,
  validarAdjuntosObligatorios,
} from '@/lib/domain/requisitos-adjuntos';
import { obtenerResumenAdjuntos } from '@/lib/domain/solicitud-adjuntos-resumen';
import { enriquecerRechazoSolicitudes } from '@/lib/domain/rechazo-solicitud-display';
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
  const offset = (page - 1) * pageSize;

  if (paraAprobar) {
    if (
      !puedeAccederBandejaAprobacion({
        esAdmin: sessionUser.esAdmin,
        esRrhh: sessionUser.esRrhh,
        esJefe: sessionUser.esJefe,
        esDirector: sessionUser.esDirector,
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para aprobar solicitudes' },
        { status: 403 }
      );
    }

    const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(sessionUser);

    const results = await db.query.solicitudes.findMany({
      where: inboxWhere,
      with: { usuario: true },
      orderBy: [desc(solicitudes.createdAt)],
      limit: pageSize,
      offset,
    });

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(solicitudes)
      .where(inboxWhere);
    const count = Number(countResult[0]?.count ?? 0);

    const stats = await calcularStatsBandejaAprobacion(sessionUser);

    const tiposMapParaAprobar: Record<string, string> = {
      vacaciones: 'Vacaciones',
      licencia_medica: 'Licencia Médica',
      permiso_personal: 'Permiso Personal',
      permiso_salida: 'Permiso de Salida',
      dia_cumpleanos: 'Día libre por cumpleaños',
    };

    const solicitudesBandejaRaw = results.map((sol: any) => ({
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
      aprobadaJefePor: sol.aprobadaJefePor,
      aprobadaDirectorPor: sol.aprobadaDirectorPor,
      aprobadaSecretarioPor: sol.aprobadaSecretarioPor,
      aprobadaRrhhPor: sol.aprobadaRrhhPor,
      usuario: sol.usuario
        ? {
            id: sol.usuario.id,
            nombre: sol.usuario.nombre,
            apellido: sol.usuario.apellido,
            email: sol.usuario.email,
          }
        : { id: 0, nombre: 'Desconocido', apellido: '', email: '' },
      tipoAusencia: {
        id: sol.tipo,
        nombre: tiposMapParaAprobar[sol.tipo] || sol.tipo,
        tipo: sol.tipo,
      },
      metadata: sol.metadata,
      ...obtenerResumenAdjuntos(sol.documentosAdjuntos),
    }));

    const solicitudesBandeja = await enriquecerRechazoSolicitudes(solicitudesBandejaRaw);

    return NextResponse.json({
      success: true,
      total: count,
      stats,
      data: solicitudesBandeja,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(count / pageSize)),
    });
  }

  const conditions = [isNull(solicitudes.deletedAt)];

  if (puedeVerTodas) {
    if (usuarioIdParam) {
      conditions.push(eq(solicitudes.usuarioId, Number.parseInt(usuarioIdParam)));
    }
  } else if (puedeVerPropias) {
    conditions.push(eq(solicitudes.usuarioId, sessionUser.id));
  }

  if (estado) {
    conditions.push(eq(solicitudes.estado, estado as any));
  }

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

  // Calcular estadísticas para el frontend
  const [stats] = await db
    .select({
      pendientes: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('pendiente_jefe', 'aprobada_jefe'))::int`,
      aprobadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('aprobada_rrhh', 'finalizada'))::int`,
      rechazadas: sql<number>`count(*) FILTER (WHERE ${solicitudes.estado} IN ('rechazada_jefe', 'rechazada_director', 'rechazada_secretario_general', 'rechazada_rrhh'))::int`,
    })
    .from(solicitudes)
    .where(and(...conditions));

  const tiposMap: Record<string, string> = {
    vacaciones: 'Vacaciones',
    licencia_medica: 'Licencia Médica',
    permiso_personal: 'Permiso Personal',
    permiso_salida: 'Permiso de Salida',
    dia_cumpleanos: 'Día libre por cumpleaños',
  };

  const resumenAdjuntos = (documentosAdjuntos: unknown) =>
    obtenerResumenAdjuntos(documentosAdjuntos);

  const solicitudesListadoRaw = results.map((sol: any) => ({
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
    aprobadaDirectorPor: sol.aprobadaDirectorPor,
    aprobadaSecretarioPor: sol.aprobadaSecretarioPor,
    aprobadaJefeFecha: sol.aprobadaJefeFecha,
    aprobadaRrhhFecha: sol.aprobadaRrhhFecha,
    fechaCreacion: sol.createdAt,
    motivoRechazo: sol.motivoRechazo,
    rechazadaPor: sol.rechazadaPor,
    rechazadaFecha: sol.rechazadaFecha,
    usuario: sol.usuario ? `${sol.usuario.nombre} ${sol.usuario.apellido}` : 'Desconocido',
    tipoAusencia: tiposMap[sol.tipo] || sol.tipo,
    metadata: sol.metadata,
    ...resumenAdjuntos(sol.documentosAdjuntos),
  }));

  const solicitudesDetalleRaw = results.map((sol: any) => ({
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
    aprobadaJefePor: sol.aprobadaJefePor,
    aprobadaDirectorPor: sol.aprobadaDirectorPor,
    aprobadaSecretarioPor: sol.aprobadaSecretarioPor,
    aprobadaRrhhPor: sol.aprobadaRrhhPor,
    usuario: sol.usuario
      ? { id: sol.usuario.id, nombre: sol.usuario.nombre, apellido: sol.usuario.apellido, email: sol.usuario.email }
      : { id: 0, nombre: 'Desconocido', apellido: '', email: '' },
    tipoAusencia: { id: sol.tipo, nombre: tiposMap[sol.tipo] || sol.tipo, tipo: sol.tipo },
    metadata: sol.metadata,
    ...resumenAdjuntos(sol.documentosAdjuntos),
  }));

  const [solicitudesListado, solicitudesDetalle] = await Promise.all([
    enriquecerRechazoSolicitudes(solicitudesListadoRaw),
    enriquecerRechazoSolicitudes(solicitudesDetalleRaw),
  ]);

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

  if (tipo === 'dia_cumpleanos') {
    const estructura = validarEstructuraSolicitudCumpleanos({
      fechaInicio,
      fechaFin: validatedData.fechaFin,
      diasSolicitados,
    });
    if (!estructura.valido) {
      await registrarAuditoria({
        usuarioId: sessionUser.id,
        accion: 'validacion_rechazada',
        tablaAfectada: 'solicitudes',
        detalles: { tipo, motivo: estructura.error },
      });
      return NextResponse.json({ success: false, error: estructura.error }, { status: 400 });
    }
  }

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

  const datosSolicitante = await cargarDatosFlujoSolicitante(usuarioId);
  if (!datosSolicitante) {
    return NextResponse.json(
      { success: false, error: 'Usuario solicitante no encontrado' },
      { status: 404 }
    );
  }

  const flujo = await resolverFlujoSolicitante(datosSolicitante, tipo);

  // Errores de flujo controlados (sin jefe / sin Dir. Secretaría General).
  if (flujo.errorFlujo) {
    await registrarAuditoria({
      usuarioId: sessionUser.id,
      accion: 'validacion_rechazada',
      tablaAfectada: 'solicitudes',
      detalles: {
        tipo,
        motivo: 'flujo_aprobacion_incompleto',
        mensajeFlujo: flujo.mensajeFlujo,
      },
    });
    return NextResponse.json(
      {
        success: false,
        error: flujo.mensajeFlujo,
      },
      { status: 400 }
    );
  }

  // Fase 3: resolver requisitos de adjuntos según rol/flujo del
  // solicitante. La regla canónica vive en `requisitos-adjuntos.ts`.
  const requisitosAdjuntos = resolverRequisitosAdjuntosSolicitud({
    usuarioSolicitante: {
      esDirector: datosSolicitante.esDirector,
      esJefe: datosSolicitante.esJefe,
    },
    tipoSolicitud: tipo,
    duracionPermiso,
    flujoAprobacion: {
      requiereVoBoMinistro: flujo.requiereVoBoMinistro,
      aprobadorSegundoNivelTipo: flujo.aprobadorSegundoNivelTipo ?? null,
    },
  });

  // Validación: que los adjuntos provistos cubran todos los obligatorios.
  const errorAdjuntosObligatorios = validarAdjuntosObligatorios({
    requisitos: requisitosAdjuntos,
    documentosAdjuntos,
  });
  if (errorAdjuntosObligatorios) {
    await registrarAuditoria({
      usuarioId: sessionUser.id,
      accion: 'validacion_rechazada',
      tablaAfectada: 'solicitudes',
      detalles: {
        tipo,
        motivo: errorAdjuntosObligatorios,
        adjuntosRequeridos: requisitosAdjuntos.adjuntosRequeridos.map((r) => r.tipo),
      },
    });
    return NextResponse.json({ success: false, error: errorAdjuntosObligatorios }, { status: 400 });
  }

  // Validación de seguridad de adjuntos (tipo real, tamaño y cantidad)
  const errorAdjuntos = validarAdjuntos(documentosAdjuntos);
  if (errorAdjuntos) {
    return NextResponse.json({ success: false, error: errorAdjuntos }, { status: 400 });
  }

  // 4. USAR SERVICIO PARA CREAR SOLICITUD
  let solicitudCreada: any;
  try {
    solicitudCreada = await crearSolicitud({
      usuarioId,
      tipo,
      fechaInicio,
      fechaFin,
      diasSolicitados,
      duracionPermiso,
      horaSalida,
      horaRegreso,
      motivo: motivoNormalizado,
      comentarioEmpleado: observaciones || undefined,
      esDirector: datosSolicitante.esDirector,
      documentosAdjuntos
    });
  } catch (error) {
    if (esErrorValidacionNegocioCrearSolicitud(error)) {
      await registrarAuditoria({
        usuarioId: sessionUser.id,
        accion: 'validacion_rechazada',
        tablaAfectada: 'solicitudes',
        detalles: { tipo, motivo: error.message },
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    throw error;
  }

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

  // Fase 3: auditar cada adjunto subido. Tipo + nombre + solicitante +
  // solicitud asociada. El visor posterior también genera
  // `adjunto_visualizado` cuando un aprobador abre el archivo.
  const adjuntosParaAuditoria = Array.isArray(documentosAdjuntos)
    ? (documentosAdjuntos as Array<{ tipo?: string; nombre?: string }>).filter(
        (a) => a && (a.tipo || a.nombre)
      )
    : [];

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
      aprobadorSegundoNivelTipo: flujo.aprobadorSegundoNivelTipo ?? null,
      aprobadorSegundoNivelNombre: flujo.aprobadorSegundoNivelNombre ?? null,
      requiereAprobacionDirector: flujo.requiereAprobacionDirector,
      requiereAprobacionSecretariaGeneral: flujo.requiereAprobacionSecretariaGeneral,
      aprobadorInicialTipo: flujo.aprobadorInicialTipo ?? null,
      adjuntosRequeridos: requisitosAdjuntos.adjuntosRequeridos.map((r) => r.tipo),
      adjuntosSubidos: adjuntosParaAuditoria.map((a) => ({
        tipo: a.tipo ?? a.nombre,
        nombre: a.nombre,
      })),
      ...(flujo.flujoEspecial ? { flujoEspecial: flujo.flujoEspecial } : {}),
      ...(flujo.pasaDirectoRrhh ? { derivadoDirectoRrhh: true } : {}),
    },
    ipAddress,
    userAgent,
  });

  for (const adj of adjuntosParaAuditoria) {
    await registrarEventoAuditoria({
      usuarioId: sessionUser.id,
      modulo: 'solicitudes',
      evento: 'adjunto_subido',
      severidad: 'info',
      resultado: 'exito',
      accion: 'adjunto_subido',
      tablaAfectada: 'solicitudes',
      registroId: Number(solicitudCreada.id),
      detalles: {
        tipoAdjunto: adj.tipo ?? adj.nombre,
        nombreAdjunto: adj.nombre,
        solicitudCodigo: solicitudCreada.codigo,
      },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({
    success: true,
    data: solicitudCompleta,
    message: 'Solicitud creada exitosamente'
  });
});
