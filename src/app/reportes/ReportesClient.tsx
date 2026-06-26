'use client';

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import type { Session } from 'next-auth';
import {
  BarChart3,
  Cake,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Users,
  CalendarRange,
  AlertTriangle,
} from 'lucide-react';
import { notify } from '@/lib/swal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  COLUMNAS_REPORTE,
  DESCRIPCIONES_REPORTE,
  filasReporte,
  type ColumnaReporte,
} from '@/lib/domain/reportes/columns';
import {
  TIPOS_REPORTE,
  type TipoReporteCNI,
} from '@/lib/domain/reportes/filters';
import {
  ESTADO_SOLICITUD_LABELS,
  TIPO_SOLICITUD_LABELS,
  labelDuracionPermiso,
  labelEstado,
  labelTipo,
} from '@/lib/domain/reportes/labels';

interface ReportesClientProps {
  session: Session;
}

interface Departamento {
  id: number;
  nombre: string;
}

interface AnoLaboral {
  id: number;
  ano: number;
  nombre: string;
  activo: boolean;
}

interface ReporteMeta {
  totalRegistros: number;
  generadoEn: string;
  filtros: Record<string, unknown>;
}

const REPORTE_ICONS: Record<TipoReporteCNI, ElementType> = {
  balances: BarChart3,
  solicitudes: FileText,
  departamentos: Users,
  ausentismo: CalendarRange,
  cumpleanos: Cake,
  permisos_salida: Clock,
  cierre_ano: AlertTriangle,
};

const REPORTE_TITULOS: Record<TipoReporteCNI, string> = {
  balances: 'Balance de Vacaciones',
  solicitudes: 'Solicitudes',
  departamentos: 'Uso por Departamento',
  ausentismo: 'Ausentismo',
  cumpleanos: 'Día libre por cumpleaños',
  permisos_salida: 'Permisos de Salida',
  cierre_ano: 'Cierre de Año Laboral',
};

function valorCelda(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'estado') return labelEstado(String(value));
  if (key === 'tipo_solicitud' || key === 'tipo_mas_usado') return labelTipo(String(value));
  if (key === 'duracion_permiso') return labelDuracionPermiso(String(value));
  if (key === 'beneficio_usado') return value ? 'Sí' : 'No';
  if (key === 'porcentaje_uso') return `${value}%`;
  if (key === 'riesgo') {
    const map: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
    return map[String(value)] ?? String(value);
  }
  return String(value);
}

export default function ReportesClient({ session }: ReportesClientProps) {
  const esGlobal = Boolean(session.user.esAdmin || session.user.esRrhh);

  const [reporteSeleccionado, setReporteSeleccionado] = useState<TipoReporteCNI>('balances');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [anosLaborales, setAnosLaborales] = useState<AnoLaboral[]>([]);
  const [anoActivo, setAnoActivo] = useState<number>(new Date().getFullYear());
  const [cargando, setCargando] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [datosReporte, setDatosReporte] = useState<unknown>(null);
  const [meta, setMeta] = useState<ReporteMeta | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    `${new Date().getFullYear()}-01-01`
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [departamentoId, setDepartamentoId] = useState('');
  const [tipoSolicitud, setTipoSolicitud] = useState('');
  const [estado, setEstado] = useState('');

  const filtrosParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tipo', reporteSeleccionado);
    params.set('anio', String(anio));
    params.set('fechaInicio', fechaInicio);
    params.set('fechaFin', fechaFin);
    if (departamentoId) params.set('departamentoId', departamentoId);
    if (tipoSolicitud) params.set('tipoSolicitud', tipoSolicitud);
    if (estado) params.set('estado', estado);
    return params;
  }, [reporteSeleccionado, anio, fechaInicio, fechaFin, departamentoId, tipoSolicitud, estado]);

  const cargarCatalogos = useCallback(async () => {
    try {
      const [deptRes, anosRes] = await Promise.all([
        fetch('/api/departamentos'),
        fetch('/api/anos-laborales'),
      ]);
      const [deptData, anosData] = await Promise.all([deptRes.json(), anosRes.json()]);
      if (deptData.success) setDepartamentos(deptData.data ?? []);
      if (anosData.success) {
        setAnosLaborales(anosData.data ?? []);
        if (anosData.anoActivo?.ano) {
          setAnoActivo(anosData.anoActivo.ano);
          setAnio(anosData.anoActivo.ano);
        }
      }
    } catch (error) {
      console.error('Error cargando catálogos:', error);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const limpiarFiltros = () => {
    setFechaInicio(`${anoActivo}-01-01`);
    setFechaFin(new Date().toISOString().slice(0, 10));
    setAnio(anoActivo);
    setDepartamentoId('');
    setTipoSolicitud('');
    setEstado('');
    setDatosReporte(null);
    setMeta(null);
  };

  const cambiarReporte = (tipo: TipoReporteCNI) => {
    setReporteSeleccionado(tipo);
    setDatosReporte(null);
    setMeta(null);
  };

  const generarReporte = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/reportes?${filtrosParams.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDatosReporte(json.data);
        setMeta(json.meta ?? null);
      } else {
        notify.error('Error', json.error || 'Error al generar reporte');
      }
    } catch (error) {
      console.error(error);
      notify.error('Error', 'Error al generar reporte');
    } finally {
      setCargando(false);
    }
  };

  const descargarExportacion = async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams(filtrosParams);
      params.set('formato', formato);
      const res = await fetch(`/api/reportes/exportar?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Error al exportar ${formato.toUpperCase()}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ??
        `cni_${reporteSeleccionado}_${Date.now()}.${formato === 'xlsx' ? 'xlsx' : formato}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify.error('Error', error instanceof Error ? error.message : 'Error al exportar');
    } finally {
      setExportLoading(false);
    }
  };

  const filas = datosReporte ? filasReporte(datosReporte, reporteSeleccionado) : [];
  const columnas: ColumnaReporte[] = COLUMNAS_REPORTE[reporteSeleccionado];

  const usaRangoFechas = ['solicitudes', 'ausentismo', 'permisos_salida'].includes(reporteSeleccionado);
  const usaAnio = ['balances', 'departamentos', 'cumpleanos', 'cierre_ano', 'solicitudes'].includes(
    reporteSeleccionado
  );
  const usaTipoSolicitud = ['solicitudes', 'permisos_salida'].includes(reporteSeleccionado);
  const usaEstado = ['solicitudes', 'permisos_salida', 'cumpleanos'].includes(reporteSeleccionado);

  const resumenAusentismo =
    reporteSeleccionado === 'ausentismo' && datosReporte
      ? (datosReporte as { resumen?: Record<string, unknown> }).resumen
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Información institucional desde PostgreSQL · alcance{' '}
            {esGlobal ? 'organizacional' : 'de su equipo directo'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
          <Button variant="outline" size="sm" onClick={generarReporte} disabled={cargando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TIPOS_REPORTE.map((tipo) => {
          const Icon = REPORTE_ICONS[tipo];
          const activo = reporteSeleccionado === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => cambiarReporte(tipo)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                activo
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'bg-card hover:border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{REPORTE_TITULOS[tipo]}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {DESCRIPCIONES_REPORTE[tipo]}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros — {REPORTE_TITULOS[reporteSeleccionado]}
          </CardTitle>
          <CardDescription>{DESCRIPCIONES_REPORTE[reporteSeleccionado]}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {usaRangoFechas ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha fin</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {usaAnio ? (
            <div className="space-y-2">
              <Label>Año laboral</Label>
              <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {anosLaborales.map((a) => (
                    <SelectItem key={a.id} value={String(a.ano)}>
                      {a.nombre} {a.activo ? '(activo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {esGlobal ? (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={departamentoId || 'all'}
                onValueChange={(v) => setDepartamentoId(v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los departamentos</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {usaTipoSolicitud ? (
            <div className="space-y-2">
              <Label>Tipo de solicitud</Label>
              <Select
                value={tipoSolicitud || 'all'}
                onValueChange={(v) => setTipoSolicitud(v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_SOLICITUD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {usaEstado ? (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado || 'all'} onValueChange={(v) => setEstado(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(ESTADO_SOLICITUD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
            <Button onClick={generarReporte} disabled={cargando}>
              {cargando ? 'Generando…' : 'Generar reporte'}
            </Button>
            <Button
              variant="outline"
              onClick={() => descargarExportacion('csv')}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => descargarExportacion('xlsx')}
              disabled={exportLoading}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => descargarExportacion('pdf')}
              disabled={exportLoading}
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {meta ? (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Badge variant="secondary">{meta.totalRegistros} registros</Badge>
          <span>
            Generado: {new Date(meta.generadoEn).toLocaleString('es-HN')}
          </span>
          {departamentoId ? <span>· Depto. filtrado</span> : null}
          {tipoSolicitud ? <span>· Tipo: {labelTipo(tipoSolicitud)}</span> : null}
          {estado ? <span>· Estado: {labelEstado(estado)}</span> : null}
        </div>
      ) : null}

      {reporteSeleccionado === 'ausentismo' && resumenAusentismo ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Solicitudes aprobadas</p>
              <p className="text-xl font-semibold">{String(resumenAusentismo.total_solicitudes ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Días aprobados</p>
              <p className="text-xl font-semibold">{String(resumenAusentismo.total_dias ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Promedio días/solicitud</p>
              <p className="text-xl font-semibold">{String(resumenAusentismo.promedio_dias ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Colaboradores distintos</p>
              <p className="text-xl font-semibold">
                {String(resumenAusentismo.colaboradores_distintos ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {!datosReporte ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Seleccione filtros y pulse &quot;Generar reporte&quot;.
            </p>
          ) : filas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin datos para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnas.map((col) => (
                      <TableHead key={col.key} className="whitespace-nowrap text-xs">
                        {col.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((fila, index) => (
                    <TableRow key={index}>
                      {columnas.map((col) => (
                        <TableCell key={col.key} className="text-xs whitespace-nowrap">
                          {valorCelda(col.key, fila[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
