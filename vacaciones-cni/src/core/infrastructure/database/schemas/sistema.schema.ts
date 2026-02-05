/**
 * @file sistema.schema.ts
 * @description Auditoría y Configuración del Sistema
 * @module Schemas - Sistema
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
  index
} from 'drizzle-orm/pg-core';

// Import for FK references
import { usuarios } from './estructura-org.schema';

// =====================================================
// TABLA: configuracion_sistema
// =====================================================
export const configuracionSistema = pgTable('configuracion_sistema', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  clave: varchar('clave', { length: 100 }).notNull().unique(),
  valor: text('valor').notNull(),
  tipoDato: varchar('tipo_dato', { length: 20 }).notNull().default('string'),
  descripcion: text('descripcion'),
  categoria: varchar('categoria', { length: 50 }),
  esPublico: boolean('es_publico').notNull().default(false),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  claveIdx: index('idx_config_clave').on(table.clave),
  categoriaIdx: index('idx_config_categoria').on(table.categoria)
}));

// =====================================================
// TABLA: auditoria
// =====================================================
export const auditoria = pgTable('auditoria', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' })
    .references(() => usuarios.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  accion: varchar('accion', { length: 50 }).notNull(),
  tablaAfectada: varchar('tabla_afectada', { length: 100 }).notNull(),
  registroId: bigint('registro_id', { mode: 'number' }),
  detalles: jsonb('detalles'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  usuarioIdx: index('idx_auditoria_usuario').on(table.usuarioId),
  accionIdx: index('idx_auditoria_accion').on(table.accion),
  tablaIdx: index('idx_auditoria_tabla').on(table.tablaAfectada),
  fechaIdx: index('idx_auditoria_fecha').on(table.fechaCreacion),
  usuarioFechaIdx: index('idx_auditoria_usuario_fecha').on(table.usuarioId, table.fechaCreacion)
}));

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export type ConfiguracionSistema = typeof configuracionSistema.$inferSelect;
export type NuevaConfiguracionSistema = typeof configuracionSistema.$inferInsert;
export type AuditoriaRegistro = typeof auditoria.$inferSelect;
export type NuevaAuditoria = typeof auditoria.$inferInsert;
