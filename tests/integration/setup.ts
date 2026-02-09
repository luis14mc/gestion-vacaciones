/**
 * =====================================================
 * INTEGRATION TESTS SETUP - CNI Schema
 * =====================================================
 * @description Setup global para tests de integración
 * @version 5.0 - Arquitectura CNI Limpia
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, eq } from 'drizzle-orm';
import { beforeAll, afterEach, afterAll } from 'vitest';
import * as schema from '../../src/lib/db/schema';

// =====================================================
// CARGAR VARIABLES DE ENTORNO
// =====================================================
config({ path: resolve(__dirname, '../../.env') }); // Usar misma BD

// =====================================================
// CONEXIÓN A BASE DE DATOS
// =====================================================
let client: ReturnType<typeof postgres>;
let db: PostgresJsDatabase<typeof schema>;

// =====================================================
// SETUP GLOBAL
// =====================================================
beforeAll(async () => {
  console.log('\n🧪 ========================================');
  console.log('🧪 SETUP INTEGRATION TESTS - CNI');
  console.log('🧪 ========================================\n');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada');
  }

  client = postgres(process.env.DATABASE_URL + '?sslmode=require', {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  db = drizzle(client, { schema });
  
  console.log('✅ Conexión a BD establecida');
  
  // Verificar esquema
  try {
    await db.execute(sql`SELECT 1 FROM usuarios LIMIT 1`);
    console.log('✅ Esquema CNI verificado\n');
  } catch (error) {
    console.error('❌ Error: Ejecuta pnpm db:install');
    throw error;
  }
});

// =====================================================
// LIMPIEZA DESPUÉS DE CADA TEST
// =====================================================
afterEach(async () => {
  // Limpiar solicitudes de prueba (metadata.test = true)
  await db.execute(sql`
    DELETE FROM solicitudes 
    WHERE metadata->>'test' = 'true'
  `);
  
  // Limpiar historial_balances de prueba
  await db.execute(sql`
    DELETE FROM historial_balances 
    WHERE metadata->>'test' = 'true'
  `);
  
  // NO limpiar balances (se reutilizan del seed)
});

// =====================================================
// TEARDOWN GLOBAL
// =====================================================
afterAll(async () => {
  console.log('\n🧹 Cerrando conexiones...');
  await client.end();
  console.log('✅ Conexión cerrada\n');
});

// =====================================================
// EXPORTAR
// =====================================================
export { db, client };

// =====================================================
// HELPERS
// =====================================================

/**
 * Obtener usuario de seed por email
 */
export async function getSeedUser(email: string) {
  const user = await db.query.usuarios.findFirst({
    where: eq(schema.usuarios.email, email),
  });
  
  if (!user) {
    throw new Error(`Usuario ${email} no encontrado. Ejecuta pnpm db:install`);
  }
  
  return user;
}

/**
 * Obtener año laboral activo
 */
export async function getCurrentAnoLaboral() {
  const ano = await db.query.anosLaborales.findFirst({
    where: eq(schema.anosLaborales.activo, true),
  });
  
  if (!ano) {
    throw new Error('No hay año laboral activo. Ejecuta pnpm db:install');
  }
  
  return ano;
}

/**
 * Obtener balance de un usuario
 */
export async function getBalance(usuarioId: number, tipoAusencia: 'vacaciones' | 'licencia_medica' | 'permiso_personal' = 'vacaciones') {
  const anoLaboral = await getCurrentAnoLaboral();
  
  const balance = await db.query.balances.findFirst({
    where: sql`${schema.balances.usuarioId} = ${usuarioId} 
               AND ${schema.balances.anoLaboralId} = ${anoLaboral.id}
               AND ${schema.balances.tipoAusencia} = ${tipoAusencia}`,
  });
  
  if (!balance) {
    throw new Error(`No hay balance para usuario ${usuarioId}. Ejecuta pnpm db:install`);
  }
  
  return balance;
}

/**
 * Restablecer balance a estado inicial (para tests)
 */
export async function resetBalance(balanceId: number) {
  await db.update(schema.balances)
    .set({
      cantidadUsada: '0',
      cantidadPendiente: '0',
      // cantidad_disponible se recalcula automáticamente por trigger
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.balances.id, balanceId));
}

/**
 * Obtener tipo de ausencia por código
 * En CNI, los tipos de ausencia son enums, no tabla.
 * Este helper retorna el valor del enum directamente.
 */
export async function getTipoAusencia(codigo: 'vacaciones' | 'licencia_medica' | 'permiso_personal' | 'permiso_salida' | 'licencia_paternidad') {
  // En CNI schema, tipo_ausencia es un enum, no una tabla
  // Retornamos un objeto compatible para backwards compat
  return {
    id: 0,
    codigo,
    nombre: codigo.replace(/_/g, ' '),
  };
}

/**
 * Crear balance de prueba para tests
 * (Simula el comportamiento anterior pero usa el balance existente del seed)
 */
export async function createTestBalance(data: {
  usuarioId: number;
  anoLaboralId: number;
  cantidadAsignada: number;
}) {
  const anoLaboral = await getCurrentAnoLaboral();
  
  // Buscar balance existente del seed
  let balance = await db.query.balances.findFirst({
    where: sql`${schema.balances.usuarioId} = ${data.usuarioId} 
               AND ${schema.balances.anoLaboralId} = ${anoLaboral.id}
               AND ${schema.balances.tipoAusencia} = 'vacaciones'`,
  });
  
  if (balance) {
    // Si existe, resetearlo
    await resetBalance(balance.id);
    
    // Actualizar cantidad asignada si es diferente
    if (balance.cantidadInicial !== String(data.cantidadAsignada)) {
      await db.update(schema.balances)
        .set({
          cantidadInicial: String(data.cantidadAsignada),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.balances.id, balance.id));
    }
    
    // Refetch
    balance = await db.query.balances.findFirst({
      where: eq(schema.balances.id, balance.id),
    });
  }
  
  if (!balance) {
    throw new Error(`No se pudo crear/obtener balance para usuario ${data.usuarioId}`);
  }
  
  return balance;
}
