import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { FiltrosReporte } from './filters';
import type { ReportScope } from './scope';

type SqlFragment = ReturnType<typeof sql>;

function sqlFiltroUsuarios(scope: ReportScope, alias = 'u'): SqlFragment {
  if (scope.vacio) return sql`AND 1 = 0`;
  const parts: SqlFragment[] = [];
  if (scope.usuarioIds !== null) {
    if (scope.usuarioIds.length === 0) return sql`AND 1 = 0`;
    parts.push(
      sql`${sql.raw(alias)}.id IN (${sql.join(
        scope.usuarioIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  }
  if (scope.departamentoId !== null) {
    parts.push(sql`${sql.raw(alias)}.departamento_id = ${scope.departamentoId}`);
  }
  if (parts.length === 0) return sql``;
  return sql`AND ${sql.join(parts, sql` AND `)}`;
}

function sqlAnoLaboral(filtros: FiltrosReporte, column: string): SqlFragment {
  if (filtros.anoLaboralId) {
    return sql`AND ${sql.raw(column)} = ${filtros.anoLaboralId}`;
  }
  return sql`AND ${sql.raw(column)} = (SELECT id FROM anos_laborales WHERE ano = ${filtros.anio} LIMIT 1)`;
}

function sqlFiltroSolicitudes(filtros: FiltrosReporte): SqlFragment {
  const parts: SqlFragment[] = [];
  if (filtros.tipoSolicitud) {
    parts.push(sql`s.tipo = ${filtros.tipoSolicitud}`);
  }
  if (filtros.estado) {
    parts.push(sql`s.estado = ${filtros.estado}`);
  }
  if (parts.length === 0) return sql``;
  return sql`AND ${sql.join(parts, sql` AND `)}`;
}

function sqlRangoSolicitudes(filtros: FiltrosReporte): SqlFragment {
  return sql`
    AND (
      (
        s.fecha_inicio IS NOT NULL
        AND s.fecha_fin IS NOT NULL
        AND s.fecha_inicio <= ${filtros.fechaFin}::date
        AND s.fecha_fin >= ${filtros.fechaInicio}::date
      )
      OR (
        s.fecha_inicio IS NOT NULL
        AND s.fecha_inicio >= ${filtros.fechaInicio}::date
        AND s.fecha_inicio <= ${filtros.fechaFin}::date
        AND (s.fecha_fin IS NULL OR s.tipo = 'permiso_salida')
      )
    )
  `;
}

export async function generarReporteBalances(filtros: FiltrosReporte, scope: ReportScope) {
  const result = await db.execute(sql`
    SELECT
      u.id AS usuario_id,
      CONCAT(u.nombre, ' ', u.apellido) AS colaborador,
      u.email,
      d.nombre AS departamento,
      TO_CHAR(u.fecha_ingreso AT TIME ZONE 'America/Tegucigalpa', 'DD/MM/YYYY') AS fecha_ingreso,
      al.ano AS ano_laboral,
      COALESCE(b.cantidad_inicial, '0') AS dias_vencidos,
      COALESCE(b.cantidad_acumulada, '0') AS dias_proporcionales,
      COALESCE(b.cantidad_usada, '0') AS dias_usados,
      COALESCE(b.cantidad_pendiente, '0') AS dias_pendientes,
      COALESCE(b.cantidad_disponible, '0') AS dias_disponibles,
      b.updated_at AS ultima_actualizacion
    FROM usuarios u
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN balances b ON b.usuario_id = u.id
      AND b.tipo_ausencia = 'vacaciones'
      ${sqlAnoLaboral(filtros, 'b.ano_laboral_id')}
    LEFT JOIN anos_laborales al ON al.id = b.ano_laboral_id
    WHERE u.activo = true
      AND u.deleted_at IS NULL
      ${sqlFiltroUsuarios(scope)}
    ORDER BY d.nombre NULLS LAST, u.apellido, u.nombre
  `);

  const filas = [...result];
  return {
    filas,
    resumen: {
      totalRegistros: filas.length,
      totalVencidos: sumField(filas, 'dias_vencidos'),
      totalProporcionales: sumField(filas, 'dias_proporcionales'),
      totalUsados: sumField(filas, 'dias_usados'),
      totalPendientes: sumField(filas, 'dias_pendientes'),
      totalDisponibles: sumField(filas, 'dias_disponibles'),
    },
  };
}

export async function generarReporteSolicitudes(filtros: FiltrosReporte, scope: ReportScope) {
  const result = await db.execute(sql`
    SELECT
      s.codigo,
      CONCAT(u.nombre, ' ', u.apellido) AS colaborador,
      u.email,
      d.nombre AS departamento,
      s.tipo AS tipo_solicitud,
      s.fecha_inicio,
      s.fecha_fin,
      s.dias_solicitados,
      s.duracion_permiso,
      s.estado,
      CONCAT(j.nombre, ' ', j.apellido) AS jefe_aprobador,
      s.aprobada_jefe_fecha,
      CONCAT(r.nombre, ' ', r.apellido) AS rrhh_aprobador,
      s.aprobada_rrhh_fecha,
      s.motivo,
      s.comentario_empleado AS observaciones,
      s.created_at AS fecha_creacion,
      al.ano AS ano_laboral
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN usuarios j ON j.id = s.aprobada_jefe_por
    LEFT JOIN usuarios r ON r.id = s.aprobada_rrhh_por
    LEFT JOIN anos_laborales al ON al.id = s.ano_laboral_id
    WHERE s.deleted_at IS NULL
      ${sqlRangoSolicitudes(filtros)}
      ${sqlAnoLaboral(filtros, 's.ano_laboral_id')}
      ${sqlFiltroSolicitudes(filtros)}
      ${sqlFiltroUsuarios(scope)}
    ORDER BY s.fecha_inicio DESC NULLS LAST, s.created_at DESC
  `);

  const filas = [...result];
  return {
    filas,
    resumen: { totalRegistros: filas.length },
  };
}

export async function generarReporteDepartamentos(filtros: FiltrosReporte, scope: ReportScope) {
  const hoy = new Date().toISOString().slice(0, 10);
  const result = await db.execute(sql`
    SELECT
      d.nombre AS departamento,
      d.codigo,
      COUNT(DISTINCT u.id) FILTER (WHERE u.activo = true AND u.deleted_at IS NULL) AS total_colaboradores,
      COALESCE(SUM(b.cantidad_inicial::numeric), 0) AS total_vencidos,
      COALESCE(SUM(b.cantidad_acumulada::numeric), 0) AS total_proporcionales,
      COALESCE(SUM(b.cantidad_usada::numeric), 0) AS total_usados,
      COALESCE(SUM(b.cantidad_pendiente::numeric), 0) AS total_pendientes,
      COALESCE(SUM(b.cantidad_disponible::numeric), 0) AS total_disponibles,
      COALESCE((
        SELECT COUNT(*)::int FROM solicitudes s2
        INNER JOIN usuarios u2 ON u2.id = s2.usuario_id
        WHERE u2.departamento_id = d.id
          AND s2.deleted_at IS NULL
          AND s2.estado IN ('pendiente_jefe', 'aprobada_jefe', 'pendiente_rrhh')
      ), 0) AS solicitudes_pendientes,
      COALESCE((
        SELECT COUNT(*)::int FROM solicitudes s2
        INNER JOIN usuarios u2 ON u2.id = s2.usuario_id
        WHERE u2.departamento_id = d.id
          AND s2.deleted_at IS NULL
          AND s2.estado IN ('aprobada_rrhh', 'finalizada')
          ${sqlAnoLaboral(filtros, 's2.ano_laboral_id')}
      ), 0) AS solicitudes_aprobadas,
      COALESCE((
        SELECT COUNT(*)::int FROM solicitudes s2
        INNER JOIN usuarios u2 ON u2.id = s2.usuario_id
        WHERE u2.departamento_id = d.id
          AND s2.deleted_at IS NULL
          AND s2.estado IN ('rechazada_jefe', 'rechazada_rrhh')
          ${sqlAnoLaboral(filtros, 's2.ano_laboral_id')}
      ), 0) AS solicitudes_rechazadas,
      COALESCE((
        SELECT COUNT(DISTINCT s2.usuario_id)::int FROM solicitudes s2
        INNER JOIN usuarios u2 ON u2.id = s2.usuario_id
        WHERE u2.departamento_id = d.id
          AND s2.deleted_at IS NULL
          AND s2.estado IN ('aprobada_rrhh', 'finalizada')
          AND s2.fecha_inicio <= ${hoy}::date
          AND s2.fecha_fin >= ${hoy}::date
      ), 0) AS personas_en_vacaciones,
      CASE
        WHEN COALESCE(SUM(b.cantidad_inicial::numeric), 0) + COALESCE(SUM(b.cantidad_acumulada::numeric), 0) > 0
        THEN ROUND(
          (COALESCE(SUM(b.cantidad_usada::numeric), 0) /
            NULLIF(COALESCE(SUM(b.cantidad_inicial::numeric), 0) + COALESCE(SUM(b.cantidad_acumulada::numeric), 0), 0)
          ) * 100, 2
        )
        ELSE 0
      END AS porcentaje_uso
    FROM departamentos d
    LEFT JOIN usuarios u ON u.departamento_id = d.id AND u.deleted_at IS NULL
    LEFT JOIN balances b ON b.usuario_id = u.id
      AND b.tipo_ausencia = 'vacaciones'
      ${sqlAnoLaboral(filtros, 'b.ano_laboral_id')}
    WHERE d.activo = true
      AND d.deleted_at IS NULL
      ${scope.departamentoId ? sql`AND d.id = ${scope.departamentoId}` : sql``}
      ${scope.usuarioIds !== null ? sql`AND u.id IN (${sql.join(scope.usuarioIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
    GROUP BY d.id, d.nombre, d.codigo
    HAVING COUNT(DISTINCT u.id) FILTER (WHERE u.activo = true AND u.deleted_at IS NULL) > 0
       OR ${scope.departamentoId !== null}
    ORDER BY d.nombre
  `);

  const filas = [...result];
  return {
    filas,
    resumen: {
      totalRegistros: filas.length,
      totalColaboradores: sumField(filas, 'total_colaboradores'),
      totalUsados: sumField(filas, 'total_usados'),
      promedioUso:
        filas.length > 0
          ? Number(
              (
                filas.reduce((acc, row: Record<string, unknown>) => acc + Number(row.porcentaje_uso || 0), 0) /
                filas.length
              ).toFixed(2)
            )
          : 0,
    },
  };
}

export async function generarReporteAusentismo(filtros: FiltrosReporte, scope: ReportScope) {
  const resumenRows = await db.execute(sql`
    SELECT
      COUNT(*) AS total_solicitudes,
      COALESCE(SUM(s.dias_solicitados::numeric), 0) AS total_dias,
      ROUND(COALESCE(AVG(s.dias_solicitados::numeric), 0), 2) AS promedio_dias,
      COUNT(DISTINCT s.usuario_id) AS colaboradores_distintos
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.deleted_at IS NULL
      AND s.estado IN ('aprobada_rrhh', 'finalizada')
      ${sqlRangoSolicitudes(filtros)}
      ${sqlFiltroUsuarios(scope, 'u')}
  `);

  const tendencia = await db.execute(sql`
    SELECT
      TO_CHAR(s.fecha_inicio::date, 'YYYY-MM') AS mes,
      COALESCE(d.nombre, 'Sin departamento') AS departamento,
      COUNT(*) AS total_solicitudes,
      COALESCE(SUM(s.dias_solicitados::numeric), 0) AS total_dias,
      ROUND(COALESCE(AVG(s.dias_solicitados::numeric), 0), 2) AS promedio_dias,
      COUNT(DISTINCT s.usuario_id) AS colaboradores_distintos,
      (
        SELECT s2.tipo
        FROM solicitudes s2
        INNER JOIN usuarios u2 ON u2.id = s2.usuario_id
        LEFT JOIN departamentos d2 ON d2.id = u2.departamento_id
        WHERE s2.deleted_at IS NULL
          AND s2.estado IN ('aprobada_rrhh', 'finalizada')
          AND TO_CHAR(s2.fecha_inicio::date, 'YYYY-MM') = TO_CHAR(s.fecha_inicio::date, 'YYYY-MM')
          AND COALESCE(d2.nombre, 'Sin departamento') = COALESCE(d.nombre, 'Sin departamento')
          ${sqlFiltroUsuarios(scope, 'u2')}
        GROUP BY s2.tipo
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS tipo_mas_usado
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    WHERE s.deleted_at IS NULL
      AND s.estado IN ('aprobada_rrhh', 'finalizada')
      ${sqlRangoSolicitudes(filtros)}
      ${sqlFiltroUsuarios(scope, 'u')}
    GROUP BY TO_CHAR(s.fecha_inicio::date, 'YYYY-MM'), d.id, d.nombre
    ORDER BY mes, departamento
  `);

  const resumen = ([...resumenRows][0] ?? {}) as Record<string, unknown>;
  const filas = [...tendencia];

  return {
    resumen,
    filas,
    totalRegistros: filas.length,
  };
}

export async function generarReporteCumpleanos(filtros: FiltrosReporte, scope: ReportScope) {
  const result = await db.execute(sql`
    SELECT
      CONCAT(u.nombre, ' ', u.apellido) AS colaborador,
      u.email,
      COALESCE(dep.nombre, 'Sin departamento') AS departamento,
      u.fecha_nacimiento,
      EXTRACT(MONTH FROM u.fecha_nacimiento::date)::int AS mes_cumpleanos,
      s.fecha_inicio AS fecha_solicitada,
      s.estado,
      al.ano,
      CASE
        WHEN s.estado IN ('aprobada_rrhh', 'finalizada') THEN true
        ELSE false
      END AS beneficio_usado,
      CONCAT(j.nombre, ' ', j.apellido) AS jefe_aprobador,
      CONCAT(r.nombre, ' ', r.apellido) AS rrhh_aprobador,
      s.codigo
    FROM usuarios u
    LEFT JOIN departamentos dep ON dep.id = u.departamento_id
    LEFT JOIN solicitudes s ON s.usuario_id = u.id
      AND s.tipo = 'dia_cumpleanos'
      AND s.deleted_at IS NULL
      ${filtros.anoLaboralId
        ? sql`AND s.ano_laboral_id = ${filtros.anoLaboralId}`
        : sql`AND s.ano_laboral_id = (SELECT id FROM anos_laborales WHERE ano = ${filtros.anio} LIMIT 1)`}
    LEFT JOIN anos_laborales al ON al.id = s.ano_laboral_id
    LEFT JOIN usuarios j ON j.id = s.aprobada_jefe_por
    LEFT JOIN usuarios r ON r.id = s.aprobada_rrhh_por
    WHERE u.activo = true
      AND u.deleted_at IS NULL
      AND u.fecha_nacimiento IS NOT NULL
      ${sqlFiltroUsuarios(scope)}
    ORDER BY mes_cumpleanos, u.apellido, u.nombre
  `);

  const filas = [...result];
  return { filas, resumen: { totalRegistros: filas.length } };
}

export async function generarReportePermisosSalida(filtros: FiltrosReporte, scope: ReportScope) {
  const result = await db.execute(sql`
    SELECT
      CONCAT(u.nombre, ' ', u.apellido) AS colaborador,
      u.email,
      COALESCE(d.nombre, 'Sin departamento') AS departamento,
      s.fecha_inicio AS fecha,
      s.hora_salida,
      s.hora_regreso,
      s.duracion_permiso,
      s.estado,
      s.motivo,
      CONCAT(j.nombre, ' ', j.apellido) AS jefe_aprobador,
      CONCAT(r.nombre, ' ', r.apellido) AS rrhh_aprobador
    FROM solicitudes s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN usuarios j ON j.id = s.aprobada_jefe_por
    LEFT JOIN usuarios r ON r.id = s.aprobada_rrhh_por
    WHERE s.deleted_at IS NULL
      AND s.tipo = 'permiso_salida'
      ${sqlRangoSolicitudes(filtros)}
      ${sqlFiltroSolicitudes(filtros)}
      ${sqlFiltroUsuarios(scope)}
    ORDER BY s.fecha_inicio DESC, s.hora_salida DESC NULLS LAST
  `);

  const filas = [...result];
  return { filas, resumen: { totalRegistros: filas.length } };
}

export async function generarReporteCierreAno(filtros: FiltrosReporte, scope: ReportScope) {
  const result = await db.execute(sql`
    SELECT
      CONCAT(u.nombre, ' ', u.apellido) AS colaborador,
      al.ano AS ano_laboral,
      COALESCE(b.cantidad_inicial, '0') AS dias_vencidos,
      COALESCE(b.cantidad_acumulada, '0') AS dias_proporcionales,
      COALESCE(b.cantidad_disponible, '0') AS dias_disponibles,
      al.fecha_fin AS fecha_fin_ano_laboral,
      GREATEST(0, (al.fecha_fin::date - CURRENT_DATE)) AS dias_restantes_cierre,
      CASE
        WHEN (al.fecha_fin::date - CURRENT_DATE) <= 30 THEN 'alto'
        WHEN (al.fecha_fin::date - CURRENT_DATE) <= 90 THEN 'medio'
        ELSE 'bajo'
      END AS riesgo
    FROM usuarios u
    INNER JOIN balances b ON b.usuario_id = u.id AND b.tipo_ausencia = 'vacaciones'
    INNER JOIN anos_laborales al ON al.id = b.ano_laboral_id
    WHERE u.activo = true
      AND u.deleted_at IS NULL
      AND al.ano = ${filtros.anio}
      AND b.cantidad_disponible::numeric > 0
      ${sqlFiltroUsuarios(scope)}
    ORDER BY dias_restantes_cierre ASC, u.apellido
  `);

  const filas = [...result];
  return {
    filas,
    resumen: {
      totalRegistros: filas.length,
      enRiesgoAlto: filas.filter((r: Record<string, unknown>) => r.riesgo === 'alto').length,
    },
  };
}

export async function generarReporte(
  filtros: FiltrosReporte,
  scope: ReportScope
): Promise<{ data: unknown; totalRegistros: number }> {
  if (scope.vacio) {
    return { data: { filas: [], resumen: { totalRegistros: 0 } }, totalRegistros: 0 };
  }

  switch (filtros.tipo) {
    case 'balances': {
      const data = await generarReporteBalances(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    case 'solicitudes': {
      const data = await generarReporteSolicitudes(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    case 'departamentos': {
      const data = await generarReporteDepartamentos(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    case 'ausentismo': {
      const data = await generarReporteAusentismo(filtros, scope);
      return { data, totalRegistros: data.totalRegistros };
    }
    case 'cumpleanos': {
      const data = await generarReporteCumpleanos(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    case 'permisos_salida': {
      const data = await generarReportePermisosSalida(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    case 'cierre_ano': {
      const data = await generarReporteCierreAno(filtros, scope);
      return { data, totalRegistros: data.resumen.totalRegistros };
    }
    default:
      throw new Error('Tipo de reporte no válido');
  }
}

function sumField(rows: unknown[], field: string): number {
  return rows.reduce<number>((acc, row) => {
    const value = Number((row as Record<string, unknown>)[field] ?? 0);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);
}
