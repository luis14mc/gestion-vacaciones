import { db } from "@/lib/db";
import { auditoria } from "@/lib/db/schema";

interface RegistrarAuditoriaParams {
  usuarioId: number;
  accion: "crear" | "actualizar" | "eliminar" | "login" | "logout" | string;
  tablaAfectada: string;
  registroId?: number | null;
  detalles?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Registra una acción en la tabla de auditoría
 */
export async function registrarAuditoria({
  usuarioId,
  accion,
  tablaAfectada,
  registroId,
  detalles,
  ipAddress,
  userAgent,
}: RegistrarAuditoriaParams) {
  try {
    await db.insert(auditoria).values({
      usuarioId,
      accion,
      tablaAfectada,
      registroId: registroId ?? undefined,
      detalles: detalles ? JSON.stringify(detalles) : undefined,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });
  } catch (error) {
    console.error("Error registrando auditoría:", error);
    // No lanzamos el error para no interrumpir la operación principal
  }
}

/**
 * Obtiene la IP del request
 */
export function obtenerIpRequest(request: Request): string | null {
  // Intentar obtener la IP real considerando proxies
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return null;
}

/**
 * Obtiene el User-Agent del request
 */
export function obtenerUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
