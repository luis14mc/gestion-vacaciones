import { db, balancesAusencias, solicitudes } from "@/core/infrastructure/database";
import { eq, and, sql } from "drizzle-orm";

/**
 * Servicio centralizado para gestión de balances de ausencias
 */

export interface BalanceUsuario {
  diasAsignados: number;
  diasUsados: number;
  diasPendientes: number;
  diasDisponibles: number;
}

/**
 * Calcula el balance actual de un usuario para un año específico
 */
export async function calcularBalanceUsuario(
  usuarioId: number,
  anio: number = new Date().getFullYear()
): Promise<BalanceUsuario> {
  
  // 1. Obtener balance asignado
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, usuarioId),
      eq(balancesAusencias.anio, anio),
      eq(balancesAusencias.estado, 'activo')
    )
  });

  if (!balance) {
    return {
      diasAsignados: 0,
      diasUsados: 0,
      diasPendientes: 0,
      diasDisponibles: 0
    };
  }

  const diasAsignados = Number(balance.cantidadAsignada || 0);
  const diasUsados = Number(balance.cantidadUtilizada || 0);

  // 2. Calcular días pendientes (solicitudes en proceso)
  const [pendientesResult] = await db
    .select({ 
      total: sql<number>`COALESCE(SUM(${solicitudes.cantidad}::numeric), 0)` 
    })
    .from(solicitudes)
    .where(
      and(
        eq(solicitudes.usuarioId, usuarioId),
        sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe')`,
        sql`EXTRACT(YEAR FROM ${solicitudes.fechaInicio}) = ${anio}`
      )
    );

  const diasPendientes = Number(pendientesResult?.total || 0);

  // 3. Calcular disponibles
  const diasDisponibles = diasAsignados - diasUsados - diasPendientes;

  return {
    diasAsignados,
    diasUsados,
    diasPendientes,
    diasDisponibles: Math.max(0, diasDisponibles) // No puede ser negativo
  };
}

/**
 * Valida si un usuario puede crear una solicitud
 */
export async function validarSolicitud(
  usuarioId: number,
  dias: number,
  fechaInicio: Date,
  fechaFin: Date
): Promise<{ valido: boolean; error?: string }> {
  
  const anio = fechaInicio.getFullYear();
  const balance = await calcularBalanceUsuario(usuarioId, anio);

  // Validación 1: Días disponibles
  if (dias > balance.diasDisponibles) {
    return {
      valido: false,
      error: `No tienes suficientes días disponibles. Disponibles: ${balance.diasDisponibles}, Solicitados: ${dias}`
    };
  }

  // Validación 2: Fechas en el futuro
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  if (fechaInicio < hoy) {
    return {
      valido: false,
      error: 'La fecha de inicio debe ser futura'
    };
  }

  // Validación 3: Rango de fechas válido
  if (fechaFin < fechaInicio) {
    return {
      valido: false,
      error: 'La fecha de fin debe ser posterior a la fecha de inicio'
    };
  }

  // Validación 4: No hay solicitudes superpuestas
  const superpuestas = await db
    .select({ id: solicitudes.id })
    .from(solicitudes)
    .where(
      and(
        eq(solicitudes.usuarioId, usuarioId),
        sql`${solicitudes.estado} IN ('pendiente', 'aprobada_jefe', 'aprobada', 'en_uso')`,
        sql`(
          (${solicitudes.fechaInicio} <= ${fechaFin} AND ${solicitudes.fechaFin} >= ${fechaInicio})
        )`
      )
    )
    .limit(1);

  if (superpuestas.length > 0) {
    return {
      valido: false,
      error: 'Ya tienes una solicitud en estas fechas'
    };
  }

  return { valido: true };
}

/**
 * Actualiza el balance después de aprobar/rechazar una solicitud
 */
export async function actualizarBalancePorSolicitud(
  usuarioId: number,
  dias: number,
  accion: 'aprobar' | 'rechazar' | 'uso' | 'completar',
  anio: number = new Date().getFullYear()
): Promise<void> {
  
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, usuarioId),
      eq(balancesAusencias.anio, anio),
      eq(balancesAusencias.estado, 'activo')
    )
  });

  if (!balance) {
    throw new Error('Balance no encontrado');
  }

  switch (accion) {
    case 'aprobar':
      // Al aprobar: mantener en pendiente (ya está considerado)
      break;

    case 'rechazar':
      // Al rechazar: liberar días pendientes
      await db
        .update(balancesAusencias)
        .set({
          cantidadPendiente: sql`${balancesAusencias.cantidadPendiente} - ${dias}`,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
      break;

    case 'uso':
      // Al entrar en uso: mover de pendiente a utilizada
      await db
        .update(balancesAusencias)
        .set({
          cantidadPendiente: sql`${balancesAusencias.cantidadPendiente} - ${dias}`,
          cantidadUtilizada: sql`${balancesAusencias.cantidadUtilizada} + ${dias}`,
          updatedAt: new Date()
        })
        .where(eq(balancesAusencias.id, balance.id));
      break;

    case 'completar':
      // Al completar: ya está en utilizada, no hacer nada
      break;
  }
}

/**
 * Registra días pendientes al crear una solicitud
 */
export async function registrarDiasPendientes(
  usuarioId: number,
  dias: number,
  anio: number = new Date().getFullYear()
): Promise<void> {
  
  const balance = await db.query.balancesAusencias.findFirst({
    where: and(
      eq(balancesAusencias.usuarioId, usuarioId),
      eq(balancesAusencias.anio, anio),
      eq(balancesAusencias.estado, 'activo')
    )
  });

  if (!balance) {
    throw new Error('Balance no encontrado');
  }

  await db
    .update(balancesAusencias)
    .set({
      cantidadPendiente: sql`${balancesAusencias.cantidadPendiente} + ${dias}`,
      updatedAt: new Date()
    })
    .where(eq(balancesAusencias.id, balance.id));
}
