/**
 * Fase 5 — Historial de asignaciones mensuales de vacaciones.
 *
 * Una fila por (usuarioId, anio, mes) ejecutado. Restricción UNIQUE
 * para evitar asignaciones duplicadas del mismo período.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  bigserial,
  bigint,
  integer,
  numeric,
  varchar,
  text,
  timestamp,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth';

export const origenAsignacionEnum = varchar('origen_asignacion', {
  length: 20,
}).$type<'automatico' | 'manual' | 'sistema'>();

export const historialAsignacionesMensuales = pgTable(
  'historial_asignaciones_mensuales',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    anio: integer('anio').notNull(),
    mes: integer('mes').notNull(),
    diasAsignados: numeric('dias_asignados', { precision: 6, scale: 4 }).notNull(),
    balanceAnterior: numeric('balance_anterior', { precision: 8, scale: 4 }).notNull(),
    balanceNuevo: numeric('balance_nuevo', { precision: 8, scale: 4 }).notNull(),
    diasAnualesAplicados: numeric('dias_anuales_aplicados', { precision: 6, scale: 2 }).notNull(),
    aniosAntiguedad: integer('anios_antiguedad').notNull(),
    origen: origenAsignacionEnum.notNull().default('automatico'),
    ejecutadoPor: bigint('ejecutado_por', { mode: 'number' })
      .references(() => usuarios.id, { onDelete: 'set null' }),
    ejecutadoEn: timestamp('ejecutado_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    observacion: text('observacion'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Restricción dura: una sola asignación por usuario + año + mes.
    uqUsuarioAnioMes: unique('uq_hist_asig_mensual_usuario_anio_mes').on(
      table.usuarioId,
      table.anio,
      table.mes
    ),
    idxUsuarioAnio: index('idx_hist_asig_mensual_usuario_anio').on(
      table.usuarioId,
      table.anio.desc()
    ),
    idxAnioMes: index('idx_hist_asig_mensual_anio_mes').on(table.anio, table.mes),
    chkMes: check('chk_hist_asig_mensual_mes', sql`${table.mes} BETWEEN 1 AND 12`),
    chkAnio: check('chk_hist_asig_mensual_anio', sql`${table.anio} BETWEEN 2000 AND 2100`),
    chkDiasNoNeg: check('chk_hist_asig_mensual_dias_no_neg', sql`${table.diasAsignados} >= 0`),
  })
);