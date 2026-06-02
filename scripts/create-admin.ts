/**
 * =====================================================
 * SCRIPT: Crear Usuario Administrador de Soporte TI
 * =====================================================
 * Ejecucion: pnpm exec tsx scripts/create-admin.ts
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

const useSsl = process.env.DATABASE_SSL === 'true';

const client = postgres(DATABASE_URL, { 
  max: 1,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});
const db = drizzle(client);

async function createAdmin() {
  console.log('🚀 Creando usuario administrador de soporte...');

  try {
    // 1. Buscar el rol ADMIN
    const rolesAdmin = await db.select().from(roles).where(eq(roles.codigo, 'ADMIN'));
    if (rolesAdmin.length === 0) {
      throw new Error('No se encontro el rol ADMIN en la base de datos. Ejecuta el seed primero.');
    }
    const adminRole = rolesAdmin[0];

    // 2. Verificar si el usuario ya existe
    const email = process.env.ADMIN_EMAIL || 'soporteit@cni.hn';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD no esta definida en el entorno.');
    }

    const usuariosExistentes = await db.select().from(usuarios).where(eq(usuarios.email, email));
    
    if (usuariosExistentes.length > 0) {
      console.log(`⚠️ El usuario ${email} ya existe en la base de datos, actualizando password y asegurando rol...`);
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const adminExistente = usuariosExistentes[0];
      await db.update(usuarios)
        .set({ passwordHash, esAdmin: true, activo: true })
        .where(eq(usuarios.id, adminExistente.id));
        
      const rolesExistentes = await db.select().from(usuariosRoles).where(eq(usuariosRoles.usuarioId, adminExistente.id));
      const rolAdminExistente = rolesExistentes.find(r => r.rolId === adminRole.id);
      
      if (!rolAdminExistente) {
        await db.insert(usuariosRoles).values({
          usuarioId: adminExistente.id,
          rolId: adminRole.id,
          activo: true,
        });
      } else if (!rolAdminExistente.activo) {
        await db.update(usuariosRoles)
          .set({ activo: true })
          .where(eq(usuariosRoles.id, rolAdminExistente.id));
      }
      
      console.log('✅ Usuario actualizado exitosamente.');
      return;
    }

    // 3. Crear el usuario
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
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
    console.log(`   Password: [OCULTA, leída desde variable de entorno]`);

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

createAdmin()
  .then(() => {
    if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
    process.exit(0);
  })
  .catch(() => process.exit(1));
