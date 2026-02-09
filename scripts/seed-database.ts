/**
 * =====================================================
 * SEED DATABASE - Arquitectura Limpia CNI
 * =====================================================
 * @description Población inicial de la base de datos
 * @version 5.0 - Febrero 2026
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { 
  roles, 
  permisos, 
  rolesPermisos, 
  usuarios, 
  usuariosRoles,
  departamentos,
  usuariosDepartamentos,
  anosLaborales,
  balances
} from '../src/lib/db/schema';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(' ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}

const client = postgres(DATABASE_URL + '?sslmode=require', { 
  max: 1,
  ssl: { rejectUnauthorized: false }
});
const db = drizzle(client);

// ===== DATOS: ROLES =====
const ROLES_DATA = [
  { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Acceso total', nivel: 10, esRolSistema: true },
  { codigo: 'RRHH', nombre: 'Recursos Humanos', descripcion: 'Gestión de personal', nivel: 8, esRolSistema: true },
  { codigo: 'JEFE', nombre: 'Jefe de Departamento', descripcion: 'Aprobación nivel 1', nivel: 5, esRolSistema: true },
  { codigo: 'EMPLEADO', nombre: 'Empleado', descripcion: 'Usuario estándar', nivel: 1, esRolSistema: true },
];

// ===== DATOS: PERMISOS =====
const PERMISOS_DATA = [
  // Sistema
  { codigo: 'sistema.acceso', modulo: 'sistema', recurso: 'aplicacion', accion: 'acceder', descripcion: 'Acceso al sistema' },
  { codigo: 'sistema.dashboard', modulo: 'sistema', recurso: 'dashboard', accion: 'ver', descripcion: 'Ver dashboard' },
  
  // Usuarios
  { codigo: 'usuarios.ver', modulo: 'usuarios', recurso: 'usuario', accion: 'ver', descripcion: 'Ver usuarios' },
  { codigo: 'usuarios.crear', modulo: 'usuarios', recurso: 'usuario', accion: 'crear', descripcion: 'Crear usuarios' },
  { codigo: 'usuarios.editar', modulo: 'usuarios', recurso: 'usuario', accion: 'editar', descripcion: 'Editar usuarios' },
  { codigo: 'usuarios.eliminar', modulo: 'usuarios', recurso: 'usuario', accion: 'eliminar', descripcion: 'Eliminar usuarios' },
  
  // Departamentos
  { codigo: 'departamentos.ver', modulo: 'departamentos', recurso: 'departamento', accion: 'ver', descripcion: 'Ver departamentos' },
  { codigo: 'departamentos.crear', modulo: 'departamentos', recurso: 'departamento', accion: 'crear', descripcion: 'Crear departamentos' },
  
  // Solicitudes
  { codigo: 'solicitudes.ver_propias', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_propias', descripcion: 'Ver solicitudes propias' },
  { codigo: 'solicitudes.crear', modulo: 'solicitudes', recurso: 'solicitud', accion: 'crear', descripcion: 'Crear solicitud' },
  { codigo: 'solicitudes.ver_departamento', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_departamento', descripcion: 'Ver solicitudes del departamento' },
  { codigo: 'solicitudes.aprobar_jefe', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_jefe', descripcion: 'Aprobar como jefe' },
  { codigo: 'solicitudes.aprobar_rrhh', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_rrhh', descripcion: 'Aprobar como RRHH' },
  { codigo: 'solicitudes.aprobar_ejecutiva', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_ejecutiva', descripcion: 'Aprobar como ejecutivo' },
  { codigo: 'solicitudes.ver_todas', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_todas', descripcion: 'Ver todas las solicitudes' },
  
  // Balances
  { codigo: 'balances.ver_propio', modulo: 'balances', recurso: 'balance', accion: 'ver_propio', descripcion: 'Ver balance propio' },
  { codigo: 'balances.ver_todos', modulo: 'balances', recurso: 'balance', accion: 'ver_todos', descripcion: 'Ver todos los balances' },
  { codigo: 'balances.ajustar', modulo: 'balances', recurso: 'balance', accion: 'ajustar', descripcion: 'Ajustar balances' },
];

// ===== DATOS: DEPARTAMENTOS =====
const DEPARTAMENTOS_DATA = [
  { codigo: 'TI', nombre: 'Tecnología e Innovación', descripcion: 'Departamento de TI', nivel: 1 },
  { codigo: 'RRHH', nombre: 'Recursos Humanos', descripcion: 'Gestión de personal', nivel: 1 },
  { codigo: 'OPS', nombre: 'Operaciones', descripcion: 'Operaciones generales', nivel: 1 },
  { codigo: 'LOG', nombre: 'Logística', descripcion: 'Logística y distribución', nivel: 1 },
  { codigo: 'ADMIN', nombre: 'Administración', descripcion: 'Administración general', nivel: 1 },
];

async function seed() {
  console.log('🌱 ========================================');
  console.log('🌱 SEED CNI - Arquitectura Limpia');
  console.log('🌱 ========================================\n');

  try {
    // 1. ROLES
    console.log('📋 [1/7] Roles...');
    const insertedRoles = await db.insert(roles).values(ROLES_DATA).returning();
    console.log(`   ✅ ${insertedRoles.length} roles\n`);

    const adminRole = insertedRoles.find(r => r.codigo === 'ADMIN')!;
    const rrhhRole = insertedRoles.find(r => r.codigo === 'RRHH')!;
    const jefeRole = insertedRoles.find(r => r.codigo === 'JEFE')!;
    const empleadoRole = insertedRoles.find(r => r.codigo === 'EMPLEADO')!;

    // 2. PERMISOS
    console.log('🔐 [2/7] Permisos...');
    const insertedPermisos = await db.insert(permisos).values(PERMISOS_DATA).returning();
    console.log(`   ✅ ${insertedPermisos.length} permisos\n`);

    // 3. ROLES ← → PERMISOS
    console.log('🔗 [3/7] Asignando permisos...');
    
    // ADMIN: todos
    const adminPermisos = insertedPermisos.map(p => ({ rolId: adminRole.id, permisoId: p.id }));
    
    // RRHH: gestión completa menos usuarios
    const rrhhPermisos = insertedPermisos
      .filter(p => !p.codigo.startsWith('usuarios.'))
      .map(p => ({ rolId: rrhhRole.id, permisoId: p.id }));
    
    // JEFE: su departamento
    const jefePermisos = insertedPermisos
      .filter(p => [
        'sistema.acceso', 'sistema.dashboard',
        'solicitudes.ver_propias', 'solicitudes.crear', 'solicitudes.ver_departamento', 'solicitudes.aprobar_jefe',
        'balances.ver_propio',
      ].includes(p.codigo))
      .map(p => ({ rolId: jefeRole.id, permisoId: p.id }));
    
    // EMPLEADO: básico
    const empleadoPermisos = insertedPermisos
      .filter(p => [
        'sistema.acceso', 'sistema.dashboard',
        'solicitudes.ver_propias', 'solicitudes.crear',
        'balances.ver_propio',
      ].includes(p.codigo))
      .map(p => ({ rolId: empleadoRole.id, permisoId: p.id }));

    await db.insert(rolesPermisos).values([
      ...adminPermisos,
      ...rrhhPermisos,
      ...jefePermisos,
      ...empleadoPermisos,
    ]);

    console.log(`   ✅ ADMIN: ${adminPermisos.length}, RRHH: ${rrhhPermisos.length}, JEFE: ${jefePermisos.length}, EMPLEADO: ${empleadoPermisos.length}\n`);

    // 4. DEPARTAMENTOS
    console.log('🏢 [4/7] Departamentos...');
    const insertedDeptosRaw = await db.insert(departamentos).values(DEPARTAMENTOS_DATA).returning();
    console.log(`   ✅ ${insertedDeptosRaw.length} departamentos\n`);

    const tiDept = insertedDeptosRaw.find(d => d.codigo === 'TI')!;
    const rrhhDept = insertedDeptosRaw.find(d => d.codigo === 'RRHH')!;
    const opsDept = insertedDeptosRaw.find(d => d.codigo === 'OPS')!;

    // 5. USUARIOS
    console.log('👤 [5/7] Usuarios...');
    const passwordHash = await bcrypt.hash('Test123!', 10);

    // Admin (sin departamento)
    const [adminUser] = await db.insert(usuarios).values({
      email: 'admin@cni.cl',
      nombre: 'Admin',
      apellido: 'Sistema',
      passwordHash,
      cargo: 'Administrador',
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      activo: true,
    }).returning();

    await db.insert(usuariosRoles).values({
      usuarioId: adminUser.id,
      rolId: adminRole.id,
      activo: true,
    });

    // RRHH
   const [rrhhUser] = await db.insert(usuarios).values({
      email: 'rrhh@cni.cl',
      nombre: 'María',
      apellido: 'RRHH',
      passwordHash,
      departamentoId: rrhhDept.id,
      cargo: 'Gerente RRHH',
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      activo: true,
    }).returning();

    await db.insert(usuariosRoles).values({ usuarioId: rrhhUser.id, rolId: rrhhRole.id, activo: true });
    await db.insert(usuariosDepartamentos).values({
      usuarioId: rrhhUser.id,
      departamentoId: rrhhDept.id,
      cargo: 'Gerente',
    });

    // Jefe TI
    const [jefeTi] = await db.insert(usuarios).values({
      email: 'jefe.ti@cni.cl',
      nombre: 'Roberto',
      apellido: 'Jefe TI',
      passwordHash,
      departamentoId: tiDept.id,
      cargo: 'Jefe de TI',
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      activo: true,
    }).returning();

    await db.insert(usuariosRoles).values({ usuarioId: jefeTi.id, rolId: jefeRole.id, activo: true });
    await db.insert(usuariosDepartamentos).values({
      usuarioId: jefeTi.id,
      departamentoId: tiDept.id,
      cargo: 'Jefe de Departamento',
    });

    // Actualizar departamento TI con jefe
    await db.update(departamentos)
      .set({ jefeId: jefeTi.id })
      .where(eq(departamentos.id, tiDept.id));

    // Empleado 1 (TI)
    const [emp1] = await db.insert(usuarios).values({
      email: 'ana.dev@cni.cl',
      nombre: 'Ana',
      apellido: 'Desarrolladora',
      passwordHash,
      departamentoId: tiDept.id,
      cargo: 'Developer Senior',
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      activo: true,
    }).returning();

    await db.insert(usuariosRoles).values({ usuarioId: emp1.id, rolId: empleadoRole.id, activo: true });
    await db.insert(usuariosDepartamentos).values({
      usuarioId: emp1.id,
      departamentoId: tiDept.id,
      cargo: 'Developer',
    });

    // Empleado 2 (OPS)
    const [emp2] = await db.insert(usuarios).values({
      email: 'luis.ops@cni.cl',
      nombre: 'Luis',
      apellido: 'Operador',
      passwordHash,
      departamentoId: opsDept.id,
      cargo: 'Analista de Operaciones',
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      activo: true,
    }).returning();

    await db.insert(usuariosRoles).values({ usuarioId: emp2.id, rolId: empleadoRole.id, activo: true });
    await db.insert(usuariosDepartamentos).values({
      usuarioId: emp2.id,
      departamentoId: opsDept.id,
      cargo: 'Analista',
    });

    console.log('   ✅ 5 usuarios creados\n');

    // 6. AÑO LABORAL 2026
    console.log('📅 [6/7] Año laboral 2026...');
    const [ano2026] = await db.insert(anosLaborales).values({
      ano: 2026,
      nombre: 'Período 2026',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      activo: true,
    }).returning();
    console.log(`   ✅ Año 2026 creado\n`);

    // 7. BALANCES DE VACACIONES
    console.log('💰 [7/7] Balances de vacaciones...');
    const usuarios_para_balance = [adminUser, rrhhUser, jefeTi, emp1, emp2];
    
    const balancesData = usuarios_para_balance.map(u => ({
      usuarioId: u.id,
      anoLaboralId: ano2026.id,
      tipoAusencia: 'vacaciones' as const,
      cantidadInicial: '15.00',
      cantidadAcumulada: '0.00',
      cantidadUsada: '0.00',
      cantidadPendiente: '0.00',
      cantidadDisponible: '15.00', // Trigger lo recalculará
    }));

    await db.insert(balances).values(balancesData);
    console.log(`   ✅ ${balancesData.length} balances creados (15 días c/u)\n`);

    // RESUMEN
    console.log('🎉 ========================================');
    console.log('🎉 SEED COMPLETADO');
    console.log('🎉 ========================================\n');
    console.log('📊 RESUMEN:');
    console.log(`   • 4 Roles`);
    console.log(`   • ${insertedPermisos.length} Permisos`);
    console.log(`   • ${insertedDeptosRaw.length} Departamentos`);
    console.log(`   • 5 Usuarios`);
    console.log(`   • 1 Año Laboral (2026)`);
    console.log(`   • ${balancesData.length} Balances\n`);

    console.log('🔐 CREDENCIALES:');
    console.log('   ┌───────────────────────────────────────┐');
    console.log('   │ EMAIL              PASSWORD           │');
    console.log('   ├───────────────────────────────────────┤');
    console.log('   │ admin@cni.cl       Test123!           │');
    console.log('   │ rrhh@cni.cl        Test123!           │');
    console.log('   │ jefe.ti@cni.cl     Test123!           │');
    console.log('   │ ana.dev@cni.cl     Test123!           │');
    console.log('   │ luis.ops@cni.cl    Test123!           │');
    console.log('   └───────────────────────────────────────┘\n');

  } catch (error) {
    console.error('❌ ERROR:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seed()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
