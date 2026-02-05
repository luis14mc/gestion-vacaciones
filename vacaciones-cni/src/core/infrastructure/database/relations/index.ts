/**
 * @file relations/index.ts
 * @description Relaciones Drizzle ORM entre todas las tablas
 * @module Relations
 * @version 3.0
 * @date 5 febrero 2026
 */

import { relations } from 'drizzle-orm';
import { roles, permisos, rolesPermisos, usuariosRoles } from '../schemas/auth-rbac.schema';
import { departamentos, usuarios } from '../schemas/estructura-org.schema';
import { tiposAusenciaConfig, balancesAusencias } from '../schemas/ausencias.schema';
import { solicitudes } from '../schemas/solicitudes.schema';

// =====================================================
// RELACIONES: RBAC
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

// =====================================================
// RELACIONES: ESTRUCTURA ORGANIZACIONAL
// =====================================================
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

// =====================================================
// RELACIONES: AUSENCIAS Y BALANCES
// =====================================================
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

// =====================================================
// RELACIONES: SOLICITUDES
// =====================================================
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
