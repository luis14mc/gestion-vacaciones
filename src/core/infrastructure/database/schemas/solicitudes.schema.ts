/**
 * @file solicitudes.schema.ts
 * @description Solicitudes de Ausencias (Core del negocio)
 * @module Schemas - Solicitudes
 * @version 3.0
 * @date 5 febrero 2026
 */

import { 
  pgTable, 
  bigserial, 
  bigint,
  varchar, 
  text, 
  decimal, 
  date, 
  time,
  timestamp, 
  jsonb, 
  pgEnum,
  integer,
  uniqueIndex, 
  index
} from 'drizzle-orm/pg-core';

// Import for FK references
import { usuarios } from './estructura-org.schema';
import { tiposAusenciaConfig } from './ausencias.schema';

// =====================================================
// ENUMS
// =====================================================
export const estadoSolicitudEnum = pgEnum('estado_solicitud', [
  'borrador',
  'pendiente',
  'aprobada_jefe',
  'aprobada',
  'rechazada',
  'cancelada',
  'en_uso'
]);

// =====================================================
// TABLA: solicitudes (particionada)
// =====================================================
export const solicitudes = pgTable('solicitudes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull(),
  usuarioId: bigint('usuario_id', { mode: 'number' }).notNull()
    .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  tipoAusenciaId: bigint('tipo_ausencia_id', { mode: 'number' }).notNull()
    .references(() => tiposAusenciaConfig.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin: date('fecha_fin').notNull(),
  horaInicio: time('hora_inicio'),
  horaFin: time('hora_fin'),
  cantidad: decimal('cantidad', { precision: 10, scale: 2 }).notNull(),
  unidad: varchar('unidad', { length: 10 }).notNull().default('dias'),
  estado: estadoSolicitudEnum('estado').notNull().default('borrador'),
  fechaSolicitud: timestamp('fecha_solicitud', { withTimezone: true }).defaultNow(),
  fechaAprobacionJefe: timestamp('fecha_aprobacion_jefe', { withTimezone: true }),
  fechaAprobacionRrhh: timestamp('fecha_aprobacion_rrhh', { withTimezone: true }),
  fechaRechazo: timestamp('fecha_rechazo', { withTimezone: true }),
  aprobadoPor: bigint('aprobado_por', { mode: 'number' })
    .references(() => usuarios.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  aprobadoRrhhPor: bigint('aprobado_rrhh_por', { mode: 'number' })
    .references(() => usuarios.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  rechazadoPor: bigint('rechazado_por', { mode: 'number' })
    .references(() => usuarios.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  motivo: text('motivo'),
  motivoRechazo: text('motivo_rechazo'),
  observaciones: text('observaciones'),
  documentosAdjuntos: jsonb('documentos_adjuntos').default([]),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  codigoIdx: uniqueIndex('idx_solicitudes_codigo_unique').on(table.codigo, table.createdAt),
  codigoLookupIdx: index('idx_solicitudes_codigo_lookup').on(table.codigo),
  usuarioIdx: index('idx_solicitudes_usuario').on(table.usuarioId),
  estadoIdx: index('idx_solicitudes_estado').on(table.estado),
  createdIdx: index('idx_solicitudes_created').on(table.createdAt),
  usuarioEstadoFechaIdx: index('idx_solicitudes_usuario_estado_fecha').on(
    table.usuarioId,
    table.estado, 
    table.fechaInicio
  ),
  estadoCreatedIdx: index('idx_solicitudes_estado_created').on(
    table.estado,
    table.createdAt
  ),
  fechasIdx: index('idx_solicitudes_fechas').on(table.fechaInicio, table.fechaFin)
}));

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export type Solicitud = typeof solicitudes.$inferSelect;
export type NuevaSolicitud = typeof solicitudes.$inferInsert;
