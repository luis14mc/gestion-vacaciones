/**
 * ============================================================
 * RATE LIMITER (In-Memory)
 * ============================================================
 * @description Mitigación de Fuerza Bruta (OWASP A07:2026).
 * Implementación de Token Bucket en memoria para limitar
 * intentos de inicio de sesión por email y/o IP.
 * Nota: En un entorno distribuido o serverless (ej. Vercel),
 * esta memoria se reinicia con cada cold start. Para producción
 * a gran escala, se recomienda Redis o PostgreSQL.
 * ============================================================
 */

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const loginAttempts = new Map<string, RateLimitInfo>();

const MAX_ATTEMPTS = 5; // Intentos máximos
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos de bloqueo

export function checkRateLimit(identifier: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  if (!attempt) {
    // Primer intento
    loginAttempts.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remainingMs: 0 };
  }

  // Si ya pasó la ventana de tiempo, resetear
  if (now > attempt.resetTime) {
    loginAttempts.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remainingMs: 0 };
  }

  // Si aún está dentro de la ventana y superó el límite
  if (attempt.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingMs: attempt.resetTime - now };
  }

  // Incrementar contador
  attempt.count += 1;
  loginAttempts.set(identifier, attempt);
  
  return { allowed: true, remainingMs: 0 };
}

export function resetRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}
