/**
 * Consultas de bandeja de aprobación desde PostgreSQL.
 *
 * Fase 2 (corrección): cada rol ve solo el tramo del flujo que le corresponde:
 *   - Jefe:        pendiente_jefe de su equipo.
 *   - Director:    pendiente_director donde él sea el aprobador esperado.
 *   - Dir. SG:     pendiente_secretario_general donde él sea el aprobador
 *                  (Director del depto Secretaría General; no rol extra).
 *   - RRHH/Admin: pendiente_rrhh y legacy aprobada_jefe.
 */

import { and, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import type { SessionUser } from '@/types';
import { resolverIdsEquipo } from '@/lib/domain/equipo-jefe';
import { resolverAprobadorSegundoNivel } from '@/lib/domain/aprobadores';
import {
  ESTADOS_ACCIONABLES_APROBACION,
  puedeAccederBandejaAprobacion,
  type RolBandejaAprobacion,
} from '@/lib/domain/aprobacion-inbox';

function rolesDesdeSession(session: SessionUser): RolBandejaAprobacion {
  return {
    esAdmin: session.esAdmin,
    esRrhh: session.esRrhh,
    esJefe: session.esJefe,
    esDirector: session.esDirector,
    esSecretarioGeneral: session.esSecretarioGeneral,
  };
}

export async function construirCondicionesBandejaAprobacion(
  session: SessionUser
): Promise<{ where: SQL | undefined; vacio: boolean }> {
  const roles = rolesDesdeSession(session);

  if (!puedeAccederBandejaAprobacion(roles)) {
    return { where: sql`false`, vacio: true };
  }

  const base = and(isNull(solicitudes.deletedAt), ne(solicitudes.usuarioId, session.id));

  const equipoIds = await resolverIdsEquipo({
    jefeId: session.id,
    esDirector: roles.esDirector,
    departamentoId: session.departamentoId,
  });

  const ramas: SQL[] = [];

  // Jefe/Director: pendiente_jefe de su equipo directo.
  if ((roles.esJefe || roles.esDirector) && !roles.esRrhh && !roles.esAdmin) {
    if (equipoIds.length > 0) {
      ramas.push(
        and(
          eq(solicitudes.estado, 'pendiente_jefe'),
          inArray(solicitudes.usuarioId, equipoIds)
        ) as SQL
      );
    }
  }

  // Director: pendiente_director donde él es el aprobador.
  if (roles.esDirector) {
    ramas.push(
      and(
        eq(solicitudes.estado, 'pendiente_director'),
        eq(solicitudes.aprobadaDirectorPor, session.id)
      ) as SQL
    );

    // Director de Secretaría General (sustituto): solicitudes asignadas a él.
    ramas.push(
      and(
        eq(solicitudes.estado, 'pendiente_secretario_general'),
        eq(solicitudes.aprobadaSecretarioPor, session.id)
      ) as SQL
    );
  }

  // Compat legacy: flag esSecretarioGeneral (si aún existe en algún usuario).
  if (roles.esSecretarioGeneral && !roles.esDirector) {
    ramas.push(
      and(
        eq(solicitudes.estado, 'pendiente_secretario_general'),
        eq(solicitudes.aprobadaSecretarioPor, session.id)
      ) as SQL
    );
  }

  // RRHH/Admin: pendiente_rrhh y legacy aprobada_jefe.
  if (roles.esRrhh || roles.esAdmin) {
    ramas.push(eq(solicitudes.estado, 'pendiente_rrhh') as SQL);
    ramas.push(eq(solicitudes.estado, 'aprobada_jefe') as SQL);
  }

  // Admin bypass: ve todo el flujo pendiente.
  if (roles.esAdmin) {
    ramas.push(eq(solicitudes.estado, 'pendiente_jefe') as SQL);
    ramas.push(eq(solicitudes.estado, 'pendiente_director') as SQL);
    ramas.push(eq(solicitudes.estado, 'pendiente_secretario_general') as SQL);
  }

  if (ramas.length === 0) {
    return { where: and(base, sql`false`), vacio: true };
  }

  const estadoAccionable = sql`${solicitudes.estado} IN (${sql.join(
    ESTADOS_ACCIONABLES_APROBACION.map((e) => sql`${e}`),
    sql`, `
  )})`;

  return {
    where: and(base, estadoAccionable, or(...ramas)),
    vacio: false,
  };
}

const HOY_HN = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date`;

export async function calcularStatsBandejaAprobacion(session: SessionUser) {
  const roles = rolesDesdeSession(session);
  const { where: inboxWhere } = await construirCondicionesBandejaAprobacion(session);

  const [inboxStats] = await db
    .select({
      pendientes: sql<number>`count(*)::int`,
    })
    .from(solicitudes)
    .where(inboxWhere);

  const aprobacionesJefe = roles.esJefe || roles.esDirector || roles.esAdmin;
  const aprobacionesDirector = roles.esDirector || roles.esAdmin;
  // Dir. SG aprueba vía columnas de secretario (mismo Director con asignación).
  const aprobacionesSecretario =
    roles.esDirector || roles.esSecretarioGeneral || roles.esAdmin;
  const aprobacionesRrhh = roles.esRrhh || roles.esAdmin;

  const aprobadaHoyParts: SQL[] = [];
  if (aprobacionesJefe) {
    aprobadaHoyParts.push(
      sql`(${solicitudes.aprobadaJefePor} = ${session.id} AND (${solicitudes.aprobadaJefeFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN})`
    );
  }
  if (aprobacionesDirector) {
    aprobadaHoyParts.push(
      sql`(${solicitudes.aprobadaDirectorPor} = ${session.id} AND (${solicitudes.aprobadaDirectorFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN})`
    );
  }
  if (aprobacionesSecretario) {
    aprobadaHoyParts.push(
      sql`(${solicitudes.aprobadaSecretarioPor} = ${session.id} AND (${solicitudes.aprobadaSecretarioFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN})`
    );
  }
  if (aprobacionesRrhh) {
    aprobadaHoyParts.push(
      sql`(${solicitudes.aprobadaRrhhPor} = ${session.id} AND (${solicitudes.aprobadaRrhhFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN})`
    );
  }

  let aprobadas_hoy = 0;
  if (aprobadaHoyParts.length > 0) {
    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(solicitudes)
      .where(and(isNull(solicitudes.deletedAt), or(...aprobadaHoyParts)));
    aprobadas_hoy = row?.total ?? 0;
  }

  const [rechazadasRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(solicitudes)
    .where(
      and(
        isNull(solicitudes.deletedAt),
        eq(solicitudes.rechazadaPor, session.id),
        sql`(${solicitudes.rechazadaFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN}`
      )
    );

  return {
    pendientes: inboxStats?.pendientes ?? 0,
    aprobadas_hoy,
    rechazadas_hoy: rechazadasRow?.total ?? 0,
  };
}

/**
 * Resuelve el aprobador de segundo nivel esperado para una solicitud
 * de un Jefe. Empleados normales no usan este helper.
 */
export async function resolverIdsAprobadoresParaNuevaSolicitud(params: {
  esDirector: boolean;
  esJefe: boolean;
  departamentoId: number | null;
  jefeSuperiorId?: number | null;
}): Promise<{
  aprobadorDirectorId: number | null;
  aprobadorSecretarioId: number | null;
}> {
  if (params.esDirector || !params.esJefe) {
    return { aprobadorDirectorId: null, aprobadorSecretarioId: null };
  }

  try {
    const aprobador = await resolverAprobadorSegundoNivel({
      departamentoId: params.departamentoId,
      jefeSuperiorId: params.jefeSuperiorId,
    });
    if (aprobador.tipoAprobador === 'director') {
      return { aprobadorDirectorId: aprobador.usuarioId, aprobadorSecretarioId: null };
    }
    return { aprobadorDirectorId: null, aprobadorSecretarioId: aprobador.usuarioId };
  } catch {
    return { aprobadorDirectorId: null, aprobadorSecretarioId: null };
  }
}
