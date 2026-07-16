/**
 * Consulta institucional de balances de vacaciones para RRHH/Admin.
 */
import { db } from '@/lib/db';
import {
  usuarios,
  departamentos,
  balances,
  anosLaborales,
  historialAsignacionesMensuales,
  solicitudes,
} from '@/lib/db/schema';
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  calcularAntiguedadDetallada,
  formatearAntiguedad,
} from '@/lib/domain/antiguedad-display';
import {
  mapBalanceInstitucional,
  reglaVacacionesDesdeIngreso,
  resolverEstadoAsignacionMesActual,
  validarConsistenciaBalance,
  type EstadoAsignacionMesActual,
} from '@/lib/domain/rrhh-balance-estado';
import { calcularAntiguedadLaboral } from '@/lib/domain/vacaciones-asignacion';
import { obtenerHistorialAsignacionesUsuario } from '@/services/asignacion-vacaciones.service';

export interface FiltrosBalancesRRHH {
  page?: number;
  pageSize?: number;
  search?: string;
  departamentoId?: number;
  estadoAsignacion?: EstadoAsignacionMesActual;
  soloConInconsistencias?: boolean;
  soloActivos?: boolean;
  ordenarPor?: 'nombre' | 'departamento' | 'diasDisponibles' | 'fechaIngreso' | 'antiguedad';
  orden?: 'asc' | 'desc';
  usuarioId?: number;
}

export interface ColaboradorBalanceRRHH {
  usuarioId: number;
  nombre: string;
  apellido: string;
  email: string;
  departamento: string | null;
  cargo: string | null;
  fechaIngreso: string | null;
  activo: boolean;
  antiguedad: { anios: number; meses: number; dias: number; aniosCumplidos?: number; texto: string };
  reglaVacaciones: {
    diasAnualesAplicables: number;
    diasMensualesAplicables: number;
  };
  balance: {
    diasVencidos: number;
    diasProporcionales: number;
    diasAsignados: number;
    diasUsados: number;
    diasPendientes: number;
    diasDisponibles: number;
  };
  asignacionMensual: {
    ultimoMesAsignado: number | null;
    ultimoAnioAsignado: number | null;
    diasUltimaAsignacion: number | null;
    fechaUltimaAsignacion: string | null;
    estadoMesActual: EstadoAsignacionMesActual;
  };
  validacion: {
    consistente: boolean;
    diferencia: number;
    mensaje: string | null;
  };
}

export interface ResumenBalancesRRHH {
  totalColaboradores: number;
  totalActivos: number;
  totalConAsignacionMesActual: number;
  totalPendientesAsignacionMesActual: number;
  totalConInconsistencias: number;
}

async function obtenerAnoLaboralActivoId(): Promise<number | null> {
  const [row] = await db
    .select({ id: anosLaborales.id })
    .from(anosLaborales)
    .where(eq(anosLaborales.activo, true))
    .limit(1);
  return row?.id ?? null;
}

function construirWhereUsuarios(filtros: FiltrosBalancesRRHH): SQL | undefined {
  const condiciones: SQL[] = [isNull(usuarios.deletedAt)];

  if (filtros.usuarioId) {
    condiciones.push(eq(usuarios.id, filtros.usuarioId));
  }

  if (filtros.soloActivos !== false) {
    condiciones.push(eq(usuarios.activo, true));
  }

  if (filtros.departamentoId) {
    condiciones.push(eq(usuarios.departamentoId, filtros.departamentoId));
  }

  if (filtros.search?.trim()) {
    const q = `%${filtros.search.trim()}%`;
    condiciones.push(
      or(
        ilike(usuarios.nombre, q),
        ilike(usuarios.apellido, q),
        ilike(usuarios.email, q)
      )!
    );
  }

  return condiciones.length > 0 ? and(...condiciones) : undefined;
}

async function cargarAsignacionesMesActual(
  usuarioIds: number[],
  anio: number,
  mes: number
): Promise<Map<number, { dias: number; ejecutadoEn: string }>> {
  if (usuarioIds.length === 0) return new Map();

  const rows = await db
    .select({
      usuarioId: historialAsignacionesMensuales.usuarioId,
      diasAsignados: historialAsignacionesMensuales.diasAsignados,
      ejecutadoEn: historialAsignacionesMensuales.ejecutadoEn,
    })
    .from(historialAsignacionesMensuales)
    .where(
      and(
        inArray(historialAsignacionesMensuales.usuarioId, usuarioIds),
        eq(historialAsignacionesMensuales.anio, anio),
        eq(historialAsignacionesMensuales.mes, mes)
      )
    );

  return new Map(
    rows.map((r) => [
      r.usuarioId,
      { dias: parseFloat(r.diasAsignados), ejecutadoEn: r.ejecutadoEn },
    ])
  );
}

async function cargarUltimaAsignacionPorUsuario(
  usuarioIds: number[]
): Promise<
  Map<
    number,
    { anio: number; mes: number; dias: number; ejecutadoEn: string }
  >
> {
  if (usuarioIds.length === 0) return new Map();

  const result = await db.execute(sql`
    SELECT DISTINCT ON (usuario_id)
      usuario_id,
      anio,
      mes,
      dias_asignados,
      ejecutado_en
    FROM historial_asignaciones_mensuales
    WHERE usuario_id IN (${sql.join(usuarioIds.map((id) => sql`${id}`), sql`, `)})
    ORDER BY usuario_id, anio DESC, mes DESC
  `);

  const map = new Map<
    number,
    { anio: number; mes: number; dias: number; ejecutadoEn: string }
  >();

  for (const row of result as Array<Record<string, unknown>>) {
    const uid = Number(row.usuario_id);
    map.set(uid, {
      anio: Number(row.anio),
      mes: Number(row.mes),
      dias: parseFloat(String(row.dias_asignados)),
      ejecutadoEn: String(row.ejecutado_en),
    });
  }

  return map;
}

function mapearColaborador(params: {
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    cargo: string | null;
    fechaIngreso: string | null;
    activo: boolean;
    deletedAt: string | null;
  };
  departamentoNombre: string | null;
  balanceRow: {
    cantidadInicial: string;
    cantidadAcumulada: string;
    cantidadUsada: string;
    cantidadPendiente: string;
    cantidadDisponible: string;
  } | null;
  asignacionMes: { dias: number; ejecutadoEn: string } | undefined;
  ultimaAsignacion:
    | { anio: number; mes: number; dias: number; ejecutadoEn: string }
    | undefined;
  fechaReferencia: Date;
}): ColaboradorBalanceRRHH {
  const { usuario, balanceRow, asignacionMes, ultimaAsignacion, fechaReferencia } =
    params;

  const balanceInput = balanceRow ?? {
    cantidadInicial: '0',
    cantidadAcumulada: '0',
    cantidadUsada: '0',
    cantidadPendiente: '0',
    cantidadDisponible: '0',
  };

  const validacion = validarConsistenciaBalance(balanceInput);
  const balance = mapBalanceInstitucional(balanceInput);
  const antiguedadDet = calcularAntiguedadDetallada(usuario.fechaIngreso, fechaReferencia);
  const regla = reglaVacacionesDesdeIngreso(usuario.fechaIngreso, fechaReferencia);
  const aniosCumplidos = usuario.fechaIngreso
    ? calcularAntiguedadLaboral(usuario.fechaIngreso, fechaReferencia)
    : 0;

  const estadoMesActual = resolverEstadoAsignacionMesActual({
    activo: usuario.activo,
    eliminado: usuario.deletedAt != null,
    fechaIngreso: usuario.fechaIngreso,
    tieneAsignacionMesActual: Boolean(asignacionMes),
    balanceConsistente: validacion.consistente,
    fechaReferencia,
  });

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    departamento: params.departamentoNombre,
    cargo: usuario.cargo,
    fechaIngreso: usuario.fechaIngreso,
    activo: usuario.activo,
    antiguedad: {
      anios: antiguedadDet.anios,
      meses: antiguedadDet.meses,
      dias: antiguedadDet.dias,
      aniosCumplidos,
      texto: formatearAntiguedad(antiguedadDet),
    },
    reglaVacaciones: regla,
    balance,
    asignacionMensual: {
      ultimoMesAsignado: ultimaAsignacion?.mes ?? null,
      ultimoAnioAsignado: ultimaAsignacion?.anio ?? null,
      diasUltimaAsignacion: ultimaAsignacion?.dias ?? null,
      fechaUltimaAsignacion: ultimaAsignacion?.ejecutadoEn ?? null,
      estadoMesActual,
    },
    validacion,
  };
}

export function calcularResumenBalances(
  filas: ColaboradorBalanceRRHH[]
): ResumenBalancesRRHH {
  return {
    totalColaboradores: filas.length,
    totalActivos: filas.filter((f) => f.activo).length,
    totalConAsignacionMesActual: filas.filter(
      (f) => f.asignacionMensual.estadoMesActual === 'asignado'
    ).length,
    totalPendientesAsignacionMesActual: filas.filter(
      (f) => f.asignacionMensual.estadoMesActual === 'pendiente'
    ).length,
    totalConInconsistencias: filas.filter((f) => !f.validacion.consistente).length,
  };
}

export async function obtenerBalancesVacacionesRRHH(filtros: FiltrosBalancesRRHH = {}) {
  const page = Math.max(1, filtros.page ?? 1);
  const pageSize = Math.min(Math.max(1, filtros.pageSize ?? 20), 100);
  const fechaReferencia = new Date();
  const mesActual = fechaReferencia.getMonth() + 1;
  const anioActual = fechaReferencia.getFullYear();
  const anoLaboralId = await obtenerAnoLaboralActivoId();

  const whereUsuarios = construirWhereUsuarios(filtros);

  const usuariosRows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      email: usuarios.email,
      cargo: usuarios.cargo,
      fechaIngreso: usuarios.fechaIngreso,
      activo: usuarios.activo,
      deletedAt: usuarios.deletedAt,
      departamentoNombre: departamentos.nombre,
    })
    .from(usuarios)
    .leftJoin(departamentos, eq(usuarios.departamentoId, departamentos.id))
    .where(whereUsuarios);

  const usuarioIds = usuariosRows.map((u) => u.id);

  const balancesRows =
    anoLaboralId && usuarioIds.length > 0
      ? await db
          .select({
            usuarioId: balances.usuarioId,
            cantidadInicial: balances.cantidadInicial,
            cantidadAcumulada: balances.cantidadAcumulada,
            cantidadUsada: balances.cantidadUsada,
            cantidadPendiente: balances.cantidadPendiente,
            cantidadDisponible: balances.cantidadDisponible,
          })
          .from(balances)
          .where(
            and(
              inArray(balances.usuarioId, usuarioIds),
              eq(balances.anoLaboralId, anoLaboralId),
              eq(balances.tipoAusencia, 'vacaciones')
            )
          )
      : [];

  const balancePorUsuario = new Map(balancesRows.map((b) => [b.usuarioId, b]));
  const asignacionesMes = await cargarAsignacionesMesActual(
    usuarioIds,
    anioActual,
    mesActual
  );
  const ultimasAsignaciones = await cargarUltimaAsignacionPorUsuario(usuarioIds);

  let filas = usuariosRows.map((u) =>
    mapearColaborador({
      usuario: u,
      departamentoNombre: u.departamentoNombre,
      balanceRow: balancePorUsuario.get(u.id) ?? null,
      asignacionMes: asignacionesMes.get(u.id),
      ultimaAsignacion: ultimasAsignaciones.get(u.id),
      fechaReferencia,
    })
  );

  if (filtros.estadoAsignacion) {
    filas = filas.filter(
      (f) => f.asignacionMensual.estadoMesActual === filtros.estadoAsignacion
    );
  }

  if (filtros.soloConInconsistencias) {
    filas = filas.filter((f) => !f.validacion.consistente);
  }

  const orden = filtros.orden ?? 'asc';
  const ordenarPor = filtros.ordenarPor ?? 'nombre';
  const factor = orden === 'desc' ? -1 : 1;

  filas.sort((a, b) => {
    switch (ordenarPor) {
      case 'departamento':
        return (
          factor *
          (a.departamento ?? '').localeCompare(b.departamento ?? '', 'es')
        );
      case 'diasDisponibles':
        return factor * (a.balance.diasDisponibles - b.balance.diasDisponibles);
      case 'fechaIngreso':
        return (
          factor *
          (a.fechaIngreso ?? '').localeCompare(b.fechaIngreso ?? '')
        );
      case 'antiguedad':
        return factor * ((a.antiguedad.aniosCumplidos ?? a.antiguedad.anios) - (b.antiguedad.aniosCumplidos ?? b.antiguedad.anios));
      default:
        return (
          factor *
          `${a.apellido} ${a.nombre}`.localeCompare(
            `${b.apellido} ${b.nombre}`,
            'es'
          )
        );
    }
  });

  const resumen = calcularResumenBalances(filas);
  const total = filas.length;
  const offset = (page - 1) * pageSize;
  const paginadas = filas.slice(offset, offset + pageSize);

  return {
    data: paginadas,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    resumen,
  };
}

export async function obtenerDetalleBalanceColaboradorRRHH(usuarioId: number) {
  const resultado = await obtenerBalancesVacacionesRRHH({
    usuarioId,
    page: 1,
    pageSize: 1,
    soloActivos: false,
  });

  const colaborador = resultado.data[0];
  if (!colaborador) return null;

  const [historialAsignaciones, solicitudesRecientes] = await Promise.all([
    obtenerHistorialAsignacionesUsuario(usuarioId, { limite: 24 }),
    db
      .select({
        id: solicitudes.id,
        codigo: solicitudes.codigo,
        tipo: solicitudes.tipo,
        estado: solicitudes.estado,
        fechaInicio: solicitudes.fechaInicio,
        fechaFin: solicitudes.fechaFin,
        diasSolicitados: solicitudes.diasSolicitados,
        createdAt: solicitudes.createdAt,
      })
      .from(solicitudes)
      .where(and(eq(solicitudes.usuarioId, usuarioId), isNull(solicitudes.deletedAt)))
      .orderBy(desc(solicitudes.createdAt))
      .limit(10),
  ]);

  return {
    colaborador,
    historialAsignaciones,
    solicitudesRecientes: solicitudesRecientes.map((s) => ({
      ...s,
      diasSolicitados: parseFloat(String(s.diasSolicitados)),
    })),
  };
}

/** Exportación CSV — todas las filas que coinciden con filtros (sin paginar). */
export async function exportarBalancesVacacionesCSV(filtros: FiltrosBalancesRRHH) {
  const { data } = await obtenerBalancesVacacionesRRHH({
    ...filtros,
    page: 1,
    pageSize: 10_000,
  });

  return data.map((f) => ({
    nombre: `${f.nombre} ${f.apellido}`.trim(),
    email: f.email,
    departamento: f.departamento ?? '',
    fecha_ingreso: f.fechaIngreso ?? '',
    antiguedad: f.antiguedad.texto,
    dias_anuales: f.reglaVacaciones.diasAnualesAplicables,
    dias_mensuales: f.reglaVacaciones.diasMensualesAplicables,
    vencidos: f.balance.diasVencidos,
    proporcionales: f.balance.diasProporcionales,
    usados: f.balance.diasUsados,
    pendientes: f.balance.diasPendientes,
    disponibles: f.balance.diasDisponibles,
    ultima_asignacion: f.asignacionMensual.fechaUltimaAsignacion ?? '',
    estado_mes: f.asignacionMensual.estadoMesActual,
    consistente: f.validacion.consistente ? 'Sí' : 'No',
  }));
}
