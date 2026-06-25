/**
 * ============================================================
 * SCHEMA: SOLICITUDES (CORE)
 * ============================================================
 * @module solicitudes
 * @description Solicitudes de ausencias y vacaciones - Formulario CNI
 * @author Database Architect Senior
 * @version 5.0 - Arquitectura Limpia CNI
 * ============================================================
 * 
 * BASADO EN: Formulario físico CNI y PDF vacaciones_cni Schema.pdf
 * 
 * TIPOS DE SOLICITUD:
 * 1. VACACIONES: Ausencia por periodo (fecha inicio/fin, días)
 * 2. PERMISO SALIDA: Permiso temporal (1-2h o 2-4h con hora salida/regreso)
 * 
 * FLUJO DE FIRMAS:
 * 1. Empleado crea solicitud
 * 2. Jefe de departamento aprueba/rechaza (aprobada_jefe_por)
 * 3. RRHH aprueba/rechaza (aprobada_rrhh_por) [APROBADOR FINAL]
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
  time,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { usuarios } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const tipoSolicitudEnum = pgEnum('tipo_solicitud', [
  'vacaciones',            // Periodo completo con días
  'permiso_salida',        // Permiso temporal (1-2h, 2-4h)
  'licencia_medica',       // Con justificante médico
  'permiso_personal',      // Personal sin goce
  'licencia_paternidad',   // Paternidad/maternidad
  'compensacion',          // Horas extras compensadas
  'dia_cumpleanos',        // 1 día libre en el mes de cumpleaños
]);

export const duracionPermisoEnum = pgEnum('duracion_permiso', [
  '1-2h',                  // 1 a 2 horas
  '2-4h',                  // 2 a 4 horas
  'dia_completo',          // Día completo
]);

export const estadoSolicitudEnum = pgEnum('estado_solicitud', [
  'borrador',              // Creada, no enviada
  'pendiente_jefe',        // Esperando aprobación del jefe
  'aprobada_jefe',         // Jefe aprobó, pendiente RRHH
  'rechazada_jefe',        // Jefe rechazó
  'pendiente_rrhh',        // Esperando aprobación RRHH
  'aprobada_rrhh',         // RRHH aprobó (final)
  'rechazada_rrhh',        // RRHH rechazó
  'cancelada',             // Cancelada por el empleado
  'finalizada',            // Completada y archivada
]);

// ============================================================
// TABLA: anos_laborales
// ============================================================
export const anosLaborales = pgTable(
  'anos_laborales',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ano: integer('ano').notNull(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaFin: date('fecha_fin', { mode: 'string' }).notNull(),
    activo: boolean('activo').notNull().default(false),
    cerrado: boolean('cerrado').notNull().default(false),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uqAno: unique('uq_anos_laborales_ano').on(table.ano),
    idxAno: index('idx_anos_laborales_ano').on(table.ano),
    idxActivo: index('idx_anos_laborales_activo').on(table.activo),
    chkFechaFin: check(
      'chk_anos_laborales_fecha_fin',
      sql`${table.fechaFin} > ${table.fechaInicio}`
    ),
  })
);

// ============================================================
// TABLA: solicitudes (CORE - Formulario CNI)
// ============================================================
export const solicitudes = pgTable(
  'solicitudes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    
    // Código único CNI-SOL-YYYY-XXXX (generado en solicitudes.service.ts)
    codigo: varchar('codigo', { length: 50 }).notNull(),
    
    // Referencias
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    anoLaboralId: bigint('ano_laboral_id', { mode: 'number' })
      .notNull()
      .references(() => anosLaborales.id, { onDelete: 'restrict' }),
    
    // Tipo de solicitud
    tipo: tipoSolicitudEnum('tipo').notNull(),
    
    // ========================================
    // CAMPOS PARA VACACIONES
    // ========================================
    fechaInicio: date('fecha_inicio', { mode: 'string' }),
    fechaFin: date('fecha_fin', { mode: 'string' }),
    diasSolicitados: decimal('dias_solicitados', { precision: 10, scale: 2 }),
    
    // ========================================
    // CAMPOS PARA PERMISOS DE SALIDA (CNI)
    // ========================================
    duracionPermiso: duracionPermisoEnum('duracion_permiso'),  // 1-2h, 2-4h
    horaSalida: time('hora_salida', { withTimezone: false }),  // Ej: 14:00
    horaRegreso: time('hora_regreso', { withTimezone: false }),// Ej: 16:00
    
    // Detalles
    motivo: text('motivo'),
    comentarioEmpleado: text('comentario_empleado'),
    documentosAdjuntos: jsonb('documentos_adjuntos').default([]).notNull(),
    
    // ========================================
    // FLUJO DE APROBACIONES (2 FIRMAS)
    // ========================================
    
    // Estado actual
    estado: estadoSolicitudEnum('estado').notNull().default('borrador'),
    estadoAnterior: estadoSolicitudEnum('estado_anterior'),
    
    // FIRMA 1: Jefe de Departamento
    aprobadaJefePor: bigint('aprobada_jefe_por', { mode: 'number' })
      .references(() => usuarios.id),
    aprobadaJefeFecha: timestamp('aprobada_jefe_fecha', { withTimezone: true, mode: 'string' }),
    comentarioJefe: text('comentario_jefe'),
    
    // FIRMA 2: RRHH
    aprobadaRrhhPor: bigint('aprobada_rrhh_por', { mode: 'number' })
      .references(() => usuarios.id),
    aprobadaRrhhFecha: timestamp('aprobada_rrhh_fecha', { withTimezone: true, mode: 'string' }),
    comentarioRrhh: text('comentario_rrhh'),
    
    // Rechazo (cualquier nivel)
    rechazadaPor: bigint('rechazada_por', { mode: 'number' })
      .references(() => usuarios.id),
    rechazadaFecha: timestamp('rechazada_fecha', { withTimezone: true, mode: 'string' }),
    motivoRechazo: text('motivo_rechazo'),
    
    // Control de versiones (optimistic locking)
    version: integer('version').notNull().default(1),
    
    // Metadata y auditoría
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    uqCodigo: unique('uq_solicitudes_codigo').on(table.codigo),
    idxCodigo: index('idx_solicitudes_codigo').on(table.codigo),
    idxUsuario: index('idx_solicitudes_usuario').on(table.usuarioId, table.estado),
    idxEstado: index('idx_solicitudes_estado').on(table.estado),
    idxTipo: index('idx_solicitudes_tipo').on(table.tipo),
    idxAno: index('idx_solicitudes_ano').on(table.anoLaboralId),
    idxFechas: index('idx_solicitudes_fechas').on(table.fechaInicio, table.fechaFin),
    idxHoras: index('idx_solicitudes_horas').on(table.horaSalida, table.horaRegreso),
    idxVersion: index('idx_solicitudes_version').on(table.id, table.version),
    
    // Check: Si tipo=vacaciones, debe tener fechas
    chkVacacionesFechas: check(
      'chk_solicitudes_vacaciones_fechas',
      sql`(${table.tipo} != 'vacaciones') OR (${table.fechaInicio} IS NOT NULL AND ${table.fechaFin} IS NOT NULL)`
    ),
    
    // Check: Si tipo=permiso_salida, debe tener horas
    chkPermisoHoras: check(
      'chk_solicitudes_permiso_horas',
      sql`(${table.tipo} != 'permiso_salida') OR (${table.horaSalida} IS NOT NULL AND ${table.horaRegreso} IS NOT NULL)`
    ),
    
    // Check: Fecha fin >= fecha inicio
    chkFechaFin: check(
      'chk_solicitudes_fecha_fin',
      sql`${table.fechaFin} IS NULL OR ${table.fechaFin} >= ${table.fechaInicio}`
    ),
  })
);

// ============================================================
// RELACIONES
// ============================================================
export const anosLaboralesRelations = relations(anosLaborales, ({ many }) => ({
  solicitudes: many(solicitudes),
}));

export const solicitudesRelations = relations(solicitudes, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [solicitudes.usuarioId],
    references: [usuarios.id],
    relationName: 'solicitudes_usuario',
  }),
  anoLaboral: one(anosLaborales, {
    fields: [solicitudes.anoLaboralId],
    references: [anosLaborales.id],
  }),
  aprobadorJefe: one(usuarios, {
    fields: [solicitudes.aprobadaJefePor],
    references: [usuarios.id],
    relationName: 'solicitudes_aprobador_jefe',
  }),
  aprobadorRrhh: one(usuarios, {
    fields: [solicitudes.aprobadaRrhhPor],
    references: [usuarios.id],
    relationName: 'solicitudes_aprobador_rrhh',
  }),
  rechazadoPor: one(usuarios, {
    fields: [solicitudes.rechazadaPor],
    references: [usuarios.id],
    relationName: 'solicitudes_rechazador',
  }),
}));
