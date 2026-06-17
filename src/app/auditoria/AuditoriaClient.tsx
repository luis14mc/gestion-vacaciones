"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "next-auth";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";
import { notify } from '@/lib/swal';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface AuditoriaClientProps {
  session: Session;
}

interface RegistroAuditoria {
  id: number;
  usuario_id: number;
  accion: string;
  tabla_afectada: string;
  registro_id: number | null;
  detalles: string | null;
  ip_address: string | null;
  user_agent: string | null;
  fecha_creacion: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
  };
}

type TipoAccion = "todas" | "crear" | "actualizar" | "eliminar" | "login" | "logout";
type TablaAfectada = "todas" | "usuarios" | "solicitudes" | "balances" | "departamentos" | "tipos_ausencia";

export default function AuditoriaClient({ session }: AuditoriaClientProps) {
  const router = useRouter();
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [selectedLog, setSelectedLog] = useState<RegistroAuditoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroAccion, setFiltroAccion] = useState<TipoAccion>("todas");
  const [filtroTabla, setFiltroTabla] = useState<TablaAfectada>("todas");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const registrosPorPagina = 50;

  useEffect(() => {
    cargarRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual]);

  const cargarRegistros = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        pagina: paginaActual.toString(),
        limite: registrosPorPagina.toString(),
      });

      if (filtroAccion !== "todas") params.append("accion", filtroAccion);
      if (filtroTabla !== "todas") params.append("tabla", filtroTabla);
      if (fechaInicio) params.append("fechaInicio", fechaInicio);
      if (fechaFin) params.append("fechaFin", fechaFin);

      const res = await fetch(`/api/auditoria?${params}`);
      const data = await res.json();

      if (data.success) {
        setRegistros(data.data || []);
        setTotalPaginas(data.totalPaginas || 1);
      }
    } catch (error) {
      console.error("Error cargando registros:", error);
      notify.error("Error", "Error al cargar los registros de auditoría");
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    setPaginaActual(1);
    cargarRegistros();
  };

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFiltroAccion("todas");
    setFiltroTabla("todas");
    setFechaInicio("");
    setFechaFin("");
    setPaginaActual(1);
    setTimeout(() => cargarRegistros(), 100);
  };

  const verDetalles = (registro: RegistroAuditoria) => {
    setSelectedLog(registro);
  };

  const getIconoAccion = (accion: string) => {
    switch (accion.toLowerCase()) {
      case "crear":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "actualizar":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "eliminar":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "login":
        return <User className="w-4 h-4 text-blue-500" />;
      case "logout":
        return <User className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Activity className="w-4 h-4 text-foreground" />;
    }
  };

  const getBadgeVariant = (accion: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (accion.toLowerCase()) {
      case "crear":
        return "default"; // Will add bg-green-500 manually if wanted, or just default
      case "actualizar":
        return "default"; // bg-yellow-500
      case "eliminar":
        return "destructive";
      case "login":
        return "secondary";
      case "logout":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getBadgeColorClass = (accion: string) => {
    switch (accion.toLowerCase()) {
      case "crear":
        return "bg-green-500 hover:bg-green-600";
      case "actualizar":
        return "bg-amber-500 hover:bg-amber-600";
      case "login":
        return "bg-blue-500 hover:bg-blue-600 text-white";
      default:
        return "";
    }
  };

  // Filtrado local adicional por búsqueda de texto
  const registrosFiltrados = registros.filter((r) => {
    if (!searchTerm) return true;
    const termino = searchTerm.toLowerCase();
    return (
      r.usuario.nombre.toLowerCase().includes(termino) ||
      r.usuario.apellido.toLowerCase().includes(termino) ||
      r.usuario.email.toLowerCase().includes(termino) ||
      r.accion.toLowerCase().includes(termino) ||
      r.tabla_afectada.toLowerCase().includes(termino)
    );
  });

  // Estadísticas
  const totalRegistros = registros.length;
  const registrosHoy = registros.filter(r => {
    const fecha = new Date(r.fecha_creacion);
    const hoy = new Date();
    return fecha.toDateString() === hoy.toDateString();
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Auditoría del Sistema</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Registro detallado de todas las acciones realizadas en el sistema
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg text-primary">
                <Activity className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground font-medium">Registros Totales</p>
                <p className="text-2xl font-bold">{totalRegistros}</p>
                <p className="text-xs text-muted-foreground mt-1">En esta página</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                <Clock className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground font-medium">Acciones Hoy</p>
                <p className="text-2xl font-bold">{registrosHoy}</p>
                <p className="text-xs text-muted-foreground mt-1">En las últimas 24 horas</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground font-medium">Página Actual</p>
                <p className="text-2xl font-bold">{paginaActual}</p>
                <p className="text-xs text-muted-foreground mt-1">de {totalPaginas} páginas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl mb-6">
          <div className="p-4 sm:p-5">
            <h2 className="text-[13px] font-semibold mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros de Búsqueda
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {/* Búsqueda de texto */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Usuario, acción, tabla..."
                    className="w-full pl-9 h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtro por acción */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Acción</label>
                <Select
                  value={filtroAccion}
                  onValueChange={(val) => setFiltroAccion(val as TipoAccion)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Todas las acciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las acciones</SelectItem>
                    <SelectItem value="crear">Crear</SelectItem>
                    <SelectItem value="actualizar">Actualizar</SelectItem>
                    <SelectItem value="eliminar">Eliminar</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="login_fallido">Login fallido</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por tabla */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tabla Afectada</label>
                <Select
                  value={filtroTabla}
                  onValueChange={(val) => setFiltroTabla(val as TablaAfectada)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Todas las tablas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las tablas</SelectItem>
                    <SelectItem value="usuarios">Usuarios</SelectItem>
                    <SelectItem value="solicitudes">Solicitudes</SelectItem>
                    <SelectItem value="balances">Balances</SelectItem>
                    <SelectItem value="departamentos">Departamentos</SelectItem>
                    <SelectItem value="tipos_ausencia">Tipos de Ausencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha inicio */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Inicio</label>
                <Input
                  type="date"
                  className="h-10"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>

              {/* Fecha fin */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Fin</label>
                <Input
                  type="date"
                  className="h-10"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>

              {/* Botones */}
              <div className="space-y-2">
                <label className="text-sm font-medium hidden md:block">&nbsp;</label>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <Button
                    onClick={aplicarFiltros}
                    className="flex-1 h-10"
                  >
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={limpiarFiltros}
                    className="flex-1 h-10"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de registros */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl">
          <div className="p-5">
            <h2 className="text-[13px] font-semibold mb-4">
              Registros de Auditoría
            </h2>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead className="text-center">ID Registro</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-12 h-12 text-muted-foreground/30" />
                          <p className="text-muted-foreground">
                            No se encontraron registros de auditoría
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrosFiltrados.map((registro) => (
                      <TableRow key={registro.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {new Date(registro.fecha_creacion).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold">
                              {registro.usuario.nombre} {registro.usuario.apellido}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {registro.usuario.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getIconoAccion(registro.accion)}
                            <Badge variant={getBadgeVariant(registro.accion)} className={getBadgeColorClass(registro.accion)}>
                              {registro.accion}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {registro.tabla_afectada}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {registro.registro_id || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {registro.ip_address || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verDetalles(registro)}
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                >
                  Anterior
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pagina;
                    if (totalPaginas <= 5) {
                      pagina = i + 1;
                    } else if (paginaActual <= 3) {
                      pagina = i + 1;
                    } else if (paginaActual >= totalPaginas - 2) {
                      pagina = totalPaginas - 4 + i;
                    } else {
                      pagina = paginaActual - 2 + i;
                    }

                    return (
                      <Button
                        key={pagina}
                        variant={paginaActual === pagina ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaginaActual(pagina)}
                      >
                        {pagina}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Detail Modal */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Detalle de Auditoría</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 py-4">
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">Acción:</span>
                  <Badge variant={getBadgeVariant(selectedLog.accion)} className={getBadgeColorClass(selectedLog.accion)}>{selectedLog.accion}</Badge>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">Usuario:</span>
                  <span className="text-sm font-semibold min-[420px]:text-right">{selectedLog.usuario.nombre} {selectedLog.usuario.apellido}</span>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">Email:</span>
                  <span className="break-all text-sm font-medium min-[420px]:text-right">{selectedLog.usuario.email}</span>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">Tabla:</span>
                  <Badge variant="outline">{selectedLog.tabla_afectada}</Badge>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">ID Registro:</span>
                  <span className="font-medium text-sm">{selectedLog.registro_id || "N/A"}</span>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">Fecha:</span>
                  <span className="text-sm font-medium min-[420px]:text-right">{new Date(selectedLog.fecha_creacion).toLocaleString("es-ES")}</span>
                </div>
                <div className="grid gap-1 border-b pb-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
                  <span className="text-muted-foreground text-sm">IP:</span>
                  <span className="font-mono text-xs">{selectedLog.ip_address || "N/A"}</span>
                </div>
                {selectedLog.detalles && (
                  <div className="pt-2">
                    <span className="text-muted-foreground text-sm block mb-2">Detalles:</span>
                    <pre className="text-xs bg-muted p-3 rounded-xl overflow-x-auto border">
                      {JSON.stringify(JSON.parse(selectedLog.detalles), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLog(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
