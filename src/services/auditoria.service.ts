/**
 * ============================================================
 * AUDITORÍA SERVICE
 * ============================================================
 * Punto único para registrar eventos en `registros_auditoria`.
 * Antes el módulo de auditoría era decorativo: la tabla no se escribía
 * desde ninguna acción. Este servicio instrumenta las acciones críticas.
 *
 * Es deliberadamente NO bloqueante: si el registro de auditoría falla,
 * se loguea pero NUNCA rompe la operación de negocio que lo invocó.
 *
 * Convención de `accion` (compatible con el filtro del cliente):
 *   crear | actualizar | eliminar | login | logout | login_fallido
 * El evento específico (p.ej. aprobar_rrhh, cambio_rol) va en `detalles`.
 * ============================================================
 */

import { db } from '@/lib/db';
import { registrosAuditoria } from '@/lib/db/schema';

export type AccionAuditoria =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'login'
  | 'logout'
  | 'login_fallido';

export interface RegistrarAuditoriaParams {
  usuarioId: number;
  accion: AccionAuditoria | string;
  tablaAfectada: string;
  registroId?: number | null;
  detalles?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  try {
    await db.insert(registrosAuditoria).values({
      usuarioId: params.usuarioId,
      accion: String(params.accion).slice(0, 50),
      tablaAfectada: params.tablaAfectada.slice(0, 50),
      registroId: params.registroId ?? null,
      detalles:
        params.detalles === undefined || params.detalles === null
          ? null
          : typeof params.detalles === 'string'
            ? params.detalles
            : JSON.stringify(params.detalles),
      ipAddress: params.ipAddress ? params.ipAddress.slice(0, 45) : null,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    // No bloquear la operación de negocio por un fallo de auditoría.
    console.error('[auditoria] No se pudo registrar el evento:', error);
  }
}

/** Extrae IP y user-agent de una petición entrante. */
export function datosPeticion(request: Request): { ipAddress: string; userAgent: string } {
  const fwd = request.headers.get('x-forwarded-for');
  const ipAddress =
    (fwd ? fwd.split(',')[0]?.trim() : null) ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return { ipAddress, userAgent };
}
