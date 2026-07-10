/**
 * Sistema de notificaciones in-app (Fase 5).
 *
 * Diseñado para mensajes operativos al empleado (no email).
 * Reemplaza la necesidad de reinventar tablas por cada tipo de aviso.
 *
 * Campos:
 *   - usuarioId: destinatario.
 *   - tipo: discriminador de dominio (asignacion_vacaciones, etc.).
 *   - titulo: encabezado corto.
 *   - mensaje: cuerpo (puede incluir HTML limitado).
 *   - referencia: id externo (e.g. "asignacion:123" o "solicitud:99").
 *   - leida: flag simple de acknowledgment.
 *   - createdAt: orden cronológico.
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth';

export const notificacionTipoEnum = varchar('notificacion_tipo', {
  length: 50,
}).$type<
  | 'asignacion_vacaciones'
  | 'sistema'
>();

export const notificaciones = pgTable(
  'notificaciones',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tipo: notificacionTipoEnum.notNull().default('sistema'),
    titulo: varchar('titulo', { length: 200 }).notNull(),
    mensaje: text('mensaje').notNull(),
    referencia: varchar('referencia', { length: 200 }),
    leida: boolean('leida').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxUsuarioLeida: index('idx_notificaciones_usuario_leida').on(
      table.usuarioId,
      table.leida
    ),
    idxUsuarioCreated: index('idx_notificaciones_usuario_created').on(
      table.usuarioId,
      table.createdAt
    ),
  })
);