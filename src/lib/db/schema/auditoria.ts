import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  integer,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { usuarios } from './auth';

export const registrosAuditoria = pgTable(
  'registros_auditoria',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id),
    accion: varchar('accion', { length: 50 }).notNull(),
    tablaAfectada: varchar('tabla_afectada', { length: 50 }).notNull(),
    registroId: bigint('registro_id', { mode: 'number' }),
    detalles: text('detalles'), // JSON stringified or raw text
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxUsuario: index('idx_auditoria_usuario').on(table.usuarioId),
    idxUsuarioFecha: index('idx_auditoria_usuario_fecha').on(
      table.usuarioId,
      table.createdAt
    ),
    idxAccion: index('idx_auditoria_accion').on(table.accion),
    idxTabla: index('idx_auditoria_tabla').on(table.tablaAfectada),
    idxFecha: index('idx_auditoria_fecha').on(table.createdAt),
  })
);

export const registrosAuditoriaRelations = relations(registrosAuditoria, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [registrosAuditoria.usuarioId],
    references: [usuarios.id],
  }),
}));

export const notificacionesCumpleanosMensuales = pgTable(
  'notificaciones_cumpleanos_mensuales',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    anio: integer('anio').notNull(),
    mes: integer('mes').notNull(),
    enviadaAt: timestamp('enviada_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqUsuarioPeriodo: unique('uq_notificacion_cumpleanos_usuario_periodo').on(
      table.usuarioId,
      table.anio,
      table.mes
    ),
    idxPeriodo: index('idx_notificaciones_cumpleanos_periodo').on(table.anio, table.mes),
  })
);

export const notificacionesCumpleanosMensualesRelations = relations(
  notificacionesCumpleanosMensuales,
  ({ one }) => ({
    usuario: one(usuarios, {
      fields: [notificacionesCumpleanosMensuales.usuarioId],
      references: [usuarios.id],
    }),
  })
);
