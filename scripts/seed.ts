/**
 * Script de SEED para poblar la base de datos con datos iniciales
 * Incluye: Roles, Permisos, Departamentos, Usuarios y asignaciones RBAC
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar .env
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

import { db } from '../src/core/infrastructure/database';
import { 
  departamentos, 
  usuarios, 
  roles, 
  permisos, 
  rolesPermisos, 
  usuariosRoles,
  tiposAusenciaConfig,
  balancesAusencias
} from '../src/core/infrastructure/database/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('\n🌱 INICIANDO SEED DE BASE DE DATOS\n');
  
  try {
    // 1️⃣ DEPARTAMENTOS
    console.log('📦 Insertando departamentos...');
    const [deptTecnologia, deptRRHH, deptAdministracion, deptOperaciones] = await db
      .insert(departamentos)
      .values([
        {
          nombre: 'Tecnología',
          codigo: 'TEC',
          descripcion: 'Departamento de Tecnología e Informática',
          activo: true,
        },
        {
          nombre: 'Recursos Humanos',
          codigo: 'RRHH',
          descripcion: 'Departamento de Recursos Humanos',
          activo: true,
        },
        {
          nombre: 'Administración',
          codigo: 'ADM',
          descripcion: 'Departamento Administrativo',
          activo: true,
        },
        {
          nombre: 'Operaciones',
          codigo: 'OPS',
          descripcion: 'Departamento de Operaciones',
          activo: true,
        },
      ])
      .returning();
    
    console.log(`   ✓ ${4} departamentos insertados`);

    // 2️⃣ ROLES
    console.log('\n🎭 Insertando roles...');
    const [rolAdmin, rolRRHH, rolJefe, rolEmpleado] = await db
      .insert(roles)
      .values([
        {
          codigo: 'ADMIN',
          nombre: 'Administrador',
          descripcion: 'Acceso completo al sistema',
          nivel: 3,
          esRolSistema: true,
          activo: true,
        },
        {
          codigo: 'RRHH',
          nombre: 'Recursos Humanos',
          descripcion: 'Gestión de personal y vacaciones',
          nivel: 2,
          esRolSistema: true,
          activo: true,
        },
        {
          codigo: 'JEFE',
          nombre: 'Jefe de Departamento',
          descripcion: 'Gestión de su departamento',
          nivel: 1,
          esRolSistema: true,
          activo: true,
        },
        {
          codigo: 'EMPLEADO',
          nombre: 'Empleado',
          descripcion: 'Acceso básico',
          nivel: 0,
          esRolSistema: true,
          activo: true,
        },
      ])
      .returning();
    
    console.log(`   ✓ ${4} roles insertados`);

    // 3️⃣ PERMISOS
    console.log('\n🔑 Insertando permisos (24)...');
    const permisosData = [
      // Vacaciones - Solicitudes (5)
      { codigo: 'vacaciones.solicitudes.crear', modulo: 'vacaciones', accion: 'solicitudes.crear', nombre: 'Crear solicitudes de vacaciones' },
      { codigo: 'vacaciones.solicitudes.ver_propias', modulo: 'vacaciones', accion: 'solicitudes.ver_propias', nombre: 'Ver solicitudes propias' },
      { codigo: 'vacaciones.solicitudes.ver_todas', modulo: 'vacaciones', accion: 'solicitudes.ver_todas', nombre: 'Ver todas las solicitudes' },
      { codigo: 'vacaciones.solicitudes.aprobar_jefe', modulo: 'vacaciones', accion: 'solicitudes.aprobar_jefe', nombre: 'Aprobar como jefe' },
      { codigo: 'vacaciones.solicitudes.aprobar_rrhh', modulo: 'vacaciones', accion: 'solicitudes.aprobar_rrhh', nombre: 'Aprobar como RRHH' },
      { codigo: 'vacaciones.solicitudes.rechazar', modulo: 'vacaciones', accion: 'solicitudes.rechazar', nombre: 'Rechazar solicitudes' },
      
      // Usuarios (5)
      { codigo: 'usuarios.ver', modulo: 'usuarios', accion: 'ver', nombre: 'Ver usuarios' },
      { codigo: 'usuarios.crear', modulo: 'usuarios', accion: 'crear', nombre: 'Crear usuarios' },
      { codigo: 'usuarios.editar', modulo: 'usuarios', accion: 'editar', nombre: 'Editar usuarios' },
      { codigo: 'usuarios.eliminar', modulo: 'usuarios', accion: 'eliminar', nombre: 'Eliminar usuarios' },
      { codigo: 'usuarios.asignar_roles', modulo: 'usuarios', accion: 'asignar_roles', nombre: 'Asignar roles' },
      
      // Balances (3)
      { codigo: 'balances.ver_propios', modulo: 'balances', accion: 'ver_propios', nombre: 'Ver balance propio' },
      { codigo: 'balances.ver_todos', modulo: 'balances', accion: 'ver_todos', nombre: 'Ver todos los balances' },
      { codigo: 'balances.editar', modulo: 'balances', accion: 'editar', nombre: 'Editar balances' },
      
      // Reportes (3)
      { codigo: 'reportes.general', modulo: 'reportes', accion: 'general', nombre: 'Reportes generales' },
      { codigo: 'reportes.departamento', modulo: 'reportes', accion: 'departamento', nombre: 'Reportes por departamento' },
      { codigo: 'reportes.exportar', modulo: 'reportes', accion: 'exportar', nombre: 'Exportar reportes' },
      
      // Departamentos (3)
      { codigo: 'departamentos.ver', modulo: 'departamentos', accion: 'ver', nombre: 'Ver departamentos' },
      { codigo: 'departamentos.crear', modulo: 'departamentos', accion: 'crear', nombre: 'Crear departamentos' },
      { codigo: 'departamentos.editar', modulo: 'departamentos', accion: 'editar', nombre: 'Editar departamentos' },
      
      // Dashboard (2)
      { codigo: 'dashboard.ver', modulo: 'dashboard', accion: 'ver', nombre: 'Ver dashboard' },
      { codigo: 'dashboard.metricas', modulo: 'dashboard', accion: 'metricas', nombre: 'Ver métricas avanzadas' },
      
      // Sistema (3)
      { codigo: 'config.ver', modulo: 'sistema', accion: 'config.ver', nombre: 'Ver configuración' },
      { codigo: 'config.editar', modulo: 'sistema', accion: 'config.editar', nombre: 'Editar configuración' },
      { codigo: 'auditoria.ver', modulo: 'sistema', accion: 'auditoria.ver', nombre: 'Ver auditoría' },
    ];

    const permisosInsertados = await db
      .insert(permisos)
      .values(permisosData.map(p => ({ ...p, activo: true })))
      .returning();
    
    console.log(`   ✓ ${permisosInsertados.length} permisos insertados`);

    // 4️⃣ ASIGNAR PERMISOS A ROLES
    console.log('\n🔗 Asignando permisos a roles...');
    
    // ADMIN: Todos los permisos
    const permisosAdmin = permisosInsertados.map(p => ({
      rolId: rolAdmin.id,
      permisoId: p.id,
    }));
    
    // RRHH: Casi todos excepto config y algunos de usuarios
    const permisosRRHH = permisosInsertados
      .filter(p => !p.codigo.startsWith('config.') && p.codigo !== 'usuarios.eliminar')
      .map(p => ({
        rolId: rolRRHH.id,
        permisoId: p.id,
      }));
    
    // JEFE: Ver y aprobar en su departamento
    const permisosJefe = permisosInsertados
      .filter(p => [
        'vacaciones.solicitudes.crear',
        'vacaciones.solicitudes.ver_propias',
        'vacaciones.solicitudes.ver_todas',
        'vacaciones.solicitudes.aprobar_jefe',
        'usuarios.ver',
        'balances.ver_propios',
        'balances.ver_todos',
        'reportes.departamento',
        'reportes.exportar',
        'dashboard.ver',
      ].includes(p.codigo))
      .map(p => ({
        rolId: rolJefe.id,
        permisoId: p.id,
      }));
    
    // EMPLEADO: Solo lo básico
    const permisosEmpleado = permisosInsertados
      .filter(p => [
        'vacaciones.solicitudes.crear',
        'vacaciones.solicitudes.ver_propias',
        'balances.ver_propios',
        'dashboard.ver',
      ].includes(p.codigo))
      .map(p => ({
        rolId: rolEmpleado.id,
        permisoId: p.id,
      }));

    await db.insert(rolesPermisos).values([
      ...permisosAdmin,
      ...permisosRRHH,
      ...permisosJefe,
      ...permisosEmpleado,
    ]);
    
    console.log(`   ✓ ${permisosAdmin.length} permisos → ADMIN`);
    console.log(`   ✓ ${permisosRRHH.length} permisos → RRHH`);
    console.log(`   ✓ ${permisosJefe.length} permisos → JEFE`);
    console.log(`   ✓ ${permisosEmpleado.length} permisos → EMPLEADO`);

    // 5️⃣ USUARIOS
    console.log('\n👤 Insertando usuarios...');
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    
    const [admin, rrhh, jefe1, empleado1] = await db
      .insert(usuarios)
      .values([
        {
          email: 'admin@cni.hn',
          password: passwordHash,
          nombre: 'Administrador',
          apellido: 'Sistema',
          departamentoId: deptAdministracion.id,
          cargo: 'Administrador del Sistema',
          activo: true,
        },
        {
          email: 'rrhh@cni.hn',
          password: passwordHash,
          nombre: 'María',
          apellido: 'González',
          departamentoId: deptRRHH.id,
          cargo: 'Jefa de RRHH',
          activo: true,
        },
        {
          email: 'jefe.tecnologia@cni.hn',
          password: passwordHash,
          nombre: 'Carlos',
          apellido: 'Martínez',
          departamentoId: deptTecnologia.id,
          cargo: 'Jefe de Tecnología',
          activo: true,
        },
        {
          email: 'empleado@cni.hn',
          password: passwordHash,
          nombre: 'Ana',
          apellido: 'López',
          departamentoId: deptTecnologia.id,
          cargo: 'Desarrolladora',
          activo: true,
        },
      ])
      .returning();
    
    console.log(`   ✓ ${4} usuarios insertados`);
    console.log(`   📧 Todos con password: Admin123!`);

    // 6️⃣ ASIGNAR ROLES A USUARIOS
    console.log('\n🎭 Asignando roles a usuarios...');
    await db.insert(usuariosRoles).values([
      {
        usuarioId: admin.id,
        rolId: rolAdmin.id,
        activo: true,
      },
      {
        usuarioId: rrhh.id,
        rolId: rolRRHH.id,
        activo: true,
      },
      {
        usuarioId: jefe1.id,
        rolId: rolJefe.id,
        departamentoId: deptTecnologia.id,
        activo: true,
      },
      {
        usuarioId: empleado1.id,
        rolId: rolEmpleado.id,
        activo: true,
      },
    ]);
    
    console.log(`   ✓ admin@cni.hn → ADMIN`);
    console.log(`   ✓ rrhh@cni.hn → RRHH`);
    console.log(`   ✓ jefe.tecnologia@cni.hn → JEFE (Tecnología)`);
    console.log(`   ✓ empleado@cni.hn → EMPLEADO`);

    console.log('\n✅ SEED COMPLETADO EXITOSAMENTE\n');
    console.log('📊 Resumen:');
    console.log(`   • ${4} Departamentos`);
    console.log(`   • ${4} Roles`);
    console.log(`   • ${25} Permisos`);
    console.log(`   • ${4} Usuarios con roles asignados\n`);
    console.log('🔐 Credenciales de prueba:');
    console.log('   📧 Email: admin@cni.hn | rrhh@cni.hn | jefe.tecnologia@cni.hn | empleado@cni.hn');
    console.log('   🔑 Password: Admin123!\n');

  } catch (error) {
    console.error('\n❌ Error durante el seed:', error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log('🎉 Proceso completado\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
