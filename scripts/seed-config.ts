#!/usr/bin/env tsx
/**
 * Inserta únicamente las claves de configuración faltantes (idempotente).
 * No sobrescribe valores existentes.
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';
import { asegurarConfiguracionesEnDb } from '../src/lib/config/bootstrap-config';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}

async function main() {
  const useSsl = process.env.DATABASE_SSL === 'true';
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

  const client = postgres(DATABASE_URL!, {
    max: 1,
    ssl: useSsl ? { rejectUnauthorized } : false,
  });

  const db = drizzle(client, { schema });

  try {
    const { insertadas, totalCatalogo } = await asegurarConfiguracionesEnDb(db);
    console.log(
      `Seed de configuración completado. Claves insertadas: ${insertadas} de ${totalCatalogo} en catálogo.`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error en db:seed-config:', error);
  process.exit(1);
});
