import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
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
