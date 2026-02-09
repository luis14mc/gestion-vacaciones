/**
 * ============================================================
 * INSTALACIÓN AUTOMÁTICA COMPLETA DE BASE DE DATOS CNI
 * ============================================================
 * Ejecuta: RESET → MIGRACIÓN → TRIGGERS → SEED
 * Un solo comando instala TODO
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { execSync } from 'child_process';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no configurada en .env');
  process.exit(1);
}

const sql = postgres(DATABASE_URL + '?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function executeSQL(sqlCode, multiStatement = false) {
  if (multiStatement) {
    // Para múltiples statements, ejecutarlos uno por uno
    const statements = sqlCode
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        await sql.unsafe(stmt);
      }
    }
  } else {
    await sql.unsafe(sqlCode);
  }
}

async function installDatabase() {
  console.log('🚀 =============================================');
  console.log('🚀 INSTALACIÓN COMPLETA BD CNI');
  console.log('🚀 =============================================\n');

  try {
    // ===== PASO 1: HARD RESET =====
    console.log('🔥 [1/4] HARD RESET...');
    
    try {
      await sql.unsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
      `);
    } catch (e) {
      // Ignorar si no hay sesiones
    }
    
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
    await sql.unsafe('GRANT ALL ON SCHEMA public TO public');
    await sql.unsafe('SET search_path TO public');
    
    console.log('   ✅ Base de datos limpia\n');

    // ===== PASO 2: MIGRACIÓN =====
    console.log('📦 [2/4] MIGRACIÓN (12 tablas + 5 enums)...');
    
    const migration = readFileSync('drizzle/0000_nappy_viper.sql', 'utf-8');
    const statements = migration.split('--> statement-breakpoint').filter(s => s.trim());
    
    let createdTables = 0;
    let createdIndexes = 0;
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      try {
        await sql.unsafe(trimmed);
        if (trimmed.toUpperCase().startsWith('CREATE TABLE')) createdTables++;
        if (trimmed.toUpperCase().startsWith('CREATE INDEX')) createdIndexes++;
      } catch (error) {
        console.error(`   ⚠️  Error en statement:`, error.message);
      }
    }
    
    console.log(`   ✅ ${createdTables} tablas`);
    console.log(`   ✅ ${createdIndexes} índices\n`);

    // ===== PASO 3: BUSINESS LOGIC =====
    console.log('⚙️  [3/4] TRIGGERS & FUNCIONES...');
    
    const businessLogic = readFileSync('database/09_cni_business_logic.sql', 'utf-8');
    
    // Dividir por CREATE FUNCTION y CREATE TRIGGER
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
        console.error(`   ⚠️  Error:`, error.message);
      }
    }
    
    console.log(`   ✅ ${functionsCreated} funciones`);
    console.log(`   ✅ ${triggersCreated} triggers\n`);

    await sql.end();

    // ===== PASO 4: SEED =====
    console.log('📊 [4/4] SEED (usuarios, roles, departamentos)...\n');
    
    execSync('pnpm tsx scripts/seed-database.ts', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    console.log('\n🎉 =============================================');
    console.log('🎉 ¡BASE DE DATOS LISTA!');
    console.log('🎉 =============================================\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message || error);
    await sql.end();
    process.exit(1);
  }
}

installDatabase();
