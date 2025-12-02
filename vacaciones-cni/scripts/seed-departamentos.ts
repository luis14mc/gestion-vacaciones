import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno desde .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { db } from '../src/lib/db';
import { departamentos } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function seedDepartamentos() {
  console.log('🌱 Iniciando seed de departamentos...');

  try {
    // Verificar si ya hay departamentos
    const existing = await db.query.departamentos.findMany();
    
    if (existing.length > 0) {
      console.log(`⚠️  Ya existen ${existing.length} departamentos en la base de datos`);
      console.log('Departamentos existentes:');
      for (const dept of existing) {
        console.log(`  - ${dept.nombre} (ID: ${dept.id}, Código: ${dept.codigo})`);
      }
      console.log('\n🗑️  Eliminando departamentos antiguos...');
      
      // Eliminar todos los departamentos existentes (soft delete)
      for (const dept of existing) {
        await db
          .update(departamentos)
          .set({ deletedAt: new Date() })
          .where(eq(departamentos.id, dept.id));
        console.log(`  ✓ Eliminado: ${dept.nombre}`);
      }
    }

    // Crear departamentos de CNI
    const departamentosEjemplo = [
      {
        nombre: 'Dirección de Innovación y atención al inversionista',
        codigo: 'DIAI',
        descripcion: 'Gestión de innovación y relación con inversionistas',
        activo: true,
      },
      {
        nombre: 'Dirección Técnica de Desarrollo',
        codigo: 'DTD',
        descripcion: 'Desarrollo técnico y proyectos',
        activo: true,
      },
      {
        nombre: 'Dirección de Marketing e Imagen',
        codigo: 'DMI',
        descripcion: 'Marketing, comunicación e imagen corporativa',
        activo: true,
      },
      {
        nombre: 'Dirección Administrativa (Recursos Humanos)',
        codigo: 'DARH',
        descripcion: 'Administración y gestión de recursos humanos',
        activo: true,
      },
      {
        nombre: 'Dirección de Promoción',
        codigo: 'DPROM',
        descripcion: 'Promoción y desarrollo comercial',
        activo: true,
      },
      {
        nombre: 'Secretaría General',
        codigo: 'SECGEN',
        descripcion: 'Coordinación administrativa y secretaría',
        activo: true,
      },
    ];

    console.log(`📝 Insertando ${departamentosEjemplo.length} departamentos...`);

    for (const dept of departamentosEjemplo) {
      const [created] = await db
        .insert(departamentos)
        .values(dept)
        .returning();
      
      console.log(`✅ Creado: ${created.nombre} (ID: ${created.id})`);
    }

    console.log('🎉 Seed completado exitosamente');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  }
}

// Ejecutar el seed
seedDepartamentos()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
