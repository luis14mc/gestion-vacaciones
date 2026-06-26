export const TIPOS_REPORTE = [
  'balances',
  'solicitudes',
  'departamentos',
  'ausentismo',
  'cumpleanos',
  'permisos_salida',
  'cierre_ano',
] as const;

export type TipoReporteCNI = (typeof TIPOS_REPORTE)[number];

export interface FiltrosReporte {
  tipo: TipoReporteCNI;
  anio: number;
  anoLaboralId: number | null;
  fechaInicio: string;
  fechaFin: string;
  departamentoId: number | null;
  tipoSolicitud: string | null;
  estado: string | null;
  usuarioId: number | null;
}

export function esTipoReporteValido(value: string | null): value is TipoReporteCNI {
  return TIPOS_REPORTE.includes(value as TipoReporteCNI);
}

export function parseFiltrosReporte(searchParams: URLSearchParams): FiltrosReporte {
  const anio = Number.parseInt(
    searchParams.get('anio') || String(new Date().getFullYear()),
    10
  );
  const fechaInicio =
    searchParams.get('fechaInicio') || `${Number.isFinite(anio) ? anio : new Date().getFullYear()}-01-01`;
  const fechaFin =
    searchParams.get('fechaFin') || `${Number.isFinite(anio) ? anio : new Date().getFullYear()}-12-31`;

  const tipoRaw = searchParams.get('tipo') || searchParams.get('tipoReporte') || 'balances';
  const tipo = esTipoReporteValido(tipoRaw) ? tipoRaw : 'balances';

  const parseOptionalInt = (key: string): number | null => {
    const raw = searchParams.get(key);
    if (!raw || raw === 'all' || raw === '') return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  const tipoSolicitudParam =
    searchParams.get('tipoSolicitud') || searchParams.get('tipoAusenciaId');
  const tipoSolicitud =
    tipoSolicitudParam && tipoSolicitudParam !== 'all' ? tipoSolicitudParam : null;

  const estadoRaw = searchParams.get('estado');

  return {
    tipo,
    anio: Number.isFinite(anio) ? anio : new Date().getFullYear(),
    anoLaboralId: parseOptionalInt('anoLaboralId'),
    fechaInicio,
    fechaFin,
    departamentoId: parseOptionalInt('departamentoId'),
    tipoSolicitud: tipoSolicitud && tipoSolicitud !== 'all' ? tipoSolicitud : null,
    estado: estadoRaw && estadoRaw !== 'all' ? estadoRaw : null,
    usuarioId: parseOptionalInt('usuarioId'),
  };
}

/** Rango inclusivo en calendario Honduras (UTC-6, sin DST). */
export function rangoFechasInclusive(fechaInicio: string, fechaFin: string) {
  return {
    fechaInicio,
    fechaFin,
    inicioHonduras: `${fechaInicio}T00:00:00-06:00`,
    finHonduras: `${fechaFin}T23:59:59.999-06:00`,
  };
}

export function filtrosReporteToRecord(filtros: FiltrosReporte): Record<string, unknown> {
  return { ...filtros };
}
