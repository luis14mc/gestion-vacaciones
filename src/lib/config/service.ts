/**
 * ============================================================
 * LECTOR DE CONFIGURACIÓN (servidor)
 * ============================================================
 * Resuelve valores de configuración desde la tabla `configuracion`,
 * con fallback a CONFIG_DEFAULT_VALUES del catálogo. Es la vía única
 * para que la lógica de negocio (seguridad, vacaciones, notificaciones,
 * mantenimiento) consuma los ajustes que el admin define en el módulo
 * de Configuración, evitando que esas perillas sean decorativas.
 *
 * Caché en memoria con TTL corto para no golpear la BD en cada request.
 * ============================================================
 */

import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { CONFIG_DEFAULT_VALUES } from './catalog';

const TTL_MS = 30_000; // 30s: balancea frescura vs. carga de BD
const cache = new Map<string, { valor: string; expira: number }>();

/**
 * Lee un conjunto de claves; devuelve un mapa clave→valor (string),
 * usando el default del catálogo cuando la clave no está en BD.
 */
export async function obtenerConfigs(claves: string[]): Promise<Record<string, string>> {
  const ahora = Date.now();
  const resultado: Record<string, string> = {};
  const faltantes: string[] = [];

  for (const clave of claves) {
    const cached = cache.get(clave);
    if (cached && cached.expira > ahora) {
      resultado[clave] = cached.valor;
    } else {
      faltantes.push(clave);
    }
  }

  if (faltantes.length > 0) {
    try {
      const filas = await db
        .select({ clave: configuracion.clave, valor: configuracion.valor })
        .from(configuracion)
        .where(inArray(configuracion.clave, faltantes));

      const enBd = new Map(filas.map((f) => [f.clave, f.valor]));
      for (const clave of faltantes) {
        const valor = enBd.get(clave) ?? CONFIG_DEFAULT_VALUES[clave] ?? '';
        resultado[clave] = valor;
        cache.set(clave, { valor, expira: ahora + TTL_MS });
      }
    } catch (error) {
      // Fail-safe: ante fallo de BD usamos defaults del catálogo.
      console.error('[config] Error leyendo configuracion, usando defaults:', error);
      for (const clave of faltantes) {
        resultado[clave] = CONFIG_DEFAULT_VALUES[clave] ?? '';
      }
    }
  }

  return resultado;
}

export async function obtenerConfig(clave: string): Promise<string> {
  const map = await obtenerConfigs([clave]);
  return map[clave] ?? '';
}

export function asBool(valor: string | undefined): boolean {
  return valor === 'true';
}

export function asNumber(valor: string | undefined, fallback = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

/** Invalida la caché (útil tras un PATCH de configuración o en tests). */
export function invalidarCacheConfig(): void {
  cache.clear();
}
