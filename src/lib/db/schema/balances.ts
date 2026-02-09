/**
 * ============================================================
 * SCHEMA: BALANCES
 * ============================================================
 * @module balances
 * @description Gestión de días disponibles, pendientes y utilizados
 * @author Database Architect Senior
 * @version 5.0 - Arquitectura Limpia CNI
 * ============================================================
 */

import {
  pgTable,
  pgEnum,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { usuarios } from './auth';
import { anosLaborales } from './solicitudes';

// ============================================================
// ENUMS
// ============================================================

export const tipoAusenciaEnum = pgEnum('tipo_ausencia', [
  'vacaciones',
  'licencia_medica',
  'permiso_personal',
  'dia_libre',
  'licencia_paternidad',
  'licencia_maternidad',
  'compensacion',
]);

export const tipoMovimientoEnum = pgEnum('tipo_movimiento', [
  'credito_inicial',       // Asignación inicial del año
  'credito_mensual',       // Acumulación mensual
  'credito_manual',        // Ajuste manual de RRHH
  'debito_solicitud',      // Descuento por solicitud aprobada
  'debito_ajuste',         // Ajuste manual negativo
  'credito_devolucion',    // Devolución por cancelación
  'expiracion',            // Días que expiraron
]);

// ============================================================
// TABLA: balances
// ============================================================
export const balances = pgTable(
  'balances',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    
    // Referencias
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    anoLaboralId: bigint('ano_laboral_id', { mode: 'number' })
      .notNull()
      .references(() => anosLaborales.id, { onDelete: 'restrict' }),
    tipoAusencia: tipoAusenciaEnum('tipo_ausencia').notNull(),
    
    // ========================================
    // CANTIDADES (Gestión de Días)
    // ========================================
    
    // Días iniciales asignados al inicio del año
    cantidadInicial: decimal('cantidad_inicial', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    
    // Días acumulados durante el año (créditos adicionales)
    cantidadAcumulada: decimal('cantidad_acumulada', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    
    // Días ya utilizados (solicitudes aprobadas y finalizadas)
    cantidadUsada: decimal('cantidad_usada', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    
    // Días en solicitudes pendientes de aprobación
    cantidadPendiente: decimal('cantidad_pendiente', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    
    // Días disponibles para nuevas solicitudes
    // CALCULADO: (inicial + acumulada) - (usada + pendiente)
    // Se actualiza automáticamente por TRIGGER en PostgreSQL
    cantidadDisponible: decimal('cantidad_disponible', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    
    // ========================================
    // CONTROL Y ESTADO
    // ========================================
    
    // Fecha de expiración de días (si aplica)
    fechaExpiracion: date('fecha_expiracion', { mode: 'string' }),
    
    // Balance bloqueado (no permite nuevas solicitudes)
    bloqueado: boolean('bloqueado').notNull().default(false),
    motivoBloqueo: text('motivo_bloqueo'),
    
    // Control de versiones (optimistic locking)
    version: integer('version').notNull().default(1),
    
    // Metadata
    metadata: jsonb('metadata').default({}).notNull(),
    
    // Auditoría
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Un balance único por usuario/año/tipo
    uqBalance: unique('uq_balances_usuario_ano_tipo').on(
      table.usuarioId,
      table.anoLaboralId,
      table.tipoAusencia
    ),
    
    // Índices para consultas rápidas
    idxUsuario: index('idx_balances_usuario').on(table.usuarioId, table.anoLaboralId),
    idxAno: index('idx_balances_ano').on(table.anoLaboralId),
    idxTipo: index('idx_balances_tipo').on(table.tipoAusencia),
    idxDisponible: index('idx_balances_disponible').on(
      table.usuarioId,
      table.cantidadDisponible,
      table.bloqueado
    ),
    idxExpiracion: index('idx_balances_expiracion').on(table.fechaExpiracion),
    idxVersion: index('idx_balances_version').on(table.id, table.version),
    
    // Checks de integridad
    chkInicial: check(
      'chk_balances_inicial',
      sql`${table.cantidadInicial} >= 0`
    ),
    chkUsada: check(
      'chk_balances_usada',
      sql`${table.cantidadUsada} >= 0`
    ),
    chkPendiente: check(
      'chk_balances_pendiente',
      sql`${table.cantidadPendiente} >= 0`
    ),
    chkDisponible: check(
      'chk_balances_disponible',
      sql`${table.cantidadDisponible} >= 0`
    ),
  })
);

// ============================================================
// TABLA: historial_balances (Auditoría de movimientos)
// ============================================================
export const historialBalances = pgTable(
  'historial_balances',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    
    // Referencias
    balanceId: bigint('balance_id', { mode: 'number' })
      .notNull()
      .references(() => balances.id, { onDelete: 'cascade' }),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    
    // Movimiento
    tipoMovimiento: tipoMovimientoEnum('tipo_movimiento').notNull(),
    cantidad: decimal('cantidad', { precision: 10, scale: 2 }).notNull(),
    cantidadAnterior: decimal('cantidad_anterior', { precision: 10, scale: 2 }).notNull(),
    cantidadNueva: decimal('cantidad_nueva', { precision: 10, scale: 2 }).notNull(),
    
    // Contexto del movimiento
    solicitudId: bigint('solicitud_id', { mode: 'number' }),  // ID plano sin FK (simplificación)
    referencia: varchar('referencia', { length: 255 }),
    motivo: text('motivo'),
    descripcion: text('descripcion'),
    
    // Responsable del movimiento
    realizadoPor: bigint('realizado_por', { mode: 'number' })
      .references(() => usuarios.id),
    
    // Metadata
    metadata: jsonb('metadata').default({}).notNull(),
    
    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxBalance: index('idx_historial_balances_balance').on(table.balanceId),
    idxUsuario: index('idx_historial_balances_usuario').on(table.usuarioId, table.createdAt),
    idxSolicitud: index('idx_historial_balances_solicitud').on(table.solicitudId),
    idxTipo: index('idx_historial_balances_tipo').on(table.tipoMovimiento, table.createdAt),
    idxFecha: index('idx_historial_balances_fecha').on(table.createdAt),
  })
);

// ============================================================
// RELACIONES
// ============================================================
export const balancesRelations = relations(balances, ({ one, many }) => ({
  usuario: one(usuarios, {
    fields: [balances.usuarioId],
    references: [usuarios.id],
  }),
  anoLaboral: one(anosLaborales, {
    fields: [balances.anoLaboralId],
    references: [anosLaborales.id],
  }),
  historial: many(historialBalances),
}));

export const historialBalancesRelations = relations(historialBalances, ({ one }) => ({
  balance: one(balances, {
    fields: [historialBalances.balanceId],
    references: [balances.id],
  }),
  usuario: one(usuarios, {
    fields: [historialBalances.usuarioId],
    references: [usuarios.id],
    relationName: 'historial_usuario',
  }),
  realizador: one(usuarios, {
    fields: [historialBalances.realizadoPor],
    references: [usuarios.id],
    relationName: 'historial_realizador',
  }),
}));
