/**
 * @file estructura-org.schema.ts
 * @description Estructura Organizacional (Departamentos y Usuarios)
 * @module Schemas - Organización
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
  date,
  timestamp, 
  jsonb, 
  index
} from 'drizzle-orm/pg-core';

// =====================================================
// TABLA: departamentos
// =====================================================
export const departamentos = pgTable('departamentos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  codigo: varchar('codigo', { length: 20 }).notNull().unique(),
  descripcion: text('descripcion'),
  departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' })
    .references((): any => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  codigoIdx: index('idx_departamentos_codigo').on(table.codigo),
  padreIdx: index('idx_departamentos_padre').on(table.departamentoPadreId),
  activoIdx: index('idx_departamentos_activo').on(table.activo)
}));

// =====================================================
// TABLA: usuarios
// =====================================================
export const usuarios = pgTable('usuarios', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  apellido: varchar('apellido', { length: 100 }).notNull(),
  password: varchar('password_hash', { length: 255 }).notNull(),
  departamentoId: bigint('departamento_id', { mode: 'number' }).notNull()
    .references(() => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  cargo: varchar('cargo', { length: 100 }),
  // ⚠️ DEPRECADO - Mantener temporalmente para compatibilidad, eliminar en siguiente fase
  esJefe: boolean('es_jefe').notNull().default(false),
  esRrhh: boolean('es_rrhh').notNull().default(false),
  esAdmin: boolean('es_admin').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  fechaIngreso: date('fecha_ingreso'),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  ultimoAcceso: timestamp('ultimo_acceso', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  emailIdx: index('idx_usuarios_email').on(table.email),
  departamentoIdx: index('idx_usuarios_departamento').on(table.departamentoId),
  activoIdx: index('idx_usuarios_activo').on(table.activo),
  deptoActivoIdx: index('idx_usuarios_depto_activo').on(table.departamentoId, table.activo)
}));

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export type Departamento = typeof departamentos.$inferSelect;
export type NuevoDepartamento = typeof departamentos.$inferInsert;
export type Usuario = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
