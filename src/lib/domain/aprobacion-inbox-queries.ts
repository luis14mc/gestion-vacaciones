/**
 * Consultas de bandeja de aprobación desde PostgreSQL.
 */

import { and, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { solicitudes } from '@/lib/db/schema';
import type { SessionUser } from '@/types';
import { resolverIdsEquipo } from '@/lib/domain/equipo-jefe';
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
    esDirector: session.esDirector,
    departamentoId: session.departamentoId,
  });

  const ramas: SQL[] = [];

  if (roles.esJefe || roles.esDirector) {
    if (equipoIds.length > 0) {
      ramas.push(
        and(
          eq(solicitudes.estado, 'pendiente_jefe'),
          inArray(solicitudes.usuarioId, equipoIds)
        ) as SQL
      );
    }
  }

  if (roles.esAdmin) {
    ramas.push(eq(solicitudes.estado, 'pendiente_jefe'));
  }

  if (roles.esRrhh || roles.esAdmin) {
    ramas.push(eq(solicitudes.estado, 'aprobada_jefe'));
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
  const aprobacionesRrhh = roles.esRrhh || roles.esAdmin;

  const aprobadaHoyParts: SQL[] = [];
  if (aprobacionesJefe) {
    aprobadaHoyParts.push(
      sql`(${solicitudes.aprobadaJefePor} = ${session.id} AND (${solicitudes.aprobadaJefeFecha} AT TIME ZONE 'America/Tegucigalpa')::date = ${HOY_HN})`
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
