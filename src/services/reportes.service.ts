/**
 * Servicio de datos de reportes — datasets canónicos desde PostgreSQL.
 */

import type { SessionUser } from '@/types';
import {
  parseFiltrosReporte,
  filtrosReporteToRecord,
  type FiltrosReporte,
  type TipoReporteCNI,
} from '@/lib/domain/reportes/filters';
import { resolverAlcanceReportes } from '@/lib/domain/reportes/scope';
import { generarReporte } from '@/lib/domain/reportes/queries';
import {
  COLUMNAS_REPORTE,
  filasReporte,
  type ColumnaReporte,
} from '@/lib/domain/reportes/columns';
import { formatearValorExport } from '@/lib/domain/exportacion/format';

export const TITULOS_REPORTE: Record<TipoReporteCNI, string> = {
  balances: 'Balance de Vacaciones',
  solicitudes: 'Solicitudes de Ausencia',
  departamentos: 'Uso por Departamento',
  ausentismo: 'Ausentismo',
  cumpleanos: 'Día libre por cumpleaños',
  permisos_salida: 'Permisos de Salida',
  cierre_ano: 'Cierre de Año Laboral',
};

export interface DatasetReporte {
  tipo: TipoReporteCNI;
  titulo: string;
  columnas: ColumnaReporte[];
  filas: Record<string, unknown>[];
  totalRegistros: number;
  filtros: FiltrosReporte;
  filtrosRecord: Record<string, unknown>;
  generadoEn: string;
  sinDatos: boolean;
}

function formatearFilasExport(
  filasRaw: Record<string, unknown>[],
  columnas: ColumnaReporte[]
): Record<string, unknown>[] {
  return filasRaw.map((fila) => {
    const mapped: Record<string, unknown> = {};
    for (const col of columnas) {
      mapped[col.key] = formatearValorExport(col.key, fila[col.key]);
    }
    return mapped;
  });
}

export async function obtenerDatasetReporte(
  session: SessionUser,
  searchParams: URLSearchParams
): Promise<DatasetReporte> {
  const filtros = parseFiltrosReporte(searchParams);
  const scope = await resolverAlcanceReportes(session, {
    departamentoId: filtros.departamentoId,
    usuarioId: filtros.usuarioId,
  });

  const { data, totalRegistros } = await generarReporte(filtros, scope);
  const columnas = COLUMNAS_REPORTE[filtros.tipo];
  const filasRaw = filasReporte(data, filtros.tipo) as Record<string, unknown>[];
  const filas = formatearFilasExport(filasRaw, columnas);

  return {
    tipo: filtros.tipo,
    titulo: TITULOS_REPORTE[filtros.tipo],
    columnas,
    filas,
    totalRegistros,
    filtros,
    filtrosRecord: filtrosReporteToRecord(filtros),
    generadoEn: new Date().toISOString(),
    sinDatos: filas.length === 0,
  };
}
