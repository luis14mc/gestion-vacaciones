import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const DATABASE_URL = process.env.DATABASE_URL;
const preserveEmail = (process.env.ADMIN_EMAIL || 'soporteit@cni.hn').toLowerCase();
const confirm = process.env.CONFIRM_CLEAN_TEST_USERS;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no esta configurada en .env/.env.local');
}

if (confirm !== 'YES') {
  throw new Error('Define CONFIRM_CLEAN_TEST_USERS=YES para ejecutar la limpieza');
}

if (!DATABASE_URL.includes('neon.tech')) {
  throw new Error('Limpieza bloqueada: DATABASE_URL no parece ser NEON');
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function tableExists(name: string) {
  const [row] = await sql`SELECT to_regclass(${`public.${name}`}) AS reg`;
  return row?.reg !== null;
}

async function countTable(name: string) {
  if (!(await tableExists(name))) return null;
  const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM ${quoteIdent(name)}`);
  return rows[0]?.count ?? 0;
}

async function deleteIfExists(tx: postgres.TransactionSql, existingTables: Set<string>, table: string) {
  if (existingTables.has(table)) {
    await tx.unsafe(`DELETE FROM ${quoteIdent(table)}`);
  }
}

const tables = [
  'usuarios',
  'sessions',
  'usuarios_roles',
  'usuarios_departamentos',
  'solicitudes',
  'balances',
  'historial_balances',
  'registros_auditoria',
  'auditoria_operaciones',
  'departamentos',
];

async function main() {
  const existingTables = new Set(
    (await Promise.all(tables.map(async (t) => ((await tableExists(t)) ? t : null))))
      .filter((t): t is string => t !== null)
  );
  const before = Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await countTable(t)])));
  let deletedUsers: Array<{ id: number; email: string }> = [];
  let preservedAdminEmail: string | null = null;

  await sql.begin(async (tx) => {
    const [admin] = await tx.unsafe<{ id: number; email: string }[]>(`
      SELECT id, email
      FROM usuarios
      WHERE lower(email) = $1
      LIMIT 1
    `, [preserveEmail]);
    preservedAdminEmail = admin?.email ?? null;

    await deleteIfExists(tx, existingTables, 'registros_auditoria');
    await deleteIfExists(tx, existingTables, 'auditoria_operaciones');
    await deleteIfExists(tx, existingTables, 'historial_balances');
    await deleteIfExists(tx, existingTables, 'balances');
    await deleteIfExists(tx, existingTables, 'solicitudes');

    if (existingTables.has('departamentos')) {
      await tx.unsafe(`
        UPDATE departamentos
        SET jefe_id = NULL
        WHERE jefe_id IN (
          SELECT id FROM usuarios WHERE lower(email) <> $1
        )
      `, [preserveEmail]);
    }

    await tx.unsafe(`
      UPDATE usuarios
      SET jefe_superior_id = NULL
      WHERE jefe_superior_id IN (
        SELECT id FROM usuarios WHERE lower(email) <> $1
      )
    `, [preserveEmail]);

    if (existingTables.has('sessions')) {
      await tx.unsafe(`
        DELETE FROM sessions
        WHERE usuario_id IN (
          SELECT id FROM usuarios WHERE lower(email) <> $1
        )
      `, [preserveEmail]);
    }

    if (existingTables.has('usuarios_departamentos')) {
      await tx.unsafe(`
        DELETE FROM usuarios_departamentos
        WHERE usuario_id IN (
          SELECT id FROM usuarios WHERE lower(email) <> $1
        )
      `, [preserveEmail]);
    }

    if (existingTables.has('usuarios_roles')) {
      await tx.unsafe(`
        DELETE FROM usuarios_roles
        WHERE usuario_id IN (
          SELECT id FROM usuarios WHERE lower(email) <> $1
        )
      `, [preserveEmail]);
    }

    deletedUsers = await tx.unsafe<{ id: number; email: string }[]>(`
      DELETE FROM usuarios
      WHERE lower(email) <> $1
      RETURNING id, email
    `, [preserveEmail]);
  });

  const after = Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await countTable(t)])));

  console.log(JSON.stringify({
    preservedAdminEmail,
    deletedUsers: deletedUsers.length,
    before,
    after,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
