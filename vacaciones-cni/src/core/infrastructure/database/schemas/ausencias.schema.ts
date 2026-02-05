/**
 * @file ausencias.schema.ts
 * @description Configuración de Tipos de Ausencia y Balances
 * @module Schemas - Ausencias
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
  decimal,
  date,
  timestamp, 
  jsonb, 
  pgEnum,
  uniqueIndex, 
  index
} from 'drizzle-orm/pg-core';

// Import for FK references
import { usuarios } from './estructura-org.schema';

// =====================================================
// ENUMS
// =====================================================
export const tipoAusenciaEnum = pgEnum('tipo_ausencia', [
  'vacaciones',
  'permiso_personal',
  'permiso_medico',
  'permiso_maternidad',
  'permiso_paternidad',
  'permiso_estudio',
  'permiso_duelo',
  'permiso_otro'
]);

export const unidadTiempoEnum = pgEnum('unidad_tiempo', ['dias', 'horas']);
export const estadoBalanceEnum = pgEnum('estado_balance', ['activo', 'vencido', 'suspendido']);

// =====================================================
// TABLA: tipos_ausencia_config
// =====================================================
export const tiposAusenciaConfig = pgTable('tipos_ausencia_config', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tipo: tipoAusenciaEnum('tipo').notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  requiereAprobacionJefe: boolean('requiere_aprobacion_jefe').notNull().default(true),
  requiereAprobacionRrhh: boolean('requiere_aprobacion_rrhh').notNull().default(true),
  diasMaximosPorSolicitud: integer('dias_maximos_por_solicitud'),
  diasAnticipacionMinima: integer('dias_anticipacion_minima').default(0),
  permiteMedioDia: boolean('permite_medio_dia').notNull().default(false),
  permiteHoras: boolean('permite_horas').notNull().default(false),
  requiereDocumento: boolean('requiere_documento').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  colorHex: varchar('color_hex', { length: 7 }).default('#3B82F6'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  tipoIdx: index('idx_tipos_ausencia_tipo').on(table.tipo),
  activoIdx: index('idx_tipos_ausencia_activo').on(table.activo)
}));

// =====================================================
// TABLA: balances_ausencias
// =====================================================
export const balancesAusencias = pgTable('balances_ausencias', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' }).notNull()
    .references(() => usuarios.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  tipoAusenciaId: bigint('tipo_ausencia_id', { mode: 'number' }).notNull()
    .references(() => tiposAusenciaConfig.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  anio: integer('anio').notNull(),
  cantidadAsignada: decimal('cantidad_asignada', { precision: 10, scale: 2 }).notNull().default('0'),
  cantidadUtilizada: decimal('cantidad_utilizada', { precision: 10, scale: 2 }).notNull().default('0'),
  cantidadPendiente: decimal('cantidad_pendiente', { precision: 10, scale: 2 }).notNull().default('0'),
  // cantidadDisponible será agregada vía migración SQL como columna GENERATED
  estado: estadoBalanceEnum('estado').notNull().default('activo'),
  fechaVencimiento: date('fecha_vencimiento'),
  notas: text('notas'),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  usuarioIdx: index('idx_balances_usuario').on(table.usuarioId),
  anioIdx: index('idx_balances_anio').on(table.anio),
  uniqueBalance: uniqueIndex('uq_balance_usuario_tipo_anio').on(table.usuarioId, table.tipoAusenciaId, table.anio),
  usuarioAnioEstadoIdx: index('idx_balances_usuario_anio_estado').on(
    table.usuarioId, 
    table.anio, 
    table.estado
  )
}));

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export type TipoAusenciaConfig = typeof tiposAusenciaConfig.$inferSelect;
export type NuevoTipoAusenciaConfig = typeof tiposAusenciaConfig.$inferInsert;
export type BalanceAusencia = typeof balancesAusencias.$inferSelect;
export type NuevoBalanceAusencia = typeof balancesAusencias.$inferInsert;
