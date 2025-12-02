import { pgTable, bigserial, varchar, text, boolean, integer, decimal, date, timestamp, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
// TABLA: departamentos
// =====================================================
export const departamentos = pgTable('departamentos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  codigo: varchar('codigo', { length: 20 }).notNull().unique(),
  descripcion: text('descripcion'),
  departamentoPadreId: bigserial('departamento_padre_id', { mode: 'number' }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  codigoIdx: index('idx_departamentos_codigo').on(table.codigo),
  padreIdx: index('idx_departamentos_padre').on(table.departamentoPadreId),
  activoIdx: index('idx_departamentos_activo').on(table.activo)
}));

// =====================================================
// TABLA: usuarios
// =====================================================
export const usuarios = pgTable('usuarios', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  apellido: varchar('apellido', { length: 100 }).notNull(),
  password: varchar('password_hash', { length: 255 }).notNull(),
  departamentoId: bigserial('departamento_id', { mode: 'number' }).notNull(),
  cargo: varchar('cargo', { length: 100 }),
  esJefe: boolean('es_jefe').notNull().default(false),
  esRrhh: boolean('es_rrhh').notNull().default(false),
  esAdmin: boolean('es_admin').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  fechaIngreso: date('fecha_ingreso'),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  ultimoAcceso: timestamp('ultimo_acceso', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  emailIdx: index('idx_usuarios_email').on(table.email),
  departamentoIdx: index('idx_usuarios_departamento').on(table.departamentoId),
  activoIdx: index('idx_usuarios_activo').on(table.activo)
}));

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
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  tipoIdx: index('idx_tipos_ausencia_tipo').on(table.tipo)
}));

// =====================================================
// TABLA: balances_ausencias
// =====================================================
export const balancesAusencias = pgTable('balances_ausencias', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigserial('usuario_id', { mode: 'number' }).notNull(),
  tipoAusenciaId: bigserial('tipo_ausencia_id', { mode: 'number' }).notNull(),
  anio: integer('anio').notNull(),
  cantidadAsignada: decimal('cantidad_asignada', { precision: 10, scale: 2 }).notNull().default('0'),
  cantidadUtilizada: decimal('cantidad_utilizada', { precision: 10, scale: 2 }).notNull().default('0'),
  cantidadPendiente: decimal('cantidad_pendiente', { precision: 10, scale: 2 }).notNull().default('0'),
  // cantidad_disponible es GENERATED en BD, se calcula automáticamente
  estado: estadoBalanceEnum('estado').notNull().default('activo'),
  fechaVencimiento: date('fecha_vencimiento'),
  notas: text('notas'),
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  usuarioIdx: index('idx_balances_usuario').on(table.usuarioId),
  anioIdx: index('idx_balances_anio').on(table.anio),
  uniqueBalance: uniqueIndex('uq_balance_usuario_tipo_anio').on(table.usuarioId, table.tipoAusenciaId, table.anio)
}));

// =====================================================
// TABLA: solicitudes (particionada por created_at)
// =====================================================
export const solicitudes = pgTable('solicitudes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 50 }),
  usuarioId: bigserial('usuario_id', { mode: 'number' }).notNull(),
  tipoAusenciaId: bigserial('tipo_ausencia_id', { mode: 'number' }).notNull(),
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin: date('fecha_fin').notNull(),
  horaInicio: varchar('hora_inicio', { length: 5 }), // TIME como string HH:MM
  horaFin: varchar('hora_fin', { length: 5 }),
  cantidad: decimal('cantidad', { precision: 10, scale: 2 }).notNull(),
  unidad: unidadTiempoEnum('unidad').notNull().default('dias'),
  estado: estadoSolicitudEnum('estado').notNull().default('borrador'),
  fechaSolicitud: timestamp('fecha_solicitud', { withTimezone: true }).defaultNow(),
  fechaAprobacionJefe: timestamp('fecha_aprobacion_jefe', { withTimezone: true }),
  fechaAprobacionRrhh: timestamp('fecha_aprobacion_rrhh', { withTimezone: true }),
  fechaRechazo: timestamp('fecha_rechazo', { withTimezone: true }),
  aprobadoPor: bigserial('aprobado_por', { mode: 'number' }),
  aprobadoRrhhPor: bigserial('aprobado_rrhh_por', { mode: 'number' }),
  rechazadoPor: bigserial('rechazado_por', { mode: 'number' }),
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
  createdIdx: index('idx_solicitudes_created').on(table.createdAt)
}));

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
  claveIdx: index('idx_config_clave').on(table.clave)
}));

// =====================================================
// RELACIONES
// =====================================================
export const departamentosRelations = relations(departamentos, ({ one, many }) => ({
  padre: one(departamentos, {
    fields: [departamentos.departamentoPadreId],
    references: [departamentos.id]
  }),
  hijos: many(departamentos),
  usuarios: many(usuarios)
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  departamento: one(departamentos, {
    fields: [usuarios.departamentoId],
    references: [departamentos.id]
  }),
  solicitudes: many(solicitudes),
  balances: many(balancesAusencias)
}));

export const tiposAusenciaConfigRelations = relations(tiposAusenciaConfig, ({ many }) => ({
  solicitudes: many(solicitudes),
  balances: many(balancesAusencias)
}));

export const balancesAusenciasRelations = relations(balancesAusencias, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [balancesAusencias.usuarioId],
    references: [usuarios.id]
  }),
  tipoAusencia: one(tiposAusenciaConfig, {
    fields: [balancesAusencias.tipoAusenciaId],
    references: [tiposAusenciaConfig.id]
  })
}));

export const solicitudesRelations = relations(solicitudes, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [solicitudes.usuarioId],
    references: [usuarios.id]
  }),
  tipoAusencia: one(tiposAusenciaConfig, {
    fields: [solicitudes.tipoAusenciaId],
    references: [tiposAusenciaConfig.id]
  }),
  aprobador: one(usuarios, {
    fields: [solicitudes.aprobadoPor],
    references: [usuarios.id]
  }),
  aprobadorRrhh: one(usuarios, {
    fields: [solicitudes.aprobadoRrhhPor],
    references: [usuarios.id]
  }),
  rechazador: one(usuarios, {
    fields: [solicitudes.rechazadoPor],
    references: [usuarios.id]
  })
}));
