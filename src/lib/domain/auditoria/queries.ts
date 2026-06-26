import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { FiltrosAuditoria } from './filters';
import { extraerCampoDetalle } from './sanitize';

type SqlFragment = ReturnType<typeof sql>;

function buildCondiciones(filtros: FiltrosAuditoria, alias = 'ra'): SqlFragment[] {
  const condiciones: SqlFragment[] = [];

  if (filtros.accion) {
    condiciones.push(sql`${sql.raw(alias)}.accion = ${filtros.accion}`);
  }
  if (filtros.tabla) {
    condiciones.push(sql`${sql.raw(alias)}.tabla_afectada = ${filtros.tabla}`);
  }
  if (filtros.usuarioId) {
    condiciones.push(sql`${sql.raw(alias)}.usuario_id = ${filtros.usuarioId}`);
  }
  if (filtros.registroId) {
    condiciones.push(sql`${sql.raw(alias)}.registro_id = ${filtros.registroId}`);
  }
  if (filtros.ipAddress) {
    condiciones.push(sql`${sql.raw(alias)}.ip_address ILIKE ${'%' + filtros.ipAddress + '%'}`);
  }
  if (filtros.fechaInicio) {
    condiciones.push(
      sql`DATE(${sql.raw(alias)}.created_at AT TIME ZONE 'America/Tegucigalpa') >= ${filtros.fechaInicio}::date`
    );
  }
  if (filtros.fechaFin) {
    condiciones.push(
      sql`DATE(${sql.raw(alias)}.created_at AT TIME ZONE 'America/Tegucigalpa') <= ${filtros.fechaFin}::date`
    );
  }
  if (filtros.evento) {
    condiciones.push(sql`${sql.raw(alias)}.detalles ILIKE ${'%"evento":"' + filtros.evento + '"%'}`);
  }
  if (filtros.modulo) {
    condiciones.push(sql`${sql.raw(alias)}.detalles ILIKE ${'%"modulo":"' + filtros.modulo + '"%'}`);
  }
  if (filtros.severidad) {
    condiciones.push(sql`${sql.raw(alias)}.detalles ILIKE ${'%"severidad":"' + filtros.severidad + '"%'}`);
  }
  if (filtros.resultado) {
    condiciones.push(sql`${sql.raw(alias)}.detalles ILIKE ${'%"resultado":"' + filtros.resultado + '"%'}`);
  }
  if (filtros.email) {
    condiciones.push(sql`u.email ILIKE ${'%' + filtros.email + '%'}`);
  }
  if (filtros.q) {
    const term = `%${filtros.q}%`;
    condiciones.push(sql`(
      u.nombre ILIKE ${term}
      OR u.apellido ILIKE ${term}
      OR u.email ILIKE ${term}
      OR ${sql.raw(alias)}.accion ILIKE ${term}
      OR ${sql.raw(alias)}.tabla_afectada ILIKE ${term}
      OR COALESCE(${sql.raw(alias)}.detalles, '') ILIKE ${term}
      OR COALESCE(${sql.raw(alias)}.ip_address, '') ILIKE ${term}
      OR CAST(${sql.raw(alias)}.registro_id AS TEXT) ILIKE ${term}
    )`);
  }

  return condiciones;
}

function whereSql(condiciones: SqlFragment[]): SqlFragment {
  if (condiciones.length === 0) return sql``;
  return sql`WHERE ${sql.join(condiciones, sql` AND `)}`;
}

export interface ResumenAuditoria {
  totalRegistrosFiltrados: number;
  totalRegistrosGlobal: number;
  accionesHoy: number;
  accionesUltimas24h: number;
  usuariosUnicos: number;
  eventosCriticos: number;
  loginFallidos: number;
  cambiosConfiguracion: number;
  cambiosBalances: number;
  exportacionesReportes: number;
}

export async function calcularResumenAuditoria(
  filtros: FiltrosAuditoria
): Promise<ResumenAuditoria> {
  const condiciones = buildCondiciones(filtros);
  const whereFiltrado = whereSql(condiciones);

  const [globalRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM registros_auditoria
  `);

  const [filtradoRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM registros_auditoria ra
    INNER JOIN usuarios u ON u.id = ra.usuario_id
    ${whereFiltrado}
  `);

  const [metricasRow] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE DATE(ra.created_at AT TIME ZONE 'America/Tegucigalpa') = (NOW() AT TIME ZONE 'America/Tegucigalpa')::date
      )::int AS acciones_hoy,
      COUNT(*) FILTER (
        WHERE ra.created_at >= NOW() - INTERVAL '24 hours'
      )::int AS acciones_ultimas_24h,
      COUNT(DISTINCT ra.usuario_id)::int AS usuarios_unicos,
      COUNT(*) FILTER (
        WHERE ra.accion IN ('eliminar', 'login_fallido')
          OR ra.detalles ILIKE '%"severidad":"critico"%'
          OR ra.detalles ILIKE '%"severidad":"crítico"%'
      )::int AS eventos_criticos,
      COUNT(*) FILTER (WHERE ra.accion = 'login_fallido')::int AS login_fallidos,
      COUNT(*) FILTER (WHERE ra.tabla_afectada = 'configuracion')::int AS cambios_configuracion,
      COUNT(*) FILTER (WHERE ra.tabla_afectada = 'balances')::int AS cambios_balances,
      COUNT(*) FILTER (
        WHERE ra.tabla_afectada = 'reportes'
          OR ra.detalles ILIKE '%"evento":"exportar_reporte"%'
          OR ra.detalles ILIKE '%"evento":"exportar_auditoria"%'
      )::int AS exportaciones_reportes
    FROM registros_auditoria ra
    INNER JOIN usuarios u ON u.id = ra.usuario_id
    ${whereFiltrado}
  `);

  const m = (metricasRow ?? {}) as Record<string, unknown>;

  return {
    totalRegistrosFiltrados: Number((filtradoRow as Record<string, unknown>)?.total ?? 0),
    totalRegistrosGlobal: Number((globalRow as Record<string, unknown>)?.total ?? 0),
    accionesHoy: Number(m.acciones_hoy ?? 0),
    accionesUltimas24h: Number(m.acciones_ultimas_24h ?? 0),
    usuariosUnicos: Number(m.usuarios_unicos ?? 0),
    eventosCriticos: Number(m.eventos_criticos ?? 0),
    loginFallidos: Number(m.login_fallidos ?? 0),
    cambiosConfiguracion: Number(m.cambios_configuracion ?? 0),
    cambiosBalances: Number(m.cambios_balances ?? 0),
    exportacionesReportes: Number(m.exportaciones_reportes ?? 0),
  };
}

export async function listarRegistrosAuditoria(filtros: FiltrosAuditoria) {
  const condiciones = buildCondiciones(filtros);
  const whereFiltrado = whereSql(condiciones);
  const offset = (filtros.pagina - 1) * filtros.limite;

  const rows = await db.execute(sql`
    SELECT
      ra.id,
      ra.usuario_id,
      ra.accion,
      ra.tabla_afectada,
      ra.registro_id,
      ra.detalles,
      ra.ip_address,
      ra.user_agent,
      ra.created_at AS fecha_creacion,
      u.id AS usuario_id_join,
      u.nombre,
      u.apellido,
      u.email
    FROM registros_auditoria ra
    INNER JOIN usuarios u ON u.id = ra.usuario_id
    ${whereFiltrado}
    ORDER BY ra.created_at DESC
    LIMIT ${filtros.limite}
    OFFSET ${offset}
  `);

  const data = [...rows].map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      usuario_id: r.usuario_id,
      accion: r.accion,
      tabla_afectada: r.tabla_afectada,
      registro_id: r.registro_id,
      detalles: r.detalles,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      fecha_creacion: r.fecha_creacion,
      evento: extraerCampoDetalle(String(r.detalles ?? ''), 'evento'),
      modulo: extraerCampoDetalle(String(r.detalles ?? ''), 'modulo'),
      severidad: extraerCampoDetalle(String(r.detalles ?? ''), 'severidad'),
      resultado: extraerCampoDetalle(String(r.detalles ?? ''), 'resultado'),
      entidad_nombre: extraerCampoDetalle(String(r.detalles ?? ''), 'entidadNombre'),
      usuario: {
        id: r.usuario_id_join,
        nombre: r.nombre,
        apellido: r.apellido,
        email: r.email,
      },
    };
  });

  const resumen = await calcularResumenAuditoria(filtros);
  const total = resumen.totalRegistrosFiltrados;

  return {
    data,
    total,
    paginaActual: filtros.pagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.limite)),
    limite: filtros.limite,
    resumen,
  };
}

export async function exportarRegistrosAuditoria(filtros: FiltrosAuditoria) {
  const exportFiltros = { ...filtros, pagina: 1, limite: 10000 };
  const condiciones = buildCondiciones(exportFiltros);
  const whereFiltrado = whereSql(condiciones);

  const rows = await db.execute(sql`
    SELECT
      ra.created_at AS fecha_creacion,
      CONCAT(u.nombre, ' ', u.apellido) AS usuario,
      u.email,
      ra.accion,
      ra.tabla_afectada,
      ra.registro_id,
      ra.detalles,
      ra.ip_address,
      ra.user_agent
    FROM registros_auditoria ra
    INNER JOIN usuarios u ON u.id = ra.usuario_id
    ${whereFiltrado}
    ORDER BY ra.created_at DESC
    LIMIT 10000
  `);

  return [...rows].map((row) => {
    const r = row as Record<string, unknown>;
    const detalles = String(r.detalles ?? '');
    return {
      fecha: r.fecha_creacion,
      usuario: r.usuario,
      email: r.email,
      accion: r.accion,
      modulo: extraerCampoDetalle(detalles, 'modulo'),
      evento: extraerCampoDetalle(detalles, 'evento'),
      tabla: r.tabla_afectada,
      registro_id: r.registro_id,
      entidad: extraerCampoDetalle(detalles, 'entidadNombre'),
      resultado: extraerCampoDetalle(detalles, 'resultado'),
      severidad: extraerCampoDetalle(detalles, 'severidad'),
      ip: r.ip_address,
      user_agent: r.user_agent,
      detalles_resumidos: detalles.length > 500 ? `${detalles.slice(0, 500)}…` : detalles,
    };
  });
}
