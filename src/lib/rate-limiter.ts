/**
 * ============================================================
 * RATE LIMITER (Postgres-backed)
 * ============================================================
 * @description Mitigación de Fuerza Bruta (OWASP A07:2026).
 * Persistido en Postgres (tabla `rate_limits`) para que funcione
 * de forma consistente en despliegues multi-instancia / serverless,
 * donde la memoria de proceso se reinicia con cada cold start.
 *
 * Estrategia: contador con ventana fija por identificador (email/IP),
 * resuelto atómicamente con un UPSERT (INSERT ... ON CONFLICT).
 *
 * Política fail-open: si la BD no responde, se permite el intento
 * (registrando el error) para no bloquear el acceso de todos los
 * usuarios por una incidencia de infraestructura.
 * ============================================================
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const MAX_ATTEMPTS = 5; // Intentos máximos por ventana
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos de bloqueo

function firstRow(result: unknown): any {
  if (Array.isArray(result)) return result[0];
  const rows = (result as any)?.rows;
  return Array.isArray(rows) ? rows[0] : undefined;
}

export async function checkRateLimit(
  identifier: string
): Promise<{ allowed: boolean; remainingMs: number }> {
  const windowSeconds = Math.floor(WINDOW_MS / 1000);

  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limits (identifier, count, reset_time, updated_at)
      VALUES (${identifier}, 1, NOW() + (${windowSeconds} * INTERVAL '1 second'), NOW())
      ON CONFLICT (identifier) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_time < NOW() THEN 1 ELSE rate_limits.count + 1 END,
        reset_time = CASE WHEN rate_limits.reset_time < NOW()
          THEN NOW() + (${windowSeconds} * INTERVAL '1 second')
          ELSE rate_limits.reset_time END,
        updated_at = NOW()
      RETURNING count, EXTRACT(EPOCH FROM (reset_time - NOW())) * 1000 AS remaining_ms
    `);

    const row = firstRow(result);
    const count = Number(row?.count ?? 1);
    const remainingMs = Math.max(0, Math.round(Number(row?.remaining_ms ?? 0)));

    if (count > MAX_ATTEMPTS) {
      return { allowed: false, remainingMs };
    }
    return { allowed: true, remainingMs: 0 };
  } catch (error) {
    // Fail-open: no bloquear logins por un fallo de infraestructura.
    console.error('[RateLimiter] Error consultando rate_limits, permitiendo intento:', error);
    return { allowed: true, remainingMs: 0 };
  }
}

export async function resetRateLimit(identifier: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM rate_limits WHERE identifier = ${identifier}`);
  } catch (error) {
    console.error('[RateLimiter] Error reseteando rate_limits:', error);
  }
}
