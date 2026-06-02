/**
 * ============================================================
 * INICIALIZACIÓN SEGURA DE BASE DE DATOS EN PRODUCCIÓN (AWS)
 * ============================================================
 * Ejecuta: MIGRACIÓN → TRIGGERS → SEED
 * NO BORRA DATOS. Es seguro ejecutarlo en cada despliegue.
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no configurada en .env.production');
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL === 'true';

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

const db = drizzle(sql);

async function initProd() {
  console.log('🚀 =============================================');
  console.log('🚀 INICIALIZACIÓN DE PRODUCCIÓN AWS EC2');
  console.log('🚀 =============================================\n');

  try {
    // ===== PASO 1: MIGRACIÓN SEGURO (Drizzle) =====
    console.log('📦 [1/3] MIGRACIÓN DE ESQUEMA (Safe)...');
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('   ✅ Tablas e índices actualizados.\n');

    // ===== PASO 2: BUSINESS LOGIC =====
    console.log('⚙️  [2/3] TRIGGERS & FUNCIONES...');
    const businessLogic = readFileSync('database/09_cni_business_logic.sql', 'utf-8');
    
    const blocks = businessLogic.split(/(?=CREATE OR REPLACE FUNCTION|CREATE TRIGGER|CREATE OR REPLACE TRIGGER)/gi);
    
    let functionsCreated = 0;
    let triggersCreated = 0;
    
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;
      
      try {
        await sql.unsafe(trimmed);
        if (trimmed.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) functionsCreated++;
        if (trimmed.toUpperCase().includes('CREATE TRIGGER')) triggersCreated++;
      } catch (error) {
        // Ignorar error de que el trigger ya existe
        if (!error.message.includes('already exists')) {
          console.error(`   ⚠️  Error:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Lógica de negocio aplicada (${functionsCreated} funciones).\n`);

    // ===== PASO 3: SEED =====
    console.log('📊 [3/3] SEED DE DATOS BASE...\n');
    execSync('pnpm exec tsx scripts/seed-database.ts', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // ===== PASO 4: ADMIN EXTRA =====
    console.log('\n🛡️  INYECCIÓN DE ADMINS EXTRA...');
    execSync('pnpm exec tsx scripts/create-admin.ts', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    console.log('\n🎉 =============================================');
    console.log('🎉 ¡BASE DE DATOS LISTA PARA PRODUCCIÓN!');
    console.log('🎉 =============================================\n');

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message || error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

initProd();
