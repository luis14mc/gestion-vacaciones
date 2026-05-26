import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no configurada en .env');
  process.exit(1);
}

// Conexión para migraciones (requiere max: 1)
const useSsl = process.env.DATABASE_SSL === 'true';

const migrationClient = postgres(DATABASE_URL, {
  max: 1,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

const db = drizzle(migrationClient);

async function main() {
  console.log('🚀 Iniciando migración de base de datos en producción...');
  try {
    await migrate(db, { migrationsFolder: resolve('drizzle') });
    console.log('✅ Migraciones aplicadas correctamente.');
  } catch (error) {
    console.error('❌ Error aplicando migraciones:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

main();
