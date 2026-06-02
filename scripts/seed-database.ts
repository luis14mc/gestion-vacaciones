/**
 * =====================================================
 * SEED DATABASE - Datos base CNI
 * =====================================================
 * Idempotente y seguro para produccion:
 * - No borra datos.
 * - No crea usuarios con contrasenas hardcodeadas por defecto.
 * - Inserta/actualiza roles, permisos, departamentos, configuracion y ano laboral.
 * - Usuarios demo solo con SEED_DEMO_USERS=true y DEMO_USERS_PASSWORD definido.
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
  balances,
  configuracion,
} from '../src/lib/db/schema';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no esta configurada');
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL === 'true';

const client = postgres(DATABASE_URL, {
  max: 1,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});
const db = drizzle(client);

const ROLES_DATA = [
  { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Acceso total', nivel: 10, esRolSistema: true },
  { codigo: 'RRHH', nombre: 'Recursos Humanos', descripcion: 'Gestion de personal', nivel: 8, esRolSistema: true },
  { codigo: 'JEFE', nombre: 'Jefe de Departamento', descripcion: 'Aprobacion nivel 1', nivel: 5, esRolSistema: true },
  { codigo: 'EMPLEADO', nombre: 'Empleado', descripcion: 'Usuario estandar', nivel: 1, esRolSistema: true },
];

const PERMISOS_DATA = [
  { codigo: 'sistema.acceso', modulo: 'sistema', recurso: 'aplicacion', accion: 'acceder', descripcion: 'Acceso al sistema' },
  { codigo: 'sistema.dashboard', modulo: 'sistema', recurso: 'dashboard', accion: 'ver', descripcion: 'Ver dashboard' },
  { codigo: 'usuarios.ver', modulo: 'usuarios', recurso: 'usuario', accion: 'ver', descripcion: 'Ver usuarios' },
  { codigo: 'usuarios.crear', modulo: 'usuarios', recurso: 'usuario', accion: 'crear', descripcion: 'Crear usuarios' },
  { codigo: 'usuarios.editar', modulo: 'usuarios', recurso: 'usuario', accion: 'editar', descripcion: 'Editar usuarios' },
  { codigo: 'usuarios.eliminar', modulo: 'usuarios', recurso: 'usuario', accion: 'eliminar', descripcion: 'Eliminar usuarios' },
  { codigo: 'departamentos.ver', modulo: 'departamentos', recurso: 'departamento', accion: 'ver', descripcion: 'Ver departamentos' },
  { codigo: 'departamentos.crear', modulo: 'departamentos', recurso: 'departamento', accion: 'crear', descripcion: 'Crear departamentos' },
  { codigo: 'solicitudes.ver_propias', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_propias', descripcion: 'Ver solicitudes propias' },
  { codigo: 'solicitudes.crear', modulo: 'solicitudes', recurso: 'solicitud', accion: 'crear', descripcion: 'Crear solicitud' },
  { codigo: 'solicitudes.ver_departamento', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_departamento', descripcion: 'Ver solicitudes del departamento' },
  { codigo: 'solicitudes.aprobar_jefe', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_jefe', descripcion: 'Aprobar como jefe' },
  { codigo: 'solicitudes.aprobar_rrhh', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_rrhh', descripcion: 'Aprobar como RRHH' },
  { codigo: 'solicitudes.aprobar_ejecutiva', modulo: 'solicitudes', recurso: 'solicitud', accion: 'aprobar_ejecutiva', descripcion: 'Aprobar como ejecutivo' },
  { codigo: 'solicitudes.ver_todas', modulo: 'solicitudes', recurso: 'solicitud', accion: 'ver_todas', descripcion: 'Ver todas las solicitudes' },
  { codigo: 'balances.ver_propio', modulo: 'balances', recurso: 'balance', accion: 'ver_propio', descripcion: 'Ver balance propio' },
  { codigo: 'balances.ver_todos', modulo: 'balances', recurso: 'balance', accion: 'ver_todos', descripcion: 'Ver todos los balances' },
  { codigo: 'balances.ajustar', modulo: 'balances', recurso: 'balance', accion: 'ajustar', descripcion: 'Ajustar balances' },
  { codigo: 'reportes.departamento', modulo: 'reportes', recurso: 'reporte', accion: 'ver_departamento', descripcion: 'Ver reportes por departamento' },
  { codigo: 'reportes.exportar', modulo: 'reportes', recurso: 'reporte', accion: 'exportar', descripcion: 'Exportar reportes' },
];

const DEPARTAMENTOS_DATA = [
  { codigo: 'TI', nombre: 'Tecnologia e Innovacion', descripcion: 'Departamento de TI', nivel: 1 },
  { codigo: 'RRHH', nombre: 'Recursos Humanos', descripcion: 'Gestion de personal', nivel: 1 },
  { codigo: 'OPS', nombre: 'Operaciones', descripcion: 'Operaciones generales', nivel: 1 },
  { codigo: 'LOG', nombre: 'Logistica', descripcion: 'Logistica y distribucion', nivel: 1 },
  { codigo: 'ADMIN', nombre: 'Administracion', descripcion: 'Administracion general', nivel: 1 },
];

const CONFIGURACION_DATA = [
  { clave: 'app.nombre', valor: 'Sistema de Gestion de Vacaciones', descripcion: 'Nombre de la aplicacion que se muestra en el encabezado', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.version', valor: '1.0.0', descripcion: 'Version actual del sistema', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.empresa', valor: 'Consejo Nacional de Inversiones', descripcion: 'Razon social de la empresa', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.siglas', valor: 'CNI', descripcion: 'Siglas de la empresa para reportes y documentos', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.pais', valor: 'Honduras', descripcion: 'Pais de operacion del sistema', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.timezone', valor: 'America/Tegucigalpa', descripcion: 'Zona horaria para calculos de fechas y reportes', categoria: 'general', tipoDato: 'string', esPublico: false },
  { clave: 'app.idioma', valor: 'es', descripcion: 'Idioma principal del sistema', categoria: 'general', tipoDato: 'string', esPublico: true },
  { clave: 'app.mantenimiento', valor: 'false', descripcion: 'Activar modo mantenimiento', categoria: 'general', tipoDato: 'boolean', esPublico: false },
  { clave: 'vacaciones.dias_anuales_default', valor: '15', descripcion: 'Dias de vacaciones anuales asignados por defecto', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.dias_minimos_solicitud', valor: '1', descripcion: 'Cantidad minima de dias por solicitud', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.dias_maximos_consecutivos', valor: '15', descripcion: 'Maximo de dias consecutivos permitidos', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.dias_anticipacion', valor: '5', descripcion: 'Dias de anticipacion minima', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.umbral_aprobacion_ejecutiva', valor: '10', descripcion: 'Umbral para aprobacion ejecutiva', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.permitir_medio_dia', valor: 'true', descripcion: 'Permitir medio dia', categoria: 'vacaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'vacaciones.acumulacion_habilitada', valor: 'false', descripcion: 'Permitir acumulacion', categoria: 'vacaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'vacaciones.max_acumulacion', valor: '5', descripcion: 'Maximo de dias acumulables', categoria: 'vacaciones', tipoDato: 'number', esPublico: false },
  { clave: 'vacaciones.incluir_fines_semana', valor: 'false', descripcion: 'Contar fines de semana', categoria: 'vacaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'vacaciones.incluir_feriados', valor: 'false', descripcion: 'Contar feriados', categoria: 'vacaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.email_habilitado', valor: 'false', descripcion: 'Habilitar notificaciones por correo', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.email_remitente', valor: 'noreply@cni.hn', descripcion: 'Email remitente', categoria: 'notificaciones', tipoDato: 'string', esPublico: false },
  { clave: 'notificaciones.smtp_host', valor: 'smtp.office365.com', descripcion: 'Servidor SMTP para el envio de notificaciones', categoria: 'notificaciones', tipoDato: 'string', esPublico: false },
  { clave: 'notificaciones.smtp_port', valor: '587', descripcion: 'Puerto del servidor SMTP', categoria: 'notificaciones', tipoDato: 'number', esPublico: false },
  { clave: 'notificaciones.smtp_user', valor: '', descripcion: 'Usuario o cuenta SMTP autenticada', categoria: 'notificaciones', tipoDato: 'string', esPublico: false },
  { clave: 'notificaciones.smtp_password', valor: '', descripcion: 'Contrasena de la cuenta SMTP', categoria: 'notificaciones', tipoDato: 'password', esPublico: false },
  { clave: 'notificaciones.smtp_secure', valor: 'false', descripcion: 'Usar SSL/TLS directo. Normalmente false para STARTTLS en puerto 587', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.smtp_require_tls', valor: 'true', descripcion: 'Exigir STARTTLS cuando el servidor lo soporte', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.smtp_reject_unauthorized', valor: 'true', descripcion: 'Validar el certificado TLS del servidor SMTP', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.notificar_jefe_nueva_solicitud', valor: 'true', descripcion: 'Notificar al jefe por nueva solicitud', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.notificar_empleado_aprobacion', valor: 'true', descripcion: 'Notificar aprobacion al empleado', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.notificar_empleado_rechazo', valor: 'true', descripcion: 'Notificar rechazo al empleado', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.notificar_rrhh_aprobacion_jefe', valor: 'true', descripcion: 'Notificar a RRHH tras aprobacion de jefe', categoria: 'notificaciones', tipoDato: 'boolean', esPublico: false },
  { clave: 'notificaciones.recordatorio_dias_antes', valor: '2', descripcion: 'Dias antes para recordatorio', categoria: 'notificaciones', tipoDato: 'number', esPublico: false },
  { clave: 'departamentos.max_ausencias_simultaneas', valor: '3', descripcion: 'Maximo de ausencias simultaneas', categoria: 'departamentos', tipoDato: 'number', esPublico: false },
  { clave: 'departamentos.porcentaje_max_ausentes', valor: '30', descripcion: 'Porcentaje maximo ausente', categoria: 'departamentos', tipoDato: 'number', esPublico: false },
  { clave: 'departamentos.validar_conflictos', valor: 'true', descripcion: 'Validar conflictos de fechas', categoria: 'departamentos', tipoDato: 'boolean', esPublico: false },
  { clave: 'departamentos.jefe_puede_auto_aprobar', valor: 'false', descripcion: 'Permitir autoaprobacion de jefe', categoria: 'departamentos', tipoDato: 'boolean', esPublico: false },
  { clave: 'departamentos.mostrar_calendario_equipo', valor: 'true', descripcion: 'Mostrar calendario de equipo', categoria: 'departamentos', tipoDato: 'boolean', esPublico: false },
  { clave: 'seguridad.sesion_duracion_horas', valor: '168', descripcion: 'Duracion maxima de sesion en horas', categoria: 'seguridad', tipoDato: 'number', esPublico: false },
  { clave: 'seguridad.password_min_length', valor: '8', descripcion: 'Longitud minima de contrasena', categoria: 'seguridad', tipoDato: 'number', esPublico: false },
  { clave: 'seguridad.password_requiere_mayuscula', valor: 'true', descripcion: 'Requerir mayuscula', categoria: 'seguridad', tipoDato: 'boolean', esPublico: false },
  { clave: 'seguridad.password_requiere_numero', valor: 'true', descripcion: 'Requerir numero', categoria: 'seguridad', tipoDato: 'boolean', esPublico: false },
  { clave: 'seguridad.password_requiere_especial', valor: 'true', descripcion: 'Requerir caracter especial', categoria: 'seguridad', tipoDato: 'boolean', esPublico: false },
  { clave: 'seguridad.intentos_login_max', valor: '5', descripcion: 'Intentos fallidos maximos', categoria: 'seguridad', tipoDato: 'number', esPublico: false },
  { clave: 'seguridad.bloqueo_duracion_minutos', valor: '15', descripcion: 'Minutos de bloqueo tras intentos maximos', categoria: 'seguridad', tipoDato: 'number', esPublico: false },
  { clave: 'seguridad.forzar_cambio_password_dias', valor: '0', descripcion: 'Forzar cambio de contrasena cada N dias', categoria: 'seguridad', tipoDato: 'number', esPublico: false },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISOS_DATA.map((p) => p.codigo),
  RRHH: PERMISOS_DATA.filter((p) => !['usuarios.crear', 'usuarios.eliminar'].includes(p.codigo)).map((p) => p.codigo),
  JEFE: [
    'sistema.acceso',
    'sistema.dashboard',
    'solicitudes.ver_propias',
    'solicitudes.crear',
    'solicitudes.ver_departamento',
    'solicitudes.aprobar_jefe',
    'balances.ver_propio',
    'departamentos.ver',
    'reportes.departamento',
  ],
  EMPLEADO: [
    'sistema.acceso',
    'sistema.dashboard',
    'solicitudes.ver_propias',
    'solicitudes.crear',
    'balances.ver_propio',
  ],
};

async function upsertCatalogs() {
  const now = new Date().toISOString();

  for (const role of ROLES_DATA) {
    await db.insert(roles).values(role).onConflictDoUpdate({
      target: roles.codigo,
      set: {
        nombre: role.nombre,
        descripcion: role.descripcion,
        nivel: role.nivel,
        activo: true,
        esRolSistema: role.esRolSistema,
        updatedAt: now,
      },
    });
  }

  for (const permiso of PERMISOS_DATA) {
    await db.insert(permisos).values(permiso).onConflictDoUpdate({
      target: permisos.codigo,
      set: {
        modulo: permiso.modulo,
        recurso: permiso.recurso,
        accion: permiso.accion,
        descripcion: permiso.descripcion,
        activo: true,
      },
    });
  }

  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permisos);

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleRows.find((r) => r.codigo === roleCode);
    if (!role) continue;

    for (const permissionCode of permissionCodes) {
      const permission = permissionRows.find((p) => p.codigo === permissionCode);
      if (!permission) continue;

      await db.insert(rolesPermisos)
        .values({ rolId: role.id, permisoId: permission.id })
        .onConflictDoNothing();
    }
  }

  for (const departamento of DEPARTAMENTOS_DATA) {
    await db.insert(departamentos).values(departamento).onConflictDoUpdate({
      target: departamentos.codigo,
      set: {
        nombre: departamento.nombre,
        descripcion: departamento.descripcion,
        nivel: departamento.nivel,
        activo: true,
        updatedAt: now,
      },
    });
  }

  for (const item of CONFIGURACION_DATA) {
    await db.insert(configuracion).values(item).onConflictDoUpdate({
      target: configuracion.clave,
      set: {
        descripcion: item.descripcion,
        categoria: item.categoria,
        tipoDato: item.tipoDato,
        esPublico: item.esPublico,
        updatedAt: now,
      },
    });
  }

  await db.insert(anosLaborales).values({
    ano: 2026,
    nombre: 'Periodo 2026',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    activo: true,
  }).onConflictDoUpdate({
    target: anosLaborales.ano,
    set: {
      nombre: 'Periodo 2026',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      activo: true,
      updatedAt: now,
    },
  });
}

async function seedDemoUsers() {
  if (process.env.SEED_DEMO_USERS !== 'true') {
    console.log('Usuarios demo omitidos. Define SEED_DEMO_USERS=true para crearlos explicitamente.');
    return;
  }

  const demoPassword = process.env.DEMO_USERS_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_USERS_PASSWORD es requerido cuando SEED_DEMO_USERS=true');
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const roleRows = await db.select().from(roles);
  const deptRows = await db.select().from(departamentos);
  const ano2026 = (await db.select().from(anosLaborales).where(eq(anosLaborales.ano, 2026)))[0];

  const demoUsers = [
    { email: 'rrhh@cni.hn', nombre: 'Maria', apellido: 'RRHH', cargo: 'Gerente RRHH', role: 'RRHH', dept: 'RRHH', esRrhh: true, esJefe: false, esAdmin: false },
    { email: 'jefe.ti@cni.hn', nombre: 'Roberto', apellido: 'Jefe TI', cargo: 'Jefe de TI', role: 'JEFE', dept: 'TI', esRrhh: false, esJefe: true, esAdmin: false },
    { email: 'ana.dev@cni.hn', nombre: 'Ana', apellido: 'Desarrolladora', cargo: 'Developer Senior', role: 'EMPLEADO', dept: 'TI', esRrhh: false, esJefe: false, esAdmin: false },
  ];

  for (const user of demoUsers) {
    const role = roleRows.find((r) => r.codigo === user.role);
    const dept = deptRows.find((d) => d.codigo === user.dept);
    if (!role || !dept || !ano2026) continue;

    const existingUser = (await db.select().from(usuarios).where(eq(usuarios.email, user.email)))[0];
    const [createdOrUpdated] = existingUser
      ? await db.update(usuarios).set({
        nombre: user.nombre,
        apellido: user.apellido,
        passwordHash,
        departamentoId: dept.id,
        cargo: user.cargo,
        esAdmin: user.esAdmin,
        esRrhh: user.esRrhh,
        esJefe: user.esJefe,
        activo: true,
        updatedAt: new Date().toISOString(),
      }).where(eq(usuarios.id, existingUser.id)).returning()
      : await db.insert(usuarios).values({
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        passwordHash,
        departamentoId: dept.id,
        cargo: user.cargo,
        esAdmin: user.esAdmin,
        esRrhh: user.esRrhh,
        esJefe: user.esJefe,
        activo: true,
      }).returning();

    await db.insert(usuariosRoles)
      .values({ usuarioId: createdOrUpdated.id, rolId: role.id, activo: true })
      .onConflictDoUpdate({
        target: [usuariosRoles.usuarioId, usuariosRoles.rolId],
        set: { activo: true },
      });

    await db.insert(usuariosDepartamentos).values({
      usuarioId: createdOrUpdated.id,
      departamentoId: dept.id,
      cargo: user.cargo,
    });

    await db.insert(balances).values({
      usuarioId: createdOrUpdated.id,
      anoLaboralId: ano2026.id,
      tipoAusencia: 'vacaciones',
      cantidadInicial: '15.00',
      cantidadAcumulada: '0.00',
      cantidadUsada: '0.00',
      cantidadPendiente: '0.00',
      cantidadDisponible: '15.00',
    }).onConflictDoNothing();
  }

  console.log(`${demoUsers.length} usuarios demo creados/actualizados sin imprimir contrasenas.`);
}

async function seed() {
  console.log('========================================');
  console.log('SEED CNI - datos base idempotentes');
  console.log('========================================\n');

  try {
    await upsertCatalogs();
    console.log('Datos base aplicados: roles, permisos, departamentos, configuracion y ano laboral.');

    await seedDemoUsers();

    console.log('\nSeed completado.');
  } catch (error) {
    console.error('ERROR:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
