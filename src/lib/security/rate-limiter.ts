/**
 * ============================================================
 * RATE LIMITER - In-memory sliding window
 * ============================================================
 * @description Rate limiting sin dependencias externas.
 *   Usa Map con sliding window para controlar requests.
 *   Para producción con múltiples instancias: usar Redis.
 * @version 1.0
 * ============================================================
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  /** Máximo de requests permitidos en la ventana */
  maxRequests: number;
  /** Ventana de tiempo en milisegundos */
  windowMs: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    // Limpiar entradas expiradas cada minuto
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Verificar si un key puede hacer un request.
   * @returns { allowed: boolean, remaining: number, resetMs: number }
   */
  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Filtrar timestamps dentro de la ventana
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= this.config.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + this.config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 0),
      };
    }

    // Permitir y registrar
    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// =====================================================
// INSTANCIAS PRE-CONFIGURADAS
// =====================================================

/** Login: 5 intentos por minuto por IP */
export const loginLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

/** API general: 100 requests por minuto por IP */
export const apiLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60_000,
});

/** Creación de solicitudes: 10 por hora por usuario */
export const solicitudLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 3600_000,
});

/** Exportación: 5 por minuto */
export const exportLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

// =====================================================
// HELPER para Next.js API routes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware helper para aplicar rate limiting en rutas API.
 * @example
 * export async function POST(req: NextRequest) {
 *   const limited = checkRateLimit(req, loginLimiter);
 *   if (limited) return limited;
 *   // ...
 * }
 */
export function checkRateLimit(
  req: NextRequest,
  limiter: RateLimiter,
  keyOverride?: string
): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const key = keyOverride || ip;
  const { allowed, remaining, retryAfterMs } = limiter.check(key);

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null; // Allowed
}
