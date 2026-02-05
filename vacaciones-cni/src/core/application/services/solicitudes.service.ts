/**
 * Servicio de Solicitudes - Semana 2
 * Clean Architecture - Application Layer
 */

import { db } from "@/lib/db";
import { solicitudes, usuarios, tiposAusenciaConfig, balancesAusencias } from "@/lib/db/schema";
import { calcularDiasLaborables, validarSolicitud } from "@/services/balance.service";
import { usuarioTienePermiso } from "@/core/application/rbac/rbac.service";
import { eq, and, sql } from "drizzle-orm";

// =====================================================
// INTERFACES
// =====================================================

export interface NuevaSolicitud {
  usuarioId: number;
  tipoAusenciaId: number;
  fechaInicio: Date;
  fechaFin: Date;
  cantidad: number;
  motivo: string;
  esPermiso: boolean;
  direccionDuranteAusencia?: string;
  telefonoDuranteAusencia?: string;
}

export interface FiltrosSolicitudes {
  usuarioId?: number;
  departamentoId?: number;
  estado?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  page?: number;
  pageSize?: number;
}

// =====================================================
// FUNCIONES
// =====================================================

/**
 * 1.2 Crear solicitud de ausencia con validaciones completas
 * - Valida usuario activo
 * - Valida balance disponible
 * - Genera código SOL-2026-XXXXX auto-incremental
 * - Crea solicitud en transacción
 * - Actualiza balance.cantidadPendiente
 */
export async function crearSolicitud(params: NuevaSolicitud) {
  const {
    usuarioId,
    tipoAusenciaId,
    fechaInicio,
    fechaFin,
    motivo,
    direccionDuranteAusencia,
    telefonoDuranteAusencia
  } = params;

  // 1. Validar usuario activo
  const usuario = await db.query.usuarios.findFirst({ 
    where: eq(usuarios.id, usuarioId) 
  });
  
  if (!usuario) {
    throw new Error("Usuario no encontrado");
  }
  
  if (!usuario.activo) {
    throw new Error("Usuario inactivo");
  }

  // 2. Validar tipo de ausencia activo
  const tipoAusencia = await db.query.tiposAusenciaConfig.findFirst({ 
    where: eq(tiposAusenciaConfig.id, tipoAusenciaId) 
  });
  
  if (!tipoAusencia?.activo) {
    throw new Error("Tipo de ausencia no válido o inactivo");
  }

  // 3. Calcular días laborables (excluyendo sábados y domingos)
  const diasLaborables = calcularDiasLaborables(new Date(fechaInicio), new Date(fechaFin));

  // 4. Validar balance disponible y fechas
  const validacion = await validarSolicitud(
    usuarioId, 
    diasLaborables, 
    new Date(fechaInicio), 
    new Date(fechaFin)
  );
  
  if (!validacion.valido) {
    throw new Error(validacion.error || "Validación de solicitud fallida");
  }

  // 5. Verificar balance existe para el año
  const anio = new Date(fechaInicio).getFullYear();
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, usuarioId),
      eq(balancesAusencias.anio, anio),
      eq(balancesAusencias.estado, 'activo')
    )
  });

  if (!balance) {
    throw new Error(`Balance no encontrado para el año ${anio}`);
  }

  // 6. Validar días disponibles >= días solicitados
  const diasDisponibles = Number(balance.cantidadAsignada) - Number(balance.cantidadUtilizada) - Number(balance.cantidadPendiente);
  
  if (diasDisponibles < diasLaborables) {
    throw new Error(`Días insuficientes. Disponibles: ${diasDisponibles}, Solicitados: ${diasLaborables}`);
  }

  // 7. Generar código de solicitud SOL-2026-XXXXX
  const codigoSolicitud = `SOL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

  // 8. Crear solicitud en transacción con rollback automático
  let solicitudCreada;
  
  try {
    await db.transaction(async (trx) => {
      // Insertar solicitud
      let observacionesCompletas = null;
      if (direccionDuranteAusencia) {
        observacionesCompletas = `Dirección: ${direccionDuranteAusencia}`;
        if (telefonoDuranteAusencia) {
          observacionesCompletas += `, Tel: ${telefonoDuranteAusencia}`;
        }
      }

      const [inserted] = await trx
        .insert(solicitudes)
        .values({
          codigo: codigoSolicitud,
          usuarioId,
          tipoAusenciaId,
          fechaInicio: fechaInicio.toString(),
          fechaFin: fechaFin.toString(),
          cantidad: diasLaborables.toString(),
          unidad: 'dias',
          estado: 'pendiente',
          motivo,
          observaciones: observacionesCompletas,
          fechaSolicitud: new Date()
        })
        .returning();
      
      solicitudCreada = inserted;

      // Actualizar balance: registrar días pendientes
      await trx
        .update(balancesAusencias)
        .set({
          cantidadPendiente: sql`${balancesAusencias.cantidadPendiente} + ${diasLaborables}`,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
    });
  } catch (error) {
    console.error('❌ Error en transacción crearSolicitud:', error);
    throw new Error(`Error al crear solicitud: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }

  // 9. Retornar solicitud creada
  return solicitudCreada;
}

/**
 * 1.3 Aprobar solicitud por Jefe de Departamento
 * - Verifica permiso RBAC vacaciones.solicitudes.aprobar_jefe
 * - Valida estado = pendiente
 * - Verifica scope departamental (jefe del mismo depto)
 * - Actualiza solicitud a aprobada_jefe
 * - Control optimista con version
 */
export async function aprobarSolicitudJefe(
  solicitudId: number,
  jefeId: number,
  observaciones?: string
) {
  // 1. Verificar permiso RBAC
  const validacionPermiso = await usuarioTienePermiso(jefeId, 'vacaciones.solicitudes.aprobar_jefe');
  
  if (!validacionPermiso.tienePermiso) {
    throw new Error(`Permiso denegado: ${validacionPermiso.razon || 'No tiene permiso para aprobar solicitudes como jefe'}`);
  }

  // 2. Obtener solicitud con relaciones (usuario y su departamento)
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId),
    with: {
      usuario: {
        columns: {
          id: true,
          nombre: true,
          apellido: true,
          departamentoId: true
        }
      }
    }
  });

  if (!solicitud) {
    throw new Error("Solicitud no encontrada");
  }

  // 3. Validar estado = pendiente
  if (solicitud.estado !== 'pendiente') {
    throw new Error(`No se puede aprobar. Estado actual: ${solicitud.estado}`);
  }

  // 4. Obtener departamento del jefe
  const jefe = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, jefeId),
    columns: {
      id: true,
      departamentoId: true
    }
  });

  if (!jefe) {
    throw new Error("Jefe no encontrado");
  }

  // 5. Verificar scope departamental (jefe del mismo depto)
  if (jefe.departamentoId !== solicitud.usuario.departamentoId) {
    throw new Error("Solo puedes aprobar solicitudes de tu departamento");
  }

  // 6. Actualizar solicitud con control optimista (version)
  try {
    const [solicitudActualizada] = await db
      .update(solicitudes)
      .set({
        estado: 'aprobada_jefe',
        aprobadoPor: jefeId,
        fechaAprobacionJefe: new Date(),
        observaciones: observaciones || solicitud.observaciones,
        version: sql`${solicitudes.version} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(solicitudes.id, solicitudId),
          eq(solicitudes.version, solicitud.version) // Control optimista - evita lost updates
        )
      )
      .returning();

    if (!solicitudActualizada) {
      throw new Error("Conflicto de versión: la solicitud fue modificada por otro usuario. Intenta nuevamente.");
    }

    return solicitudActualizada;
  } catch (error) {
    console.error('❌ Error al aprobar solicitud (Jefe):', error);
    throw new Error(`Error al aprobar solicitud: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * 1.4 Aprobar solicitud por RRHH (aprobación final)
 * - Verifica permiso RBAC vacaciones.solicitudes.aprobar_rrhh
 * - Valida estado = aprobada_jefe
 * - Actualiza solicitud a aprobada (final)
 * - Mueve días: cantidadPendiente → cantidadUtilizada
 * - Registra fecha de aprobación
 */
export async function aprobarSolicitudRRHH(
  solicitudId: number,
  rrhhId: number,
  observaciones?: string
) {
  // 1. Verificar permiso RBAC
  const validacionPermiso = await usuarioTienePermiso(rrhhId, 'vacaciones.solicitudes.aprobar_rrhh');
  
  if (!validacionPermiso.tienePermiso) {
    throw new Error(`Permiso denegado: ${validacionPermiso.razon || 'No tiene permiso para aprobar solicitudes como RRHH'}`);
  }

  // 2. Obtener solicitud con relaciones
  const solicitud = await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, solicitudId),
    with: {
      usuario: {
        columns: {
          id: true,
          nombre: true,
          apellido: true,
          departamentoId: true
        }
      }
    }
  });

  if (!solicitud) {
    throw new Error("Solicitud no encontrada");
  }

  // 3. Validar estado = aprobada_jefe
  if (solicitud.estado !== 'aprobada_jefe') {
    throw new Error(`No se puede aprobar. Estado actual: ${solicitud.estado}. Debe estar en estado 'aprobada_jefe'`);
  }

  // 4. Obtener balance del usuario
  const anio = new Date(solicitud.fechaInicio).getFullYear();
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, solicitud.usuarioId),
      eq(balancesAusencias.anio, anio),
      eq(balancesAusencias.estado, 'activo')
    )
  });

  if (!balance) {
    throw new Error(`Balance no encontrado para el año ${anio}`);
  }

  // 5. Validar que balance tiene suficiente pendiente
  const diasSolicitud = Number(solicitud.cantidad);
  const diasPendientes = Number(balance.cantidadPendiente);

  if (diasPendientes < diasSolicitud) {
    throw new Error(`Balance insuficiente. Días pendientes: ${diasPendientes}, Días solicitados: ${diasSolicitud}`);
  }

  // 6. Actualizar solicitud y balance en transacción
  try {
    await db.transaction(async (trx) => {
      // Actualizar solicitud con control optimista
      const [solicitudActualizada] = await trx
        .update(solicitudes)
        .set({
          estado: 'aprobada',
          aprobadoRrhhPor: rrhhId,
          fechaAprobacionRrhh: new Date(),
          observaciones: observaciones || solicitud.observaciones,
          version: sql`${solicitudes.version} + 1`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(solicitudes.id, solicitudId),
            eq(solicitudes.version, solicitud.version)
          )
        )
        .returning();

      if (!solicitudActualizada) {
        throw new Error("Conflicto de versión: la solicitud fue modificada por otro usuario. Intenta nuevamente.");
      }

      // Mover días: cantidadPendiente → cantidadUtilizada
      await trx
        .update(balancesAusencias)
        .set({
          cantidadPendiente: sql`${balancesAusencias.cantidadPendiente} - ${diasSolicitud}`,
          cantidadUtilizada: sql`${balancesAusencias.cantidadUtilizada} + ${diasSolicitud}`,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
    });

    // 7. Retornar solicitud actualizada
    const solicitudFinal = await db.query.solicitudes.findFirst({
      where: eq(solicitudes.id, solicitudId)
    });

    return solicitudFinal;
  } catch (error) {
    console.error('❌ Error al aprobar solicitud (RRHH):', error);
    throw new Error(`Error al aprobar solicitud: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

