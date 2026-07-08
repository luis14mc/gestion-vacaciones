"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Filter,
  Search,
  Calendar,
  User,
  Clock,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Hourglass,
} from "lucide-react";
import { calcularTiempoRelativo } from "@/lib/format-relative-time";
import { notify } from "@/lib/swal";
import { formatDate } from "@/lib/utils/date-format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Solicitud {
  id: number;
  usuarioId: number;
  tipoAusenciaId: number;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  motivo: string | null;
  estado: string;
  comentariosJefe: string | null;
  comentariosRrhh: string | null;
  aprobadoPorJefeId: number | null;
  aprobadoPorRrhhId: number | null;
  fechaAprobacionJefe: string | null;
  fechaAprobacionRrhh: string | null;
  fechaCreacion: string;
  usuario: string;
  tipoAusencia: string;
  aprobadorJefe: string | null;
  aprobadorRrhh: string | null;
  metadata?: any;
}

interface Stats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

interface Props {
  session?: Session;
}

const estadoBadgeMap: Record<
  string,
  { label: string; icon: LucideIcon; className: string }
> = {
  borrador: {
    label: "Borrador",
    icon: Clock,
    className:
      "border-transparent bg-muted text-muted-foreground hover:bg-muted",
  },
  pendiente_jefe: {
    label: "Pendiente Jefe",
    icon: Clock,
    className:
      "border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20",
  },
  aprobada_jefe: {
    label: "Pendiente RRHH",
    icon: Hourglass,
    className:
      "border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20",
  },
  rechazada_jefe: {
    label: "Rechazada Jefe",
    icon: XCircle,
    className:
      "border-transparent bg-red-600/15 text-red-800 dark:text-red-200 hover:bg-red-600/20",
  },
  aprobada_rrhh: {
    label: "Aprobada RRHH",
    icon: Check,
    className:
      "border-transparent bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20",
  },
  rechazada_rrhh: {
    label: "Rechazada RRHH",
    icon: X,
    className:
      "border-transparent bg-red-600/15 text-red-800 dark:text-red-200 hover:bg-red-600/20",
  },

  cancelada: {
    label: "Cancelada",
    icon: X,
    className:
      "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
  },
  finalizada: {
    label: "Finalizada",
    icon: CheckCircle,
    className:
      "border-transparent bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20",
  },
};

export default function SolicitudesClient({ session }: Props) {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
  });
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const itemsPorPagina = 20;

  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<Solicitud | null>(null);
  const [referenciaTiempo, setReferenciaTiempo] = useState(() => Date.now());

  const cargarSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        pagina: paginaActual.toString(),
        limite: itemsPorPagina.toString(),
      });

      if (estadoFiltro !== "todos") params.append("estado", estadoFiltro);
      if (tipoFiltro !== "todos") params.append("tipoAusenciaId", tipoFiltro);
      if (fechaInicio) params.append("fechaInicio", fechaInicio);
      if (fechaFin) params.append("fechaFin", fechaFin);

      const response = await fetch(`/api/solicitudes?${params}`);
      const data = await response.json();

      if (data.success) {
        setSolicitudes(data.solicitudes);
        setStats({
          total: data.total,
          pendientes: data.stats?.pendientes || 0,
          aprobadas: data.stats?.aprobadas || 0,
          rechazadas: data.stats?.rechazadas || 0,
        });
        setTotalPaginas(Math.ceil(data.total / itemsPorPagina));
        setReferenciaTiempo(Date.now());
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      notify.error("Error", "No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }, [paginaActual, estadoFiltro, tipoFiltro, fechaInicio, fechaFin, itemsPorPagina]);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  const solicitudesFiltradas = solicitudes || [];

  const getEstadoBadge = (estado: string) => {
    const config =
      estadoBadgeMap[estado] ?? {
        label: estado,
        icon: AlertCircle,
        className:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted",
      };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn("gap-1 font-normal", config.className)}>
        <Icon className="size-3 shrink-0" />
        {config.label}
      </Badge>
    );
  };

  const calcularDiasDesde = (fecha: string) =>
    calcularTiempoRelativo(fecha, referenciaTiempo);

  return (
    <div>
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="rounded-xl bg-muted p-2.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Solicitudes de Vacaciones
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Gestión y seguimiento de todas las solicitudes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:gap-4 md:grid-cols-4">
          <Card className="gap-0 rounded-2xl py-4 sm:py-5">
            <CardContent className="space-y-1 px-4 sm:px-5">
              <FileText className="mb-1 hidden h-4 w-4 text-primary sm:block" />
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold tabular-nums text-primary">
                {stats.total}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Todas las solicitudes
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-2xl py-4 sm:py-5">
            <CardContent className="space-y-1 px-4 sm:px-5">
              <Clock className="mb-1 hidden h-4 w-4 text-amber-600 dark:text-amber-500 sm:block" />
              <p className="text-xs font-medium text-muted-foreground">
                Pendientes
              </p>
              <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-500">
                {stats.pendientes}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                En revisión
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-2xl py-4 sm:py-5">
            <CardContent className="space-y-1 px-4 sm:px-5">
              <Check className="mb-1 hidden h-4 w-4 text-emerald-600 dark:text-emerald-500 sm:block" />
              <p className="text-xs font-medium text-muted-foreground">
                Aprobadas
              </p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-500">
                {stats.aprobadas}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Confirmadas
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-2xl py-4 sm:py-5">
            <CardContent className="space-y-1 px-4 sm:px-5">
              <X className="mb-1 hidden h-4 w-4 text-red-600 dark:text-red-500 sm:block" />
              <p className="text-xs font-medium text-muted-foreground">
                Rechazadas
              </p>
              <p className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-500">
                {stats.rechazadas}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Denegadas
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 rounded-2xl py-0">
          <CardHeader className="space-y-0 p-3 sm:p-6">
            <CardTitle className="text-[13px] font-semibold">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Filtros de búsqueda</span>
                <span className="sm:hidden">Filtros</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-6 sm:px-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="buscar-solicitudes">
                  Buscar (presiona Enter)
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="buscar-solicitudes"
                    type="text"
                    placeholder="Usuario, tipo, motivo..."
                    className="pl-9"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPaginaActual(1);
                        cargarSolicitudes();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="estado-solicitud">Estado</Label>
                <Select
                  value={estadoFiltro}
                  onValueChange={(v) => {
                    setEstadoFiltro(v);
                    setPaginaActual(1);
                  }}
                >
                  <SelectTrigger id="estado-solicitud" className="w-full">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="pendiente_jefe">Pendiente Jefe</SelectItem>
                    <SelectItem value="aprobada_jefe">Aprobada por Jefe</SelectItem>
                    <SelectItem value="aprobada_rrhh">Aprobada RRHH</SelectItem>
                    <SelectItem value="rechazada_jefe">Rechazada por Jefe</SelectItem>
                    <SelectItem value="rechazada_rrhh">Rechazada por RRHH</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="finalizada">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="fecha-inicio">Fecha inicio</Label>
                <Input
                  id="fecha-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="fecha-fin">Fecha fin</Label>
                <Input
                  id="fecha-fin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="invisible hidden sm:block" aria-hidden>
                  &nbsp;
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full sm:mt-0"
                  onClick={() => {
                    setBusqueda("");
                    setEstadoFiltro("todos");
                    setTipoFiltro("todos");
                    setFechaInicio("");
                    setFechaFin("");
                    setPaginaActual(1);
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-2xl py-0">
          <CardContent className="p-5">
            <CardTitle className="mb-4 text-[13px] font-semibold">
              Listado de solicitudes ({stats.total})
            </CardTitle>

            {loading ? (
              <div className="flex justify-center py-12">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  role="status"
                  aria-label="Cargando"
                />
              </div>
            ) : solicitudesFiltradas.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
                <p className="text-muted-foreground">
                  No se encontraron solicitudes
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {solicitudesFiltradas.map((sol) => (
                    <Card
                      key={sol.id}
                      className="rounded-2xl transition-all duration-200 hover:shadow-md"
                    >
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <User className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate text-sm font-semibold text-foreground">
                              {sol.usuario}
                            </span>
                          </div>
                          {getEstadoBadge(sol.estado)}
                        </div>

                        <div className="mb-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                          <Badge variant="outline" className="w-fit max-w-full text-xs">
                            {sol.tipoAusencia}
                          </Badge>
                          <Badge className="text-xs">{sol.dias} días</Badge>
                        </div>

                        <div className="mb-2 rounded-xl bg-muted/50 p-2">
                          <div className="mb-1 text-xs text-muted-foreground">
                            Período:
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-sm text-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{formatDate(sol.fechaInicio)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{formatDate(sol.fechaFin)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 border-t border-border pt-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                          <div className="text-xs text-muted-foreground">
                            <Clock className="mr-1 inline h-3 w-3" />
                            {calcularDiasDesde(sol.fechaCreacion)}
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="gap-1"
                            onClick={() => setSolicitudSeleccionada(sol)}
                          >
                            <Eye className="h-3 w-3" />
                            Ver
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Días</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Solicitado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitudesFiltradas.map((sol) => (
                        <TableRow key={sol.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {sol.usuario}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sol.tipoAusencia}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1 text-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(sol.fechaInicio)}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(sol.fechaFin)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge>{sol.dias} días</Badge>
                          </TableCell>
                          <TableCell>{getEstadoBadge(sol.estado)}</TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              {calcularDiasDesde(sol.fechaCreacion)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setSolicitudSeleccionada(sol)}
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:mt-6 sm:flex-row">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="sm:size-9"
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="sm:size-9"
                    onClick={() =>
                      setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                    }
                    disabled={paginaActual === totalPaginas}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={solicitudSeleccionada !== null}
        onOpenChange={(open) => {
          if (!open) setSolicitudSeleccionada(null);
        }}
      >
        <DialogContent
          className="gap-0 p-0 sm:max-w-2xl"
          showCloseButton
        >
          {solicitudSeleccionada && (
            <>
              <DialogHeader className="border-b border-border px-4 pb-4 pt-6 text-left sm:px-6">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Detalles de la Solicitud
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Usuario</Label>
                    <p className="text-foreground">{solicitudSeleccionada.usuario}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">
                      Tipo de ausencia
                    </Label>
                    <p className="text-foreground">
                      {solicitudSeleccionada.tipoAusencia}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Fecha inicio</Label>
                    <p className="text-foreground">
                      {formatDate(solicitudSeleccionada.fechaInicio)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Fecha fin</Label>
                    <p className="text-foreground">
                      {formatDate(solicitudSeleccionada.fechaFin)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">
                      Días solicitados
                    </Label>
                    <p className="text-foreground">
                      {solicitudSeleccionada.dias} días
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Estado</Label>
                    <div>{getEstadoBadge(solicitudSeleccionada.estado)}</div>
                  </div>
                </div>

                {solicitudSeleccionada.motivo && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Motivo</Label>
                    <p className="rounded-xl bg-muted/50 p-3 text-foreground">
                      {solicitudSeleccionada.motivo}
                    </p>
                  </div>
                )}

                {solicitudSeleccionada.metadata?.comentarios && solicitudSeleccionada.metadata.comentarios.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-muted-foreground">Historial de Comentarios</Label>
                    <div className="space-y-3 rounded-xl bg-muted/50 p-3">
                      {solicitudSeleccionada.metadata.comentarios.map((com: any, i: number) => (
                        <div key={i} className="flex flex-col space-y-1 pb-3 last:pb-0 border-b last:border-0 border-border">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-semibold uppercase text-primary">{com.accion.replace('_', ' ')}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(com.fecha)}</span>
                          </div>
                          <p className="text-sm text-foreground">{com.comentario}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-muted-foreground">
                    Fecha de solicitud
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(solicitudSeleccionada.fechaCreacion)} (
                    {calcularDiasDesde(solicitudSeleccionada.fechaCreacion)})
                  </p>
                </div>
              </div>
              <DialogFooter className="border-t border-border px-4 py-4 sm:justify-end sm:px-6">
                <Button
                  type="button"
                  onClick={() => setSolicitudSeleccionada(null)}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
