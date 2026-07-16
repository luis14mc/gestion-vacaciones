'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  Download,
  Eye,
  FileText,
  Play,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { notify } from '@/lib/swal';
import { formatDate } from '@/lib/utils/date-format';
import { labelMes } from '@/lib/domain/asignacion-mensual-labels';
import type { EstadoAsignacionMesActual } from '@/lib/domain/rrhh-balance-estado';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AsignacionesMensualesTable, type FilaAsignacionMensual } from '@/components/asignaciones/AsignacionesMensualesTable';

interface DetalleColaborador {
  colaborador: ColaboradorFila;
  historialAsignaciones: FilaAsignacionMensual[];
  solicitudesRecientes: Array<{
    id: number;
    codigo: string;
    estado: string;
    fechaInicio: string;
    diasSolicitados: number;
  }>;
}

interface ResultadoAsignacionMensual {
  usuariosProcesados: number;
  asignacionesCreadas: number;
  usuariosOmitidos: number;
  totalDiasAsignados: number;
}

interface ColaboradorFila {
  usuarioId: number;
  nombre: string;
  apellido: string;
  email: string;
  departamento: string | null;
  cargo: string | null;
  fechaIngreso: string | null;
  activo: boolean;
  antiguedad: { anios: number; meses: number; dias: number; texto: string };
  reglaVacaciones: { diasAnualesAplicables: number; diasMensualesAplicables: number };
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
  validacion: { consistente: boolean; diferencia: number; mensaje: string | null };
}

interface Resumen {
  totalColaboradores: number;
  totalActivos: number;
  totalConAsignacionMesActual: number;
  totalPendientesAsignacionMesActual: number;
  totalConInconsistencias: number;
}

interface Departamento {
  id: number;
  nombre: string;
}

function badgeEstadoAsignacion(estado: EstadoAsignacionMesActual) {
  switch (estado) {
    case 'asignado':
      return (
        <Badge className="border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
          Asignado
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className="border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-100">
          Pendiente
        </Badge>
      );
    case 'no_aplica':
      return <Badge variant="secondary">No aplica</Badge>;
    case 'inconsistente':
      return (
        <Badge className="border-transparent bg-red-600/15 text-red-800 dark:text-red-200">
          Inconsistente
        </Badge>
      );
  }
}

export default function BalanceVacacionesClient() {
  const now = new Date();
  const [filas, setFilas] = useState<ColaboradorFila[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const [busqueda, setBusqueda] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [estadoAsignacion, setEstadoAsignacion] = useState('');
  const [soloInconsistencias, setSoloInconsistencias] = useState(false);

  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleColaborador | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [dialogAsignacion, setDialogAsignacion] = useState(false);
  const [anioAsignacion, setAnioAsignacion] = useState(now.getFullYear());
  const [mesAsignacion, setMesAsignacion] = useState(now.getMonth() + 1);
  const [ejecutandoAsignacion, setEjecutandoAsignacion] = useState(false);
  const [resultadoAsignacion, setResultadoAsignacion] = useState<ResultadoAsignacionMensual | null>(
    null
  );
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function cargarDepartamentos() {
      const res = await fetch('/api/departamentos');
      const json = await res.json();
      if (!cancelled && json.success) {
        setDepartamentos(json.data ?? []);
      }
    }

    void cargarDepartamentos();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function cargarBalances() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (busqueda.trim()) params.set('search', busqueda.trim());
        if (departamentoId) params.set('departamentoId', departamentoId);
        if (estadoAsignacion) params.set('estadoAsignacion', estadoAsignacion);
        if (soloInconsistencias) params.set('soloConInconsistencias', 'true');

        const res = await fetch(`/api/rrhh/balances-vacaciones?${params}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al cargar balances');
        if (cancelled) return;
        setFilas(json.data ?? []);
        setResumen(json.resumen ?? null);
        setTotalPages(json.pagination?.totalPages ?? 1);
      } catch (err) {
        if (!cancelled) {
          notify.error('Error', err instanceof Error ? err.message : 'Error al cargar');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void cargarBalances();
    return () => {
      cancelled = true;
    };
  }, [page, busqueda, departamentoId, estadoAsignacion, soloInconsistencias, refreshToken]);

  const abrirDetalle = async (usuarioId: number) => {
    setDetalleId(usuarioId);
    setCargandoDetalle(true);
    setDetalle(null);
    try {
      const res = await fetch(`/api/rrhh/balances-vacaciones/${usuarioId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar detalle');
      setDetalle(json.data);
    } catch (err) {
      notify.error('Error', err instanceof Error ? err.message : 'Error al cargar detalle');
      setDetalleId(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const exportarCsv = () => {
    const params = new URLSearchParams({ formato: 'csv' });
    if (busqueda.trim()) params.set('search', busqueda.trim());
    if (departamentoId) params.set('departamentoId', departamentoId);
    if (estadoAsignacion) params.set('estadoAsignacion', estadoAsignacion);
    if (soloInconsistencias) params.set('soloConInconsistencias', 'true');
    window.location.href = `/api/rrhh/balances-vacaciones?${params}`;
  };

  const ejecutarAsignacionMensual = async () => {
    setEjecutandoAsignacion(true);
    setResultadoAsignacion(null);
    try {
      const res = await fetch('/api/admin/asignacion-mensual-vacaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: anioAsignacion, mes: mesAsignacion, modo: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al ejecutar asignación');
      setResultadoAsignacion(json.data);
      notify.success(
        'Asignación ejecutada',
        `${json.data.asignacionesCreadas} asignaciones creadas`
      );
      setRefreshToken((t) => t + 1);
    } catch (err) {
      notify.error('Error', err instanceof Error ? err.message : 'Error al ejecutar');
    } finally {
      setEjecutandoAsignacion(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Control de Vacaciones</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Consulta de saldos, asignaciones mensuales y antigüedad laboral.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefreshToken((t) => t + 1)}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportarCsv}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setDialogAsignacion(true)}>
            <Play className="h-4 w-4" />
            Ejecutar asignación mensual
          </Button>
        </div>
      </div>

      {resumen ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Colaboradores activos</p>
              <p className="text-2xl font-semibold tabular-nums">{resumen.totalActivos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Asignados este mes</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-600">
                {resumen.totalConAsignacionMesActual}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pendientes de asignación</p>
              <p className="text-2xl font-semibold tabular-nums text-amber-600">
                {resumen.totalPendientesAsignacionMesActual}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Inconsistencias</p>
              <p className="text-2xl font-semibold tabular-nums text-red-600">
                {resumen.totalConInconsistencias}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nombre o email…"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select
              value={departamentoId || 'all'}
              onValueChange={(v) => {
                setDepartamentoId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado asignación mes</Label>
            <Select
              value={estadoAsignacion || 'all'}
              onValueChange={(v) => {
                setEstadoAsignacion(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="asignado">Asignado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="no_aplica">No aplica</SelectItem>
                <SelectItem value="inconsistente">Inconsistente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant={soloInconsistencias ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => {
                setSoloInconsistencias((v) => !v);
                setPage(1);
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              Solo inconsistencias
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Balances por colaborador
          </CardTitle>
          <CardDescription>
            Regla: disponibles = vencidos + proporcionales − usados − pendientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin colaboradores para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Depto.</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Antigüedad</TableHead>
                    <TableHead className="text-right">Anual</TableHead>
                    <TableHead className="text-right">Venc.</TableHead>
                    <TableHead className="text-right">Prop.</TableHead>
                    <TableHead className="text-right">Usados</TableHead>
                    <TableHead className="text-right">Pend.</TableHead>
                    <TableHead className="text-right">Disp.</TableHead>
                    <TableHead>Estado mes</TableHead>
                    <TableHead>OK</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.usuarioId}>
                      <TableCell>
                        <div className="font-medium">{f.nombre} {f.apellido}</div>
                        <div className="text-xs text-muted-foreground">{f.email}</div>
                      </TableCell>
                      <TableCell className="text-xs">{f.departamento ?? '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {f.fechaIngreso ? formatDate(f.fechaIngreso) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{f.antiguedad.texto}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {f.reglaVacaciones.diasAnualesAplicables}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {f.balance.diasVencidos.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {f.balance.diasProporcionales.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {f.balance.diasUsados.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {f.balance.diasPendientes.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">
                        {f.balance.diasDisponibles.toFixed(2)}
                      </TableCell>
                      <TableCell>{badgeEstadoAsignacion(f.asignacionMensual.estadoMesActual)}</TableCell>
                      <TableCell>
                        {f.validacion.consistente ? (
                          <Badge variant="outline" className="text-emerald-700">OK</Badge>
                        ) : (
                          <Badge variant="destructive" title={f.validacion.mensaje ?? ''}>
                            Δ{f.validacion.diferencia}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => void abrirDetalle(f.usuarioId)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detalleId !== null} onOpenChange={(o) => !o && setDetalleId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del colaborador</DialogTitle>
          </DialogHeader>
          {cargandoDetalle ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : detalle?.colaborador ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nombre</p>
                  <p className="font-medium">
                    {detalle.colaborador.nombre} {detalle.colaborador.apellido}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{detalle.colaborador.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Departamento</p>
                  <p>{detalle.colaborador.departamento ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cargo</p>
                  <p>{detalle.colaborador.cargo ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha ingreso</p>
                  <p>{detalle.colaborador.fechaIngreso ? formatDate(detalle.colaborador.fechaIngreso) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Antigüedad</p>
                  <p>{detalle.colaborador.antiguedad.texto}</p>
                </div>
              </div>

              <div className="rounded-xl border p-3 grid grid-cols-3 gap-2 text-sm">
                {[
                  ['Vencidos', detalle.colaborador.balance.diasVencidos],
                  ['Proporcionales', detalle.colaborador.balance.diasProporcionales],
                  ['Asignados', detalle.colaborador.balance.diasAsignados],
                  ['Usados', detalle.colaborador.balance.diasUsados],
                  ['Pendientes', detalle.colaborador.balance.diasPendientes],
                  ['Disponibles', detalle.colaborador.balance.diasDisponibles],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums">{Number(val).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {!detalle.colaborador.validacion.consistente ? (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {detalle.colaborador.validacion.mensaje}
                </p>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Historial de asignaciones mensuales
                </h3>
                <AsignacionesMensualesTable
                  filas={detalle.historialAsignaciones ?? []}
                  mostrarBalance
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Solicitudes recientes
                </h3>
                {(detalle.solicitudesRecientes ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin solicitudes.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detalle.solicitudesRecientes.map((s) => (
                      <li key={s.id} className="flex justify-between gap-2 border-b pb-2">
                        <span>{s.codigo} · {s.estado}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(s.fechaInicio)} · {s.diasSolicitados} días
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/solicitudes?usuarioId=${detalle.colaborador.usuarioId}`}>
                    Ver solicitudes
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/asignaciones-mensuales">Historial institucional</Link>
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDetalleId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAsignacion} onOpenChange={setDialogAsignacion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ejecutar asignación mensual</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se ejecutará la asignación mensual para el mes seleccionado. Los usuarios ya
            asignados serán omitidos.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                value={anioAsignacion}
                onChange={(e) => setAnioAsignacion(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(mesAsignacion)} onValueChange={(v) => setMesAsignacion(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{labelMes(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {resultadoAsignacion ? (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p>Procesados: {resultadoAsignacion.usuariosProcesados}</p>
              <p>Creadas: {resultadoAsignacion.asignacionesCreadas}</p>
              <p>Omitidos: {resultadoAsignacion.usuariosOmitidos}</p>
              <p>Total días: {resultadoAsignacion.totalDiasAsignados}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAsignacion(false)}>Cancelar</Button>
            <Button disabled={ejecutandoAsignacion} onClick={() => void ejecutarAsignacionMensual()}>
              {ejecutandoAsignacion ? 'Ejecutando…' : 'Confirmar ejecución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
