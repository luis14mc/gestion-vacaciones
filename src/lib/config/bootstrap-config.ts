/**
 * Materialización de configuración en BD (solo servidor).
 */
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import {
  CONFIG_KEYS,
  CONFIG_DEFAULT_VALUES,
  getConfigMeta,
} from '@/lib/config/catalog';

export {
  CONFIG_PASSWORD_MASK,
  SMTP_PASSWORD_CLAVE,
  prepararConfiguracionParaCliente,
  debeOmitirActualizacionSmtpPassword,
  metaParaClave,
  resolverConfigItem,
  type ConfiguracionFila,
  type ConfiguracionCliente,
} from '@/lib/config/config-client';

export interface ResultadoAsegurarConfig {
  insertadas: number;
  totalCatalogo: number;
}

type ConfigDb = Pick<typeof db, 'select' | 'insert'>;

/** Inserta en BD únicamente las claves del catálogo que aún no existen. */
export async function asegurarConfiguracionesEnDb(
  database: ConfigDb = db
): Promise<ResultadoAsegurarConfig> {
  const existentes = await database.select({ clave: configuracion.clave }).from(configuracion);
  const enBd = new Set(existentes.map((f) => f.clave));
  const ahora = new Date().toISOString();
  let insertadas = 0;

  for (const clave of CONFIG_KEYS) {
    if (enBd.has(clave)) continue;

    const meta = getConfigMeta(clave);
    await database.insert(configuracion).values({
      clave,
      valor: CONFIG_DEFAULT_VALUES[clave] ?? '',
      categoria: meta.categoria,
      tipoDato: meta.tipoDato,
      esPublico: meta.esPublico,
      updatedAt: ahora,
    });

    insertadas++;
    enBd.add(clave);
  }

  return { insertadas, totalCatalogo: CONFIG_KEYS.size };
}

export async function asegurarConfiguracionesBase(): Promise<ResultadoAsegurarConfig> {
  return asegurarConfiguracionesEnDb(db);
}
