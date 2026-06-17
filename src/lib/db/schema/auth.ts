/**
 * ============================================================
 * SCHEMA: AUTENTICACIÓN Y RBAC
 * ============================================================
 * @module auth
 * @description Sistema de autenticación y control de acceso
 * @author Database Architect Senior
 * @version 5.0 - Arquitectura Limpia CNI
 * ============================================================
 */

import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// TABLA: usuarios
// ============================================================
export const usuarios = pgTable(
  'usuarios',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    apellido: varchar('apellido', { length: 100 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    
    departamentoId: bigint('departamento_id', { mode: 'number' }),
    cargo: varchar('cargo', { length: 100 }),
    
    // Datos adicionales
    numeroEmpleado: varchar('numero_empleado', { length: 50 }),
    telefono: varchar('telefono', { length: 50 }),
    direccion: text('direccion'),
    
    // Flags de rol (simplificación para queries rápidas)
    esDirector: boolean('es_director').notNull().default(false),
    esJefe: boolean('es_jefe').notNull().default(false),
    esRrhh: boolean('es_rrhh').notNull().default(false),
    esAdmin: boolean('es_admin').notNull().default(false),
    
    // Jerarquía: quién aprueba las solicitudes de este usuario
    jefeSuperiorId: bigint('jefe_superior_id', { mode: 'number' }),
    
    // Estado y metadatos
    activo: boolean('activo').notNull().default(true),
    fechaIngreso: timestamp('fecha_ingreso', { withTimezone: true, mode: 'string' }),
    metadata: jsonb('metadata').default({}).notNull(),
    
    // Auditoría
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    ultimoAcceso: timestamp('ultimo_acceso', { withTimezone: true, mode: 'string' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    uqEmail: unique('uq_usuarios_email').on(table.email, table.deletedAt),
    idxEmail: index('idx_usuarios_email').on(table.email),
    idxActivo: index('idx_usuarios_activo').on(table.activo),
    idxDepartamento: index('idx_usuarios_departamento').on(table.departamentoId),
    idxDirector: index('idx_usuarios_director').on(table.esDirector, table.activo),
    idxJefe: index('idx_usuarios_jefe').on(table.esJefe, table.activo),
    idxRrhh: index('idx_usuarios_rrhh').on(table.esRrhh, table.activo),
    idxJefeSuperior: index('idx_usuarios_jefe_superior').on(table.jefeSuperiorId),
  })
);

// ============================================================
// TABLA: roles
// ============================================================
export const roles = pgTable(
  'roles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    descripcion: text('descripcion'),
    nivel: integer('nivel').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    esRolSistema: boolean('es_rol_sistema').notNull().default(false),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqCodigo: unique('uq_roles_codigo').on(table.codigo),
    idxCodigo: index('idx_roles_codigo').on(table.codigo),
    idxNivel: index('idx_roles_nivel').on(table.nivel, table.activo),
  })
);

// ============================================================
// TABLA: permisos
// ============================================================
export const permisos = pgTable(
  'permisos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    codigo: varchar('codigo', { length: 100 }).notNull(),
    modulo: varchar('modulo', { length: 50 }).notNull(),
    recurso: varchar('recurso', { length: 50 }).notNull(),
    accion: varchar('accion', { length: 50 }).notNull(),
    descripcion: text('descripcion'),
    activo: boolean('activo').notNull().default(true),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqCodigo: unique('uq_permisos_codigo').on(table.codigo),
    idxCodigo: index('idx_permisos_codigo').on(table.codigo),
    idxModulo: index('idx_permisos_modulo').on(table.modulo, table.recurso),
  })
);

// ============================================================
// TABLA: usuarios_roles (N:M)
// ============================================================
export const usuariosRoles = pgTable(
  'usuarios_roles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    rolId: bigint('rol_id', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    activo: boolean('activo').notNull().default(true),
  },
  (table) => ({
    uqUsuarioRol: unique('uq_usuario_rol').on(table.usuarioId, table.rolId),
    idxUsuario: index('idx_usuarios_roles_usuario').on(table.usuarioId),
    idxRol: index('idx_usuarios_roles_rol').on(table.rolId),
  })
);

// ============================================================
// TABLA: roles_permisos (N:M)
// ============================================================
export const rolesPermisos = pgTable(
  'roles_permisos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    rolId: bigint('rol_id', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permisoId: bigint('permiso_id', { mode: 'number' })
      .notNull()
      .references(() => permisos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqRolPermiso: unique('uq_rol_permiso').on(table.rolId, table.permisoId),
    idxRol: index('idx_roles_permisos_rol').on(table.rolId),
    idxPermiso: index('idx_roles_permisos_permiso').on(table.permisoId),
  })
);

// ============================================================
// TABLA: sessions (NextAuth)
// ============================================================
export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionToken: varchar('session_token', { length: 255 }).notNull(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqToken: unique('uq_session_token').on(table.sessionToken),
    idxToken: index('idx_sessions_token').on(table.sessionToken),
    idxUsuario: index('idx_sessions_usuario').on(table.usuarioId),
    idxExpires: index('idx_sessions_expires').on(table.expires),
  })
);

// ============================================================
// TABLA: rate_limits (control de fuerza bruta, multi-instancia)
// ============================================================
export const rateLimits = pgTable(
  'rate_limits',
  {
    identifier: varchar('identifier', { length: 255 }).primaryKey(),
    count: integer('count').notNull().default(0),
    resetTime: timestamp('reset_time', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxResetTime: index('idx_rate_limits_reset_time').on(table.resetTime),
  })
);

// ============================================================
// RELACIONES
// ============================================================
export const usuariosRelations = relations(usuarios, ({ many }) => ({
  usuariosRoles: many(usuariosRoles),
  sessions: many(sessions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  usuariosRoles: many(usuariosRoles),
  rolesPermisos: many(rolesPermisos),
}));

export const permisosRelations = relations(permisos, ({ many }) => ({
  rolesPermisos: many(rolesPermisos),
}));

export const usuariosRolesRelations = relations(usuariosRoles, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [usuariosRoles.usuarioId],
    references: [usuarios.id],
  }),
  rol: one(roles, {
    fields: [usuariosRoles.rolId],
    references: [roles.id],
  }),
}));

export const rolesPermisosRelations = relations(rolesPermisos, ({ one }) => ({
  rol: one(roles, {
    fields: [rolesPermisos.rolId],
    references: [roles.id],
  }),
  permiso: one(permisos, {
    fields: [rolesPermisos.permisoId],
    references: [permisos.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [sessions.usuarioId],
    references: [usuarios.id],
  }),
}));
