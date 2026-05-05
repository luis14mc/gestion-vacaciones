/**
 * ============================================================
 * SCHEMA: ORGANIZACIÓN
 * ============================================================
 * @module organizacion
 * @description Estructura organizacional (departamentos y jerarquías)
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
import { usuarios } from './auth';

// ============================================================
// TABLA: departamentos
// ============================================================
export const departamentos = pgTable(
  'departamentos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    descripcion: text('descripcion'),
    
    // Jefe del departamento (ID plano - evita circular con usuarios)
    // Validar en capa de servicio que el jefe existe y es activo
    jefeId: bigint('jefe_id', { mode: 'number' }),
    
    // Jerarquía de departamentos (árbol)
    departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' }),
    nivel: integer('nivel').notNull().default(1),
    
    // Estado
    activo: boolean('activo').notNull().default(true),
    metadata: jsonb('metadata').default({}).notNull(),
    
    // Auditoría
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    uqCodigo: unique('uq_departamentos_codigo').on(table.codigo),
    idxCodigo: index('idx_departamentos_codigo').on(table.codigo),
    idxJefe: index('idx_departamentos_jefe').on(table.jefeId),
    idxPadre: index('idx_departamentos_padre').on(table.departamentoPadreId),
    idxActivo: index('idx_departamentos_activo').on(table.activo),
    idxNivel: index('idx_departamentos_nivel').on(table.nivel),
  })
);

// ============================================================
// TABLA: usuarios_departamentos (Historial de asignaciones)
// ============================================================
export const usuariosDepartamentos = pgTable(
  'usuarios_departamentos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    departamentoId: bigint('departamento_id', { mode: 'number' })
      .notNull()
      .references(() => departamentos.id, { onDelete: 'restrict' }),
    
    // Periodo de asignación
    fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    fechaBaja: timestamp('fecha_baja', { withTimezone: true, mode: 'string' }),
    esAsignacionActual: boolean('es_asignacion_actual').notNull().default(true),
    
    // Información adicional
    cargo: varchar('cargo', { length: 100 }),
    motivo: text('motivo'),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => ({
    idxUsuario: index('idx_usuarios_departamentos_usuario').on(
      table.usuarioId,
      table.esAsignacionActual
    ),
    idxDepartamento: index('idx_usuarios_departamentos_departamento').on(
      table.departamentoId,
      table.esAsignacionActual
    ),
    idxActual: index('idx_usuarios_departamentos_actual').on(
      table.usuarioId,
      table.departamentoId,
      table.esAsignacionActual
    ),
  })
);

// ============================================================
// TABLA: configuracion (Key-Value config store)
// ============================================================
export const configuracion = pgTable(
  'configuracion',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clave: varchar('clave', { length: 255 }).notNull(),
    valor: text('valor').notNull().default(''),
    descripcion: text('descripcion'),
    categoria: varchar('categoria', { length: 100 }).notNull().default('general'),
    tipoDato: varchar('tipo_dato', { length: 50 }).notNull().default('string'),
    esPublico: boolean('es_publico').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqClave: unique('uq_configuracion_clave').on(table.clave),
    idxCategoria: index('idx_configuracion_categoria').on(table.categoria),
  })
);

// ============================================================
// RELACIONES
// ============================================================
export const departamentosRelations = relations(departamentos, ({ one, many }) => ({
  // Relación auto-referencial para jerarquía
  departamentoPadre: one(departamentos, {
    fields: [departamentos.departamentoPadreId],
    references: [departamentos.id],
    relationName: 'jerarquia',
  }),
  subDepartamentos: many(departamentos, { relationName: 'jerarquia' }),
  
  // Asignaciones de usuarios
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
