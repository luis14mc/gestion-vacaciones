/**
 * =====================================================
 * SCRIPT: Crear Usuario Administrador de Soporte TI
 * =====================================================
 * Ejecución: npx tsx scripts/create-admin.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { 
  roles, 
  usuarios, 
  usuariosRoles,
} from '../src/lib/db/schema';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(' ERROR: DATABASE_URL no está configurada en .env');
  process.exit(1);
}

const client = postgres(DATABASE_URL + '?sslmode=require', { 
  max: 1,
  ssl: { rejectUnauthorized: false }
});
const db = drizzle(client);

async function createAdmin() {
  console.log('🚀 Creando usuario administrador de soporte...');

  try {
    // 1. Buscar el rol ADMIN
    const rolesAdmin = await db.select().from(roles).where(eq(roles.codigo, 'ADMIN'));
    if (rolesAdmin.length === 0) {
      console.error('❌ Error: No se encontró el rol ADMIN en la base de datos. Ejecuta el seed primero.');
      process.exit(1);
    }
    const adminRole = rolesAdmin[0];

    // 2. Verificar si el usuario ya existe
    const email = 'soporteit@cni.hn';
    const usuariosExistentes = await db.select().from(usuarios).where(eq(usuarios.email, email));
    
    if (usuariosExistentes.length > 0) {
      console.log(`⚠️ El usuario ${email} ya existe en la base de datos.`);
      process.exit(0);
    }

    // 3. Crear el usuario
    const passwordHash = await bcrypt.hash('Cnihonduras2026$', 10);
    
    const [nuevoAdmin] = await db.insert(usuarios).values({
      email,
      nombre: 'Soporte',
      apellido: 'TI',
      passwordHash,
      cargo: 'Administrador de Sistemas',
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      activo: true,
    }).returning();

    // 4. Asignar el rol ADMIN
    await db.insert(usuariosRoles).values({
      usuarioId: nuevoAdmin.id,
      rolId: adminRole.id,
      activo: true,
    });

    console.log('✅ Usuario creado exitosamente:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: Cnihonduras2026$`);

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await client.end();
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
