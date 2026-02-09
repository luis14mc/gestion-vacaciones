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

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada');
}

// Cliente PostgreSQL
export const client = postgres(connectionString + '?sslmode=require', {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false }
});

// Cliente Drizzle ORM
export const db = drizzle(client, { schema });

// ============================================================
// EXPORTAR SCHEMA COMPLETO
// ============================================================
export * from './schema';
