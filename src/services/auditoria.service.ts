/**
 * ============================================================
 * AUDITORÍA SERVICE
 * ============================================================
 * Punto único para registrar eventos en `registros_auditoria`.
 * No bloqueante: fallos se loguean sin romper la operación de negocio.
 * ============================================================
 */

import { db } from '@/lib/db';
import { registrosAuditoria } from '@/lib/db/schema';
import { sanitizarDetallesAuditoria } from '@/lib/domain/auditoria/sanitize';

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

export interface RegistrarEventoAuditoriaParams extends RegistrarAuditoriaParams {
  modulo?: string;
  evento?: string;
  severidad?: 'info' | 'advertencia' | 'critico';
  resultado?: 'exito' | 'fallo' | 'parcial';
  entidadNombre?: string;
}

function serializarDetalles(detalles: unknown): string | null {
  if (detalles === undefined || detalles === null) return null;
  if (typeof detalles === 'string') return detalles.slice(0, 8000);
  return JSON.stringify(detalles).slice(0, 8000);
}

export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  try {
    const detallesSanitizados = sanitizarDetallesAuditoria(params.detalles);

    await db.insert(registrosAuditoria).values({
      usuarioId: params.usuarioId,
      accion: String(params.accion).slice(0, 50),
      tablaAfectada: params.tablaAfectada.slice(0, 50),
      registroId: params.registroId ?? null,
      detalles: serializarDetalles(detallesSanitizados),
      ipAddress: params.ipAddress ? params.ipAddress.slice(0, 45) : null,
      userAgent: params.userAgent ? params.userAgent.slice(0, 2000) : null,
    });
  } catch (error) {
    console.error('[auditoria] No se pudo registrar el evento:', error);
  }
}

export async function registrarEventoAuditoria(
  params: RegistrarEventoAuditoriaParams
): Promise<void> {
  const base =
    params.detalles && typeof params.detalles === 'object' && !Array.isArray(params.detalles)
      ? (params.detalles as Record<string, unknown>)
      : params.detalles !== undefined
        ? { payload: params.detalles }
        : {};

  const detalles = sanitizarDetallesAuditoria({
    ...base,
    modulo: params.modulo,
    evento: params.evento,
    severidad: params.severidad ?? 'info',
    resultado: params.resultado ?? 'exito',
    entidadNombre: params.entidadNombre,
  });

  await registrarAuditoria({
    usuarioId: params.usuarioId,
    accion: params.accion,
    tablaAfectada: params.tablaAfectada,
    registroId: params.registroId,
    detalles,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
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
