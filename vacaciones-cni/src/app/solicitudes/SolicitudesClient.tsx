"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Hourglass
} from "lucide-react";
import Swal from "sweetalert2";

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
}

interface Stats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

export default function SolicitudesClient() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const itemsPorPagina = 20;

  // Detalles
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);

  useEffect(() => {
    cargarSolicitudes();
  }, [paginaActual, estadoFiltro, tipoFiltro, fechaInicio, fechaFin]);

  const cargarSolicitudes = async () => {
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
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      Swal.fire("Error", "No se pudieron cargar las solicitudes", "error");
    } finally {
      setLoading(false);
    }
  };

  // No filtrar localmente, mostrar lo que viene del servidor
  const solicitudesFiltradas = solicitudes || [];

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; text: string; icon: any }> = {
      pendiente: { class: "badge-warning", text: "Pendiente", icon: Clock },
      aprobada_jefe: { class: "badge-info", text: "Aprobada por Jefe", icon: CheckCircle },
      aprobada: { class: "badge-success", text: "Aprobada", icon: Check },
      rechazada_jefe: { class: "badge-error", text: "Rechazada por Jefe", icon: XCircle },
      rechazada: { class: "badge-error", text: "Rechazada", icon: X },
      en_uso: { class: "badge-primary", text: "En uso", icon: Hourglass },
      completada: { class: "badge-neutral", text: "Completada", icon: CheckCircle },
    };
    const config = badges[estado] || { class: "badge-ghost", text: estado, icon: AlertCircle };
    const Icon = config.icon;
    return (
      <div className={`badge ${config.class} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </div>
    );
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const calcularDiasDesde = (fecha: string) => {
    const diff = Date.now() - new Date(fecha).getTime();
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (dias === 0) return "Hoy";
    if (dias === 1) return "Hace 1 día";
    if (dias < 30) return `Hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    if (meses === 1) return "Hace 1 mes";
    return `Hace ${meses} meses`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-primary to-secondary p-4 rounded-2xl shadow-lg">
            <FileText className="w-8 h-8 text-primary-content" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-base-content">Solicitudes de Vacaciones</h1>
            <p className="text-base-content/70">Gestión y seguimiento de todas las solicitudes</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost gap-2"
          >
            ← Volver
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-primary">
              <FileText className="w-8 h-8" />
            </div>
            <div className="stat-title">Total</div>
            <div className="stat-value text-primary">{stats.total}</div>
            <div className="stat-desc">Todas las solicitudes</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-warning">
              <Clock className="w-8 h-8" />
            </div>
            <div className="stat-title">Pendientes</div>
            <div className="stat-value text-warning">{stats.pendientes}</div>
            <div className="stat-desc">En revisión</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-success">
              <Check className="w-8 h-8" />
            </div>
            <div className="stat-title">Aprobadas</div>
            <div className="stat-value text-success">{stats.aprobadas}</div>
            <div className="stat-desc">Confirmadas</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-error">
              <X className="w-8 h-8" />
            </div>
            <div className="stat-title">Rechazadas</div>
            <div className="stat-value text-error">{stats.rechazadas}</div>
            <div className="stat-desc">Denegadas</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">
              <Filter className="w-5 h-5" />
              Filtros de búsqueda
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Buscar (presiona Enter)</span>
                </label>
                <input
                  type="text"
                  placeholder="Usuario, tipo, motivo..."
                  className="input input-bordered w-full"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPaginaActual(1);
                      cargarSolicitudes();
                    }
                  }}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Estado</span>
                </label>
                <select
                  className="select select-bordered"
                  value={estadoFiltro}
                  onChange={(e) => {
                    setEstadoFiltro(e.target.value);
                    setPaginaActual(1);
                  }}
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada_jefe">Aprobada por Jefe</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada_jefe">Rechazada por Jefe</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="en_uso">En uso</option>
                  <option value="completada">Completada</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Fecha inicio</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Fecha fin</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">&nbsp;</span>
                </label>
                <button
                  className="btn btn-ghost"
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
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de solicitudes */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Listado de solicitudes ({stats.total})
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : solicitudesFiltradas.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
                <p className="text-base-content/60">No se encontraron solicitudes</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Tipo</th>
                        <th>Período</th>
                        <th>Días</th>
                        <th>Estado</th>
                        <th>Solicitado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudesFiltradas.map((sol) => (
                        <tr key={sol.id} className="hover">
                          <td>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-base-content/50" />
                              <span className="font-medium">{sol.usuario}</span>
                            </div>
                          </td>
                          <td>
                            <div className="badge badge-outline">{sol.tipoAusencia}</div>
                          </td>
                          <td>
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatearFecha(sol.fechaInicio)}
                              </div>
                              <div className="text-base-content/50 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatearFecha(sol.fechaFin)}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="badge badge-primary">{sol.dias} días</div>
                          </td>
                          <td>{getEstadoBadge(sol.estado)}</td>
                          <td>
                            <div className="text-xs text-base-content/60">
                              {calcularDiasDesde(sol.fechaCreacion)}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm gap-1"
                              onClick={() => setSolicitudSeleccionada(sol)}
                            >
                              <Eye className="w-4 h-4" />
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    className="btn btn-sm"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalles */}
      {solicitudSeleccionada && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Detalles de la Solicitud
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-text font-semibold">Usuario</label>
                  <p className="text-base-content">{solicitudSeleccionada.usuario}</p>
                </div>
                <div>
                  <label className="label label-text font-semibold">Tipo de ausencia</label>
                  <p className="text-base-content">{solicitudSeleccionada.tipoAusencia}</p>
                </div>
                <div>
                  <label className="label label-text font-semibold">Fecha inicio</label>
                  <p className="text-base-content">{formatearFecha(solicitudSeleccionada.fechaInicio)}</p>
                </div>
                <div>
                  <label className="label label-text font-semibold">Fecha fin</label>
                  <p className="text-base-content">{formatearFecha(solicitudSeleccionada.fechaFin)}</p>
                </div>
                <div>
                  <label className="label label-text font-semibold">Días solicitados</label>
                  <p className="text-base-content">{solicitudSeleccionada.dias} días</p>
                </div>
                <div>
                  <label className="label label-text font-semibold">Estado</label>
                  <div>{getEstadoBadge(solicitudSeleccionada.estado)}</div>
                </div>
              </div>

              {solicitudSeleccionada.motivo && (
                <div>
                  <label className="label label-text font-semibold">Motivo</label>
                  <p className="text-base-content bg-base-200 p-3 rounded">{solicitudSeleccionada.motivo}</p>
                </div>
              )}

              {solicitudSeleccionada.aprobadorJefe && (
                <div>
                  <label className="label label-text font-semibold">Aprobado por Jefe</label>
                  <p className="text-base-content">{solicitudSeleccionada.aprobadorJefe}</p>
                  {solicitudSeleccionada.fechaAprobacionJefe && (
                    <p className="text-sm text-base-content/60">
                      {formatearFecha(solicitudSeleccionada.fechaAprobacionJefe)}
                    </p>
                  )}
                  {solicitudSeleccionada.comentariosJefe && (
                    <p className="text-sm bg-base-200 p-2 rounded mt-1">{solicitudSeleccionada.comentariosJefe}</p>
                  )}
                </div>
              )}

              {solicitudSeleccionada.aprobadorRrhh && (
                <div>
                  <label className="label label-text font-semibold">Aprobado por RRHH</label>
                  <p className="text-base-content">{solicitudSeleccionada.aprobadorRrhh}</p>
                  {solicitudSeleccionada.fechaAprobacionRrhh && (
                    <p className="text-sm text-base-content/60">
                      {formatearFecha(solicitudSeleccionada.fechaAprobacionRrhh)}
                    </p>
                  )}
                  {solicitudSeleccionada.comentariosRrhh && (
                    <p className="text-sm bg-base-200 p-2 rounded mt-1">{solicitudSeleccionada.comentariosRrhh}</p>
                  )}
                </div>
              )}

              <div>
                <label className="label label-text font-semibold">Fecha de solicitud</label>
                <p className="text-sm text-base-content/60">
                  {formatearFecha(solicitudSeleccionada.fechaCreacion)} ({calcularDiasDesde(solicitudSeleccionada.fechaCreacion)})
                </p>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setSolicitudSeleccionada(null)}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSolicitudSeleccionada(null)}></div>
        </div>
      )}
    </div>
  );
}
