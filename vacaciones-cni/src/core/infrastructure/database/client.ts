import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Export schema para uso en otros módulos
export * from './schema';
