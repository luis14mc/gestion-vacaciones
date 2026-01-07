/**
 * Script para borrar TODAS las tablas de la base de datos
 * ADVERTENCIA: Este script elimina todos los datos
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar .env
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

import { neon } from '@neondatabase/serverless';

async function dropAllTables() {
  console.log('\n🗑️  INICIANDO BORRADO DE TODAS LAS TABLAS\n');
  console.log('⚠️  ADVERTENCIA: Esto eliminará TODOS los datos\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Obtener lista de todas las tablas
    console.log('📋 Obteniendo lista de tablas...');
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    console.log(`\n📊 Tablas encontradas: ${tables.length}\n`);
    
    if (tables.length === 0) {
      console.log('✅ No hay tablas para borrar');
      return;
    }

    tables.forEach((t: any) => console.log(`   - ${t.tablename}`));

    // Borrar todas las tablas usando CASCADE (esto borra las FK automáticamente)
    console.log('\n🗑️  Borrando tablas con CASCADE...');
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`   Borrando: ${tableName}`);
      
      // Usar raw SQL para evitar problemas con nombres de tabla
      await sql.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
    }

    // Verificar que se borraron
    const remaining = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    console.log('\n✅ BORRADO COMPLETADO');
    console.log(`📊 Tablas restantes: ${remaining.length}\n`);

    if (remaining.length > 0) {
      console.log('⚠️  Algunas tablas no se pudieron borrar:');
      remaining.forEach((t: any) => console.log(`   - ${t.tablename}`));
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

dropAllTables()
  .then(() => {
    console.log('🎉 Script completado\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
