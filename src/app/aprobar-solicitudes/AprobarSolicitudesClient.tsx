"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  User,
  Clock,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Info,
} from "lucide-react";
import { notify } from "@/lib/swal";
import {
  determinarAccionAprobacion,
  esEstadoAccionableAprobacion,
  etiquetaBotonAprobacion,
  etiquetaEstadoBandeja,
} from '@/lib/domain/aprobacion-inbox';
import type { Session } from "next-auth";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Solicitud {
  id: number;
  codigo: string;
  usuarioId: number;
  tipoAusenciaId: number;
  fechaInicio: string;
  fechaFin: string;
  cantidad: string;
  unidad: string;
  motivo: string | null;
  estado: string;
  comentariosJefe: string | null;
  comentariosRrhh: string | null;
  createdAt: string;
  metadata?: any;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    departamento?: {
      id: number;
      nombre: string;
    };
  };
  tipoAusencia: {
    id: number;
    nombre: string;
    tipo: string;
  };
}

interface Stats {
  total: number;
  pendientes: number;
  aprobadas_hoy: number;
  rechazadas_hoy: number;
}

interface AprobarSolicitudesClientProps {
  session: Session;
}

export default function AprobarSolicitudesClient({
  session,
}: AprobarSolicitudesClientProps) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pendientes: 0,
    aprobadas_hoy: 0,
    rechazadas_hoy: 0,
  });
  const [loading, setLoading] = useState(true);

  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const itemsPorPagina = 10;

  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<Solicitud | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  const [comentarios, setComentarios] = useState("");

  useEffect(() => {
    cargarSolicitudes();
  }, [paginaActual]);

  async function cargarSolicitudes() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: paginaActual.toString(),
        pageSize: itemsPorPagina.toString(),
        paraAprobar: "true",
        _t: Date.now().toString(),
      });

      const response = await fetch(`/api/solicitudes?${params}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        const filtradas = (data.data || []).filter((s: Solicitud) =>
          esEstadoAccionableAprobacion(s.estado)
        );
        setSolicitudes(filtradas);
        setStats({
          total: data.total ?? filtradas.length,
          pendientes: data.stats?.pendientes ?? data.total ?? filtradas.length,
          aprobadas_hoy: data.stats?.aprobadas_hoy ?? 0,
          rechazadas_hoy: data.stats?.rechazadas_hoy ?? 0,
        });
        setTotalPaginas(data.totalPages || 1);
      } else {
        console.error("Error en respuesta:", data.error);
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      notify.error(
        "No se pudieron cargar las solicitudes. Intenta refrescar la página."
      );
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAprobacion = (
    solicitud: Solicitud,
    accionSeleccionada: "aprobar" | "rechazar"
  ) => {
    setSolicitudSeleccionada(solicitud);
    setAccion(accionSeleccionada);
    setComentarios("");
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setAccion(null);
    setComentarios("");
  };

  const determinarAccionBackend = (
    tipoAccion: "aprobar" | "rechazar",
    estadoSolicitud: string
  ): string => {
    try {
      return determinarAccionAprobacion(tipoAccion, estadoSolicitud);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("La solicitud ya no está pendiente de aprobación");
    }
  };

  const getEtiquetaBoton = (estado: string): string => etiquetaBotonAprobacion(estado);

  const getEtiquetaEstado = (estado: string): string => etiquetaEstadoBandeja(estado);

  const puedeAccionar = (estado: string) => esEstadoAccionableAprobacion(estado);

  const procesarSolicitud = async () => {
    if (!solicitudSeleccionada || !accion) return;

    if (accion === "rechazar" && !comentarios.trim()) {
      notify.warning(
        "Debes proporcionar un motivo para rechazar la solicitud"
      );
      return;
    }

    try {
      if (!puedeAccionar(solicitudSeleccionada.estado)) {
        notify.error("La solicitud ya no está pendiente de aprobación");
        await cargarSolicitudes();
        return;
      }

      const accionBackend = determinarAccionBackend(
        accion,
        solicitudSeleccionada.estado
      );

      const response = await fetch(
        `/api/solicitudes/${solicitudSeleccionada.id}/accion`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: accionBackend,
            comentario: comentarios.trim() || null,
            motivoRechazo:
              accion === "rechazar" ? comentarios.trim() : undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMostrarModal(false);
        setSolicitudSeleccionada(null);
        setAccion(null);
        setComentarios("");

        notify.success(
          `La solicitud ha sido ${
            accion === "aprobar" ? "aprobada" : "rechazada"
          } correctamente`
        );

        await cargarSolicitudes();
      } else {
        notify.error(
          data.error || "No se pudo procesar la solicitud. Intenta de nuevo."
        );
      }
    } catch (error) {
      console.error("Error al procesar solicitud:", error);
      notify.error(
        "No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo."
      );
    }
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const [ahora] = useState(() => Date.now());

  const calcularDiasDesde = (fecha: string) => {
    const diff = ahora - new Date(fecha).getTime();
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (dias === 0) return "Hoy";
    if (dias === 1) return "Hace 1 día";
    return `Hace ${dias} días`;
  };

  return (
    <div>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-muted p-2.5">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Aprobar Solicitudes
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Revisa y gestiona las solicitudes pendientes de tu equipo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <Clock className="h-8 w-8 text-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {stats.pendientes}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requieren tu aprobación
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <Check className="h-8 w-8 text-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">Aprobadas Hoy</p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {stats.aprobadas_hoy}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Procesadas con éxito
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <X className="h-8 w-8 text-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">Rechazadas Hoy</p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {stats.rechazadas_hoy}
                  </p>
                  <p className="text-xs text-muted-foreground">Denegadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-semibold">
              Solicitudes Pendientes ({stats.pendientes})
            </CardTitle>
            <CardDescription className="sr-only">
              Lista de solicitudes que requieren tu decisión
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground"
                  role="status"
                  aria-label="Cargando"
                />
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground/20" />
                <p className="text-lg font-medium text-muted-foreground">
                  ¡Todo al día!
                </p>
                <p className="text-sm text-muted-foreground">
                  No hay solicitudes pendientes de aprobación
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Días</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Solicitado</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitudes.map((sol) => (
                        <TableRow
                          key={sol.id}
                          className="odd:bg-muted/30"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {sol.usuario?.nombre} {sol.usuario?.apellido}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sol.tipoAusencia?.nombre || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1 text-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatearFecha(sol.fechaInicio)}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatearFecha(sol.fechaFin)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">
                              {sol.cantidad} días
                            </Badge>
                          </TableCell>
                          <TableCell>
                              <Badge
                              variant="outline"
                              className={
                                sol.estado === "pendiente_jefe"
                                  ? "border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                                  : sol.estado === "aprobada_rrhh"
                                  ? "border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
                                  : "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                              }
                            >
                              {getEtiquetaEstado(sol.estado)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              {calcularDiasDesde(sol.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              {puedeAccionar(sol.estado) ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 text-white hover:bg-green-700"
                                    onClick={() =>
                                      abrirModalAprobacion(sol, "aprobar")
                                    }
                                    title="Aprobar"
                                  >
                                    <Check className="h-4 w-4" />
                                    {getEtiquetaBoton(sol.estado)}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      abrirModalAprobacion(sol, "rechazar")
                                    }
                                    title="Rechazar"
                                  >
                                    <X className="h-4 w-4" />
                                    Rechazar
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setSolicitudSeleccionada(sol);
                                  setMostrarModal(true);
                                  setAccion(null);
                                }}
                                aria-label="Ver detalles"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4 lg:hidden">
                  {solicitudes.map((sol) => (
                    <Card key={sol.id} className="bg-card">
                      <CardContent className="pt-6">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="font-bold text-base text-foreground">
                                {sol.usuario?.nombre} {sol.usuario?.apellido}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {sol.tipoAusencia?.nombre || "N/A"}
                            </Badge>
                          </div>
                          <Badge variant="default" className="shrink-0">
                            {sol.cantidad} días
                          </Badge>
                        </div>

                        <div className="mb-3 space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Inicio:</span>
                            <span className="font-medium text-foreground">
                              {formatearFecha(sol.fechaInicio)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Fin:</span>
                            <span className="font-medium text-foreground">
                              {formatearFecha(sol.fechaFin)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Solicitado {calcularDiasDesde(sol.createdAt)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                          {puedeAccionar(sol.estado) ? (
                            <>
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                                onClick={() =>
                                  abrirModalAprobacion(sol, "aprobar")
                                }
                              >
                                <Check className="h-4 w-4" />
                                {getEtiquetaBoton(sol.estado)}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                                onClick={() =>
                                  abrirModalAprobacion(sol, "rechazar")
                                }
                              >
                                <X className="h-4 w-4" />
                                Rechazar
                              </Button>
                            </>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSolicitudSeleccionada(sol);
                              setMostrarModal(true);
                              setAccion(null);
                            }}
                            aria-label="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {totalPaginas > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPaginaActual((p) => Math.max(1, p - 1))
                      }
                      disabled={paginaActual === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPaginaActual((p) =>
                          Math.min(totalPaginas, p + 1)
                        )
                      }
                      disabled={paginaActual === totalPaginas}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={mostrarModal && !!solicitudSeleccionada}
        onOpenChange={(open) => {
          if (!open) cerrarModal();
        }}
      >
        <DialogContent
          className="sm:max-w-2xl"
          showCloseButton
        >
          {solicitudSeleccionada && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {accion ? (
                    accion === "aprobar" ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        Aprobar Solicitud
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 text-destructive" />
                        Rechazar Solicitud
                      </>
                    )
                  ) : (
                    <>
                      <FileText className="h-6 w-6 text-foreground" />
                      Detalles de la Solicitud
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl bg-muted/50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-foreground">Colaborador</Label>
                      <p className="text-sm text-foreground">
                        {solicitudSeleccionada.usuario?.nombre}{" "}
                        {solicitudSeleccionada.usuario?.apellido}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">
                        Tipo de ausencia
                      </Label>
                      <p className="text-sm text-foreground">
                        {solicitudSeleccionada.tipoAusencia?.nombre}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">Fecha inicio</Label>
                      <p className="text-sm text-foreground">
                        {formatearFecha(solicitudSeleccionada.fechaInicio)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">Fecha fin</Label>
                      <p className="text-sm text-foreground">
                        {formatearFecha(solicitudSeleccionada.fechaFin)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">Días solicitados</Label>
                      <p className="text-sm font-bold text-foreground">
                        {solicitudSeleccionada.cantidad} días
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">Fecha de solicitud</Label>
                      <p className="text-sm text-muted-foreground">
                        {formatearFecha(solicitudSeleccionada.createdAt)}
                      </p>
                    </div>
                  </div>

                  {solicitudSeleccionada.motivo && (
                    <div className="mt-4 space-y-1">
                      <Label className="text-foreground">
                        Motivo del colaborador
                      </Label>
                      <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                        {solicitudSeleccionada.motivo}
                      </p>
                    </div>
                  )}

                  {solicitudSeleccionada.metadata?.comentarios && solicitudSeleccionada.metadata.comentarios.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-foreground">Historial de Comentarios</Label>
                      <div className="space-y-3 rounded-md bg-muted p-3">
                        {solicitudSeleccionada.metadata.comentarios.map((com: any, i: number) => (
                          <div key={i} className="flex flex-col space-y-1 pb-3 last:pb-0 border-b last:border-0 border-border">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-xs font-semibold uppercase text-primary">{com.accion.replace('_', ' ')}</span>
                              <span className="text-xs text-muted-foreground">{formatearFecha(com.fecha)}</span>
                            </div>
                            <p className="text-sm text-foreground">{com.comentario}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {accion && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="comentarios-aprobacion"
                      className="flex items-center gap-2 font-semibold text-foreground"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Comentarios{" "}
                      {accion === "rechazar" && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Textarea
                      id="comentarios-aprobacion"
                      className="min-h-24"
                      placeholder={
                        accion === "aprobar"
                          ? "Comentarios opcionales..."
                          : "Indica el motivo del rechazo..."
                      }
                      value={comentarios}
                      onChange={(e) => setComentarios(e.target.value)}
                    />
                    {accion === "rechazar" && (
                      <p className="text-xs text-destructive">
                        El motivo es obligatorio para rechazar
                      </p>
                    )}
                  </div>
                )}

                {!accion && (
                  <div
                    className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground sm:p-4"
                    role="status"
                  >
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <span>
                      Revisa los detalles y usa los botones de aprobar/rechazar
                      en la tabla
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                {accion ? (
                  <>
                    <Button variant="ghost" onClick={cerrarModal}>
                      Cancelar
                    </Button>
                    {accion === "aprobar" ? (
                      <Button
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={procesarSolicitud}
                      >
                        <Check className="h-4 w-4" />
                        Confirmar Aprobación
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={procesarSolicitud}
                      >
                        <X className="h-4 w-4" />
                        Confirmar Rechazo
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="default" onClick={cerrarModal}>
                    Cerrar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
