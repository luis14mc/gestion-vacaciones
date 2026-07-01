/**
 * Limpieza de usuarios para pruebas de carga masiva
 * Ejecutar: npx tsx scripts/limpiar-usuarios.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Limpieza bloqueada en producción');
}

if (process.env.CONFIRM_CLEAN_TEST_USERS !== 'YES') {
  throw new Error('Define CONFIRM_CLEAN_TEST_USERS=YES para confirmar la limpieza de pruebas');
}

if (!DATABASE_URL.includes('neon.tech')) {
  throw new Error('Limpieza bloqueada: DATABASE_URL no corresponde a Neon de pruebas');
}

const dbHost = new URL(DATABASE_URL).hostname;
const isLocalDb = ['localhost', '127.0.0.1', '::1', 'postgres', 'cni-postgres'].includes(dbHost);
const useSsl = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === 'true'
  : !isLocalDb;
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

const client = postgres(DATABASE_URL, {
  max: 1,
  ssl: useSsl ? { rejectUnauthorized } : false,
});

async function limpiar() {
  console.log('========================================');
  console.log('LIMPIEZA DE USUARIOS (preserva admin)');
  console.log('========================================\n');

  try {
    // Contar antes
    const [antes] = await client`SELECT COUNT(*) as total FROM usuarios WHERE es_admin = false`;
    const totalAntes = Number(antes?.total ?? 0);
    console.log(`Usuarios no-admin a eliminar: ${totalAntes}`);

    if (totalAntes === 0) {
      console.log('\n✅ No hay usuarios no-admin que eliminar.');
      process.exit(0);
    }

    // 1. Solicitudes
    const solResult = await client`DELETE FROM solicitudes WHERE usuario_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Solicitudes eliminadas: ${solResult.count}`);

    // 2. Balances
    const balResult = await client`DELETE FROM balances WHERE usuario_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Balances eliminados: ${balResult.count}`);

    // 3. Sesiones
    const sesResult = await client`DELETE FROM sessions WHERE usuario_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Sesiones eliminadas: ${sesResult.count}`);

    // 4. Asignaciones departamento
    const udResult = await client`DELETE FROM usuarios_departamentos WHERE usuario_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Asignaciones depto eliminadas: ${udResult.count}`);

    // 5. Roles de usuario
    const urResult = await client`DELETE FROM usuarios_roles WHERE usuario_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Roles-usuario eliminados: ${urResult.count}`);

    // 6. Limpiar jefe_id de departamentos
    const deptResult = await client`UPDATE departamentos SET jefe_id = NULL, updated_at = NOW() WHERE jefe_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;
    console.log(`  ✓ Departamentos con jefe limpiado: ${deptResult.count}`);

    // 7. Limpiar jefe_superior_id que apunten a usuarios no-admin
    await client`UPDATE usuarios SET jefe_superior_id = NULL WHERE jefe_superior_id IN (SELECT id FROM usuarios WHERE es_admin = false)`;

    // 8. Eliminar usuarios
    const usrResult = await client`DELETE FROM usuarios WHERE es_admin = false`;
    console.log(`  ✓ Usuarios eliminados: ${usrResult.count}`);

    // Verificar
    const [despues] = await client`SELECT COUNT(*) as total FROM usuarios`;
    console.log(`\n✅ Limpieza completada. Usuarios restantes: ${despues?.total ?? 0} (admin)`);

  } catch (error) {
    console.error('ERROR:', error);
    throw error;
  } finally {
    await client.end();
  }
}

limpiar()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
