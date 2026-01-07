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
  time,
  timestamp, 
  jsonb, 
  pgEnum, 
  uniqueIndex, 
  index,
  check
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
// TABLA: roles (NUEVO SISTEMA RBAC)
// =====================================================
export const roles = pgTable('roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  nivel: integer('nivel').notNull().default(0), // 0=empleado, 1=jefe, 2=rrhh, 3=admin
  activo: boolean('activo').notNull().default(true),
  esRolSistema: boolean('es_rol_sistema').notNull().default(false),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  codigoIdx: index('idx_roles_codigo').on(table.codigo),
  nivelIdx: index('idx_roles_nivel').on(table.nivel)
}));

// =====================================================
// TABLA: permisos (NUEVO SISTEMA RBAC)
// =====================================================
export const permisos = pgTable('permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  codigo: varchar('codigo', { length: 100 }).notNull().unique(),
  modulo: varchar('modulo', { length: 50 }).notNull(),
  accion: varchar('accion', { length: 50 }).notNull(),
  descripcion: text('descripcion'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  moduloAccionIdx: index('idx_permisos_modulo_accion').on(table.modulo, table.accion),
  codigoIdx: index('idx_permisos_codigo').on(table.codigo)
}));

// =====================================================
// TABLA: roles_permisos (N:M)
// =====================================================
export const rolesPermisos = pgTable('roles_permisos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  permisoId: bigint('permiso_id', { mode: 'number' }).notNull()
    .references(() => permisos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueRolPermiso: uniqueIndex('uq_rol_permiso').on(table.rolId, table.permisoId),
  rolIdx: index('idx_roles_permisos_rol').on(table.rolId),
  permisoIdx: index('idx_roles_permisos_permiso').on(table.permisoId)
}));

// =====================================================
// TABLA: departamentos
// =====================================================
export const departamentos = pgTable('departamentos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  codigo: varchar('codigo', { length: 20 }).notNull().unique(),
  descripcion: text('descripcion'),
  departamentoPadreId: bigint('departamento_padre_id', { mode: 'number' })
    .references((): any => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
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
  departamentoId: bigint('departamento_id', { mode: 'number' }).notNull()
    .references(() => departamentos.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  cargo: varchar('cargo', { length: 100 }),
  // ⚠️ DEPRECADO - Mantener temporalmente para compatibilidad, eliminar en siguiente fase
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
  activoIdx: index('idx_usuarios_activo').on(table.activo),
  deptoActivoIdx: index('idx_usuarios_depto_activo').on(table.departamentoId, table.activo)
}));

// =====================================================
// TABLA: usuarios_roles (N:M - NUEVO SISTEMA RBAC)
// =====================================================
export const usuariosRoles = pgTable('usuarios_roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' }).notNull()
    .references(() => usuarios.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  rolId: bigint('rol_id', { mode: 'number' }).notNull()
    .references(() => roles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  departamentoId: bigint('departamento_id', { mode: 'number' })
    .references(() => departamentos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true }).defaultNow(),
  fechaExpiracion: timestamp('fecha_expiracion', { withTimezone: true }),
  activo: boolean('activo').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqueUsuarioRolDepto: uniqueIndex('uq_usuario_rol_depto').on(
    table.usuarioId, 
    table.rolId, 
    table.departamentoId
  ),
  usuarioIdx: index('idx_usuarios_roles_usuario').on(table.usuarioId),
  rolIdx: index('idx_usuarios_roles_rol').on(table.rolId),
  usuarioActivoIdx: index('idx_usuarios_roles_usuario_activo').on(table.usuarioId, table.activo)
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
// TABLA: solicitudes (particionada por created_at)
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
  unidad: unidadTiempoEnum('unidad').notNull().default('dias'),
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
// RELACIONES
// =====================================================
export const rolesRelations = relations(roles, ({ many }) => ({
  usuariosRoles: many(usuariosRoles),
  rolesPermisos: many(rolesPermisos)
}));

export const permisosRelations = relations(permisos, ({ many }) => ({
  rolesPermisos: many(rolesPermisos)
}));

export const rolesPermisosRelations = relations(rolesPermisos, ({ one }) => ({
  rol: one(roles, {
    fields: [rolesPermisos.rolId],
    references: [roles.id]
  }),
  permiso: one(permisos, {
    fields: [rolesPermisos.permisoId],
    references: [permisos.id]
  })
}));

export const departamentosRelations = relations(departamentos, ({ one, many }) => ({
  padre: one(departamentos, {
    fields: [departamentos.departamentoPadreId],
    references: [departamentos.id],
    relationName: 'departamento_padre'
  }),
  hijos: many(departamentos, { relationName: 'departamento_padre' }),
  usuarios: many(usuarios),
  usuariosRoles: many(usuariosRoles)
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  departamento: one(departamentos, {
    fields: [usuarios.departamentoId],
    references: [departamentos.id]
  }),
  solicitudes: many(solicitudes),
  balances: many(balancesAusencias),
  usuariosRoles: many(usuariosRoles),
  solicitudesAprobadas: many(solicitudes, { relationName: 'aprobador' }),
  solicitudesAprobadasRrhh: many(solicitudes, { relationName: 'aprobador_rrhh' }),
  solicitudesRechazadas: many(solicitudes, { relationName: 'rechazador' })
}));

export const usuariosRolesRelations = relations(usuariosRoles, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [usuariosRoles.usuarioId],
    references: [usuarios.id]
  }),
  rol: one(roles, {
    fields: [usuariosRoles.rolId],
    references: [roles.id]
  }),
  departamento: one(departamentos, {
    fields: [usuariosRoles.departamentoId],
    references: [departamentos.id]
  })
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
    references: [usuarios.id],
    relationName: 'aprobador'
  }),
  aprobadorRrhh: one(usuarios, {
    fields: [solicitudes.aprobadoRrhhPor],
    references: [usuarios.id],
    relationName: 'aprobador_rrhh'
  }),
  rechazador: one(usuarios, {
    fields: [solicitudes.rechazadoPor],
    references: [usuarios.id],
    relationName: 'rechazador'
  })
}));

// =====================================================
// TIPOS PARA TYPESCRIPT
// =====================================================
export type Usuario = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type Rol = typeof roles.$inferSelect;
export type Permiso = typeof permisos.$inferSelect;
export type Departamento = typeof departamentos.$inferSelect;
export type TipoAusenciaConfig = typeof tiposAusenciaConfig.$inferSelect;
export type BalanceAusencia = typeof balancesAusencias.$inferSelect;
export type Solicitud = typeof solicitudes.$inferSelect;
export type ConfiguracionSistema = typeof configuracionSistema.$inferSelect;
export type AuditoriaRegistro = typeof auditoria.$inferSelect;
