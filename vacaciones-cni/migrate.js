// Script para ejecutar migración en Neon
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('🔄 Ejecutando migración...');

    // Agregar deleted_at a departamentos
    await sql`
      ALTER TABLE departamentos 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `;
    console.log('✅ Columna deleted_at agregada a departamentos');

    // Agregar deleted_at a usuarios
    await sql`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `;
    console.log('✅ Columna deleted_at agregada a usuarios');

    // Agregar deleted_at a solicitudes
    await sql`
      ALTER TABLE solicitudes 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `;
    console.log('✅ Columna deleted_at agregada a solicitudes');

    // Crear índices
    await sql`
      CREATE INDEX IF NOT EXISTS idx_departamentos_deleted 
      ON departamentos(deleted_at) WHERE deleted_at IS NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_usuarios_deleted 
      ON usuarios(deleted_at) WHERE deleted_at IS NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_solicitudes_deleted 
      ON solicitudes(deleted_at, created_at) WHERE deleted_at IS NULL
    `;
    console.log('✅ Índices creados');

    // Verificar
    const result = await sql`
      SELECT 
          'departamentos' as tabla,
          column_name,
          data_type
      FROM information_schema.columns
      WHERE table_name = 'departamentos' 
        AND column_name = 'deleted_at'
      UNION ALL
      SELECT 
          'usuarios' as tabla,
          column_name,
          data_type
      FROM information_schema.columns
      WHERE table_name = 'usuarios' 
        AND column_name = 'deleted_at'
      UNION ALL
      SELECT 
          'solicitudes' as tabla,
          column_name,
          data_type
      FROM information_schema.columns
      WHERE table_name = 'solicitudes' 
        AND column_name = 'deleted_at'
    `;

    console.log('\n📊 Verificación:');
    console.table(result);

    console.log('\n✅ Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrate();
