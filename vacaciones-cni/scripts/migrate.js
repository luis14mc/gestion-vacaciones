import { db } from '../src/lib/db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para ejecutar migraciones SQL
 * Uso: node scripts/migrate.js
 */

async function executeMigration() {
  console.log('🚀 Iniciando migraciones...\n');

  try {
    // Leer archivo SQL
    const sqlPath = path.join(__dirname, '../migrations/001_schema_improvements.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Archivo de migración cargado');
    console.log(`📍 Ruta: ${sqlPath}\n`);

    // Dividir en statements individuales (por "-- ✅")
    const statements = sqlContent
      .split(/-- ✅/)
      .filter(s => s.trim().length > 0);

    console.log(`📊 Total de secciones: ${statements.length}\n`);

    // Ejecutar cada sección
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;

      // Extraer título de la sección
      const titleMatch = statement.match(/PASO \d+: (.+)/);
      const title = titleMatch ? titleMatch[1] : `Sección ${i + 1}`;

      console.log(`⏳ Ejecutando: ${title}...`);

      try {
        await db.execute(statement);
        console.log(`✅ Completado: ${title}\n`);
      } catch (error) {
        console.error(`❌ Error en: ${title}`);
        console.error(error.message);
        
        // Continuar con siguientes secciones si es posible
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Ya existe, continuando...\n`);
        } else {
          throw error;
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIONES COMPLETADAS EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Resumen
    console.log('📊 Resumen de cambios:');
    console.log('  ✅ Tablas RBAC creadas (roles, permisos, roles_permisos, usuarios_roles)');
    console.log('  ✅ Foreign Keys agregados a todas las tablas');
    console.log('  ✅ Índices compuestos creados');
    console.log('  ✅ Check Constraints agregados');
    console.log('  ✅ Triggers de versioning activados');
    console.log('  ✅ Usuarios migrados al sistema RBAC');
    console.log('  ✅ Vista de compatibilidad creada\n');

    // Verificaciones
    console.log('🔍 Verificando cambios...');
    
    const roles = await db.execute('SELECT COUNT(*) as count FROM roles');
    console.log(`  👥 Roles creados: ${roles.rows[0].count}`);

    const permisos = await db.execute('SELECT COUNT(*) as count FROM permisos');
    console.log(`  🔐 Permisos creados: ${permisos.rows[0].count}`);

    const usuariosRoles = await db.execute('SELECT COUNT(*) as count FROM usuarios_roles');
    console.log(`  🔗 Asignaciones de roles: ${usuariosRoles.rows[0].count}\n`);

    console.log('✅ Sistema RBAC listo para usar');
    console.log('📚 Ver MEJORAS_IMPLEMENTADAS.md para documentación completa\n');

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR EN MIGRACIONES');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Mensaje:', error.message);
    console.error('\nDetalles:', error);
    
    console.log('\n💡 Sugerencias:');
    console.log('  1. Verificar conexión a base de datos');
    console.log('  2. Verificar permisos de usuario');
    console.log('  3. Revisar si algunas tablas ya existen');
    console.log('  4. Ejecutar migraciones manualmente desde psql\n');
    
    process.exit(1);
  } finally {
    // Cerrar conexión
    await db.end();
  }
}

// Ejecutar
executeMigration();
