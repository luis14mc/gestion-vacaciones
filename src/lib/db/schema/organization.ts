/**
 * =====================================================
 * SCHEMA: ORGANIZATION - Estructura Organizacional
 * =====================================================
 * @module organization
 * @description Departamentos y jerarquías organizacionales
 * @author Database Engineer Senior
 * @version 3.0
 */

import { 
  pgTable, 
  bigserial,
  bigint, 
  varchar, 
  text, 
  boolean, 
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { usuarios } from './auth';

// =====================================================
// TABLA: departamentos
// =====================================================
export const departamentos = pgTable('departamentos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  codigo: varchar('codigo', { length: 20 }).notNull().unique(),
  descripcion: text('descripcion'),
  departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' })
    .references((): any => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, (table) => ({
  // Unique constraint con soft delete
  uqDepartamentoNombre: unique('uq_departamento_nombre').on(table.nombre, table.deletedAt),
  uqDepartamentoCodigo: unique('uq_departamento_codigo').on(table.codigo, table.deletedAt),
  
  // Índices para queries jerárquicas
  idxDepartamentosCodigo: index('idx_departamentos_codigo')
    .on(table.codigo),
  idxDepartamentosPadre: index('idx_departamentos_padre')
    .on(table.departamentoPadreId),
  idxDepartamentosActivo: index('idx_departamentos_activo')
    .on(table.activo),
}));

// =====================================================
// TABLA: usuarios_departamentos (N:M con historial)
// =====================================================
export const usuariosDepartamentos = pgTable('usuarios_departamentos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' })
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  departamentoId: bigint('departamento_id', { mode: 'number' })
    .notNull()
    .references(() => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  esJefe: boolean('es_jefe').notNull().default(false),
  fechaInicio: timestamp('fecha_inicio', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  fechaFin: timestamp('fecha_fin', { withTimezone: true, mode: 'string' }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}).notNull(),
}, (table) => ({
  // Índices para búsquedas de jerarquía
  idxUsuariosDeptoUsuario: index('idx_usuarios_depto_usuario')
    .on(table.usuarioId, table.activo),
  idxUsuariosDeptoDepto: index('idx_usuarios_depto_depto')
    .on(table.departamentoId, table.activo),
  idxUsuariosDeptoJefe: index('idx_usuarios_depto_jefe')
    .on(table.departamentoId, table.esJefe, table.activo),
  
  // Constraint: Solo un jefe activo por departamento
  // Nota: Unique constraint sin where() por limitaciones de Drizzle
  // Se debe validar en lógica de aplicación
}));

// =====================================================
// RELACIONES
// =====================================================

export const departamentosRelations = relations(departamentos, ({ one, many }) => ({
  departamentoPadre: one(departamentos, {
    fields: [departamentos.departamentoPadreId],
    references: [departamentos.id],
    relationName: 'jerarquia',
  }),
  subdepartamentos: many(departamentos, {
    relationName: 'jerarquia',
  }),
  usuariosDepartamentos: many(usuariosDepartamentos),
}));

export const usuariosDepartamentosRelations = relations(usuariosDepartamentos, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [usuariosDepartamentos.usuarioId],
    references: [usuarios.id],
  }),
  departamento: one(departamentos, {
    fields: [usuariosDepartamentos.departamentoId],
    references: [departamentos.id],
  }),
}));

