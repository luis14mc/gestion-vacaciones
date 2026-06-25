/**
 * ============================================================
 * DATABASE CLIENT & SCHEMA EXPORTS
 * ============================================================
 * @description Cliente Drizzle configurado + Schema CNI
 * @version 5.0 - Arquitectura Limpia CNI
 * ============================================================
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================
// CONEXIÓN POSTGRESQL
// ============================================================
const connectionString = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada');
}

const dbHost = new URL(connectionString).hostname;
const isLocalDb = ['localhost', '127.0.0.1', '::1', 'postgres', 'cni-postgres'].includes(dbHost);
const useSsl = databaseSsl ? databaseSsl === 'true' : !isLocalDb;

// Cliente PostgreSQL
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

// Cliente Drizzle ORM
export const db = drizzle(client, { schema });

// ============================================================
// EXPORTAR SCHEMA COMPLETO
// ============================================================
export * from './schema';
