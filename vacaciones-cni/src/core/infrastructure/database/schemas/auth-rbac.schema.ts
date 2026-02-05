/**
 * @file auth-rbac.schema.ts
 * @description Sistema RBAC (Role-Based Access Control)
 * @module Schemas - Auth/RBAC
 * @version 3.0
 * @date 5 febrero 2026
 */

import { 
  pgTable, 
  bigserial, 
  bigint,
  varchar, 
  text, 
  boolean, 
  integer, 
  timestamp, 
  jsonb, 
  uniqueIndex, 
  index
} from 'drizzle-orm/pg-core';

// Import for FK references
import { usuarios } from './estructura-org.schema';
import { departamentos } from './estructura-org.schema';

// =====================================================
// TABLA: roles
// =====================================================
export const roles = pgTable('roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  nivel: integer('nivel').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  esRolSistema: boolean('es_rol_sistema').notNull().default(false),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  codigoIdx: index('idx_roles_codigo').on(table.codigo),
  nivelIdx: index('idx_roles_nivel').on(table.nivel)
}));

// =====================================================
// TABLA: permisos
// =====================================================
export const permisos = pgTable('permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 100 }).notNull().unique(),
  modulo: varchar('modulo', { length: 50 }).notNull(),
  accion: varchar('accion', { length: 50 }).notNull(),
  descripcion: text('descripcion'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  moduloAccionIdx: index('idx_permisos_modulo_accion').on(table.modulo, table.accion),
  codigoIdx: index('idx_permisos_codigo').on(table.codigo)
}));

// =====================================================
// TABLA: roles_permisos (N:M)
// =====================================================
export const rolesPermisos = pgTable('roles_permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  permisoId: bigint('permiso_id', { mode: 'number' }).notNull()
    .references(() => permisos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueRolPermiso: uniqueIndex('uq_rol_permiso').on(table.rolId, table.permisoId),
  rolIdx: index('idx_roles_permisos_rol').on(table.rolId),
  permisoIdx: index('idx_roles_permisos_permiso').on(table.permisoId)
}));

// =====================================================
// TABLA: usuarios_roles (N:M con scope)
// =====================================================
export const usuariosRoles = pgTable('usuarios_roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' }).notNull()
    .references(() => usuarios.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  departamentoId: bigint('departamento_id', { mode: 'number' })
    .references(() => departamentos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true }).defaultNow(),
  fechaExpiracion: timestamp('fecha_expiracion', { withTimezone: true }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueUsuarioRolDepto: uniqueIndex('uq_usuario_rol_depto').on(
    table.usuarioId, 
    table.rolId, 
    table.departamentoId
  ),
  usuarioIdx: index('idx_usuarios_roles_usuario').on(table.usuarioId),
  rolIdx: index('idx_usuarios_roles_rol').on(table.rolId),
  usuarioActivoIdx: index('idx_usuarios_roles_usuario_activo').on(table.usuarioId, table.activo)
}));

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export type Rol = typeof roles.$inferSelect;
export type NuevoRol = typeof roles.$inferInsert;
export type Permiso = typeof permisos.$inferSelect;
export type NuevoPermiso = typeof permisos.$inferInsert;
export type RolPermiso = typeof rolesPermisos.$inferSelect;
export type UsuarioRol = typeof usuariosRoles.$inferSelect;
export type NuevoUsuarioRol = typeof usuariosRoles.$inferInsert;
