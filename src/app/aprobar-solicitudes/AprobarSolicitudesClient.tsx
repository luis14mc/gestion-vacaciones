"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, 
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
  MessageSquare,
  Info
} from "lucide-react";
import Swal from "sweetalert2";
import type { Session } from "next-auth";

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

export default function AprobarSolicitudesClient({ session }: AprobarSolicitudesClientProps) {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendientes: 0, aprobadas_hoy: 0, rechazadas_hoy: 0 });
  const [loading, setLoading] = useState(true);
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const itemsPorPagina = 10;

  // Detalles y acciones
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  const [comentarios, setComentarios] = useState("");

  useEffect(() => {
    cargarSolicitudes();
  }, [paginaActual]);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: paginaActual.toString(),
        pageSize: itemsPorPagina.toString(),
        paraAprobar: "true", // Indica que es para aprobar
        _t: Date.now().toString() // Evitar caché
      });

      const response = await fetch(`/api/solicitudes?${params}`, {
        cache: 'no-store' // Forzar sin caché
      });
      const data = await response.json();

      console.log('📊 Respuesta de solicitudes:', data);
      console.log('📋 Solicitudes recibidas:', data.data?.map((s: any) => ({ 
        id: s.id, 
        codigo: s.codigo, 
        estado: s.estado,
        usuario: s.usuario?.nombre 
      })));

      if (data.success) {
        setSolicitudes(data.data || []);
        setStats({
          total: data.total || 0,
          pendientes: data.total || 0,
          aprobadas_hoy: 0,
          rechazadas_hoy: 0,
        });
        setTotalPaginas(data.totalPages || 1);
      } else {
        console.error('Error en respuesta:', data.error);
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      await Swal.fire({
        icon: "error",
        title: "Error al Cargar",
        text: "No se pudieron cargar las solicitudes. Intenta refrescar la página.",
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#ef4444"
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAprobacion = (solicitud: Solicitud, accionSeleccionada: "aprobar" | "rechazar") => {
    setSolicitudSeleccionada(solicitud);
    setAccion(accionSeleccionada);
    setComentarios("");
    setMostrarModal(true);
  };

  const procesarSolicitud = async () => {
    if (!solicitudSeleccionada || !accion) return;

    if (accion === "rechazar" && !comentarios.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Campo Requerido",
        text: "Debes proporcionar un motivo para rechazar la solicitud",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }

    try {
      // Determinar acción según el rol del usuario
      let accionBackend: string;
      
      if (accion === "rechazar") {
        accionBackend = "rechazar";
      } else {
        // accion === "aprobar"
        if (session.user.esRrhh) {
          accionBackend = "aprobar_rrhh";
        } else {
          accionBackend = "aprobar_jefe";
        }
      }
      
      const response = await fetch(`/api/solicitudes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: solicitudSeleccionada.id,
          accion: accionBackend,
          motivo: comentarios.trim() || null,
        }),
      });

      const data = await response.json();

      console.log('📊 Respuesta del servidor:', data);

      if (data.success) {
        // Cerrar modal antes de mostrar alerta
        setMostrarModal(false);
        setSolicitudSeleccionada(null);
        setAccion(null);
        setComentarios("");
        
        // Mostrar alerta de éxito
        await Swal.fire({
          icon: "success",
          title: accion === "aprobar" ? "¡Solicitud Aprobada!" : "Solicitud Rechazada",
          text: data.message || `La solicitud ha sido ${accion === "aprobar" ? "aprobada" : "rechazada"} correctamente`,
          confirmButtonText: "Aceptar",
          confirmButtonColor: accion === "aprobar" ? "#10b981" : "#ef4444",
          timer: 3000,
          timerProgressBar: true
        });
        
        // Recargar lista de solicitudes
        console.log('🔄 Recargando solicitudes...');
        await cargarSolicitudes();
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error al Procesar",
          text: data.error || "No se pudo procesar la solicitud. Intenta de nuevo.",
          confirmButtonText: "Cerrar",
          confirmButtonColor: "#ef4444"
        });
      }
    } catch (error) {
      console.error("Error al procesar solicitud:", error);
      await Swal.fire({
        icon: "error",
        title: "Error de Conexión",
        text: "No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.",
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#ef4444"
      });
    }
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
    return `Hace ${dias} días`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-warning to-warning/70 p-4 rounded-2xl shadow-lg">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-base-content">Aprobar Solicitudes</h1>
            <p className="text-base-content/70">Revisa y gestiona las solicitudes pendientes de tu equipo</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost gap-2"
          >
            ← Volver
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-warning">
              <Clock className="w-8 h-8" />
            </div>
            <div className="stat-title">Pendientes</div>
            <div className="stat-value text-warning">{stats.pendientes}</div>
            <div className="stat-desc">Requieren tu aprobación</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-success">
              <Check className="w-8 h-8" />
            </div>
            <div className="stat-title">Aprobadas Hoy</div>
            <div className="stat-value text-success">{stats.aprobadas_hoy}</div>
            <div className="stat-desc">Procesadas con éxito</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-error">
              <X className="w-8 h-8" />
            </div>
            <div className="stat-title">Rechazadas Hoy</div>
            <div className="stat-value text-error">{stats.rechazadas_hoy}</div>
            <div className="stat-desc">Denegadas</div>
          </div>
        </div>

        {/* Tabla de solicitudes */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Solicitudes Pendientes ({stats.total})
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto text-success/20 mb-4" />
                <p className="text-lg font-medium text-base-content/60">¡Todo al día!</p>
                <p className="text-sm text-base-content/40">No hay solicitudes pendientes de aprobación</p>
              </div>
            ) : (
              <>
                {/* Vista Desktop - Tabla */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Tipo</th>
                        <th>Período</th>
                        <th>Días</th>
                        <th>Solicitado</th>
                        <th className="text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudes.map((sol) => (
                        <tr key={sol.id} className="hover">
                          <td>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-base-content/50" />
                              <span className="font-medium">
                                {sol.usuario?.nombre} {sol.usuario?.apellido}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="badge badge-outline">
                              {sol.tipoAusencia?.nombre || 'N/A'}
                            </div>
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
                            <div className="badge badge-primary">{sol.cantidad} días</div>
                          </td>
                          <td>
                            <div className="text-xs text-base-content/60">
                              {calcularDiasDesde(sol.createdAt)}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2 justify-center">
                              <button
                                className="btn btn-sm btn-success gap-1"
                                onClick={() => abrirModalAprobacion(sol, "aprobar")}
                                title="Aprobar"
                              >
                                <Check className="w-4 h-4" />
                                Aprobar
                              </button>
                              <button
                                className="btn btn-sm btn-error gap-1"
                                onClick={() => abrirModalAprobacion(sol, "rechazar")}
                                title="Rechazar"
                              >
                                <X className="w-4 h-4" />
                                Rechazar
                              </button>
                              <button
                                className="btn btn-sm btn-ghost gap-1"
                                onClick={() => {
                                  setSolicitudSeleccionada(sol);
                                  setMostrarModal(true);
                                  setAccion(null);
                                }}
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Mobile - Tarjetas */}
                <div className="lg:hidden space-y-4">
                  {solicitudes.map((sol) => (
                    <div key={sol.id} className="card bg-base-200 shadow-md">
                      <div className="card-body p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-base-content/50" />
                              <span className="font-bold text-base">
                                {sol.usuario?.nombre} {sol.usuario?.apellido}
                              </span>
                            </div>
                            <div className="badge badge-outline badge-sm">
                              {sol.tipoAusencia?.nombre || 'N/A'}
                            </div>
                          </div>
                          <div className="badge badge-primary">{sol.cantidad} días</div>
                        </div>

                        {/* Fechas */}
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3 h-3 text-base-content/50" />
                            <span className="text-base-content/70">Inicio:</span>
                            <span className="font-medium">{formatearFecha(sol.fechaInicio)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3 h-3 text-base-content/50" />
                            <span className="text-base-content/70">Fin:</span>
                            <span className="font-medium">{formatearFecha(sol.fechaFin)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-base-content/60">
                            <Clock className="w-3 h-3" />
                            Solicitado {calcularDiasDesde(sol.createdAt)}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2">
                          <button
                            className="btn btn-success btn-sm flex-1 gap-1"
                            onClick={() => abrirModalAprobacion(sol, "aprobar")}
                          >
                            <Check className="w-4 h-4" />
                            Aprobar
                          </button>
                          <button
                            className="btn btn-error btn-sm flex-1 gap-1"
                            onClick={() => abrirModalAprobacion(sol, "rechazar")}
                          >
                            <X className="w-4 h-4" />
                            Rechazar
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setSolicitudSeleccionada(sol);
                              setMostrarModal(true);
                              setAccion(null);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginación */}
                {totalPaginas > 1 && (
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
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalles/aprobación */}
      {mostrarModal && solicitudSeleccionada && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              {accion ? (
                accion === "aprobar" ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-success" />
                    Aprobar Solicitud
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-error" />
                    Rechazar Solicitud
                  </>
                )
              ) : (
                <>
                  <FileText className="w-6 h-6 text-primary" />
                  Detalles de la Solicitud
                </>
              )}
            </h3>

            <div className="space-y-4">
              {/* Información de la solicitud */}
              <div className="bg-base-200 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label label-text font-semibold">Colaborador</label>
                    <p className="text-base-content">
                      {solicitudSeleccionada.usuario?.nombre} {solicitudSeleccionada.usuario?.apellido}
                    </p>
                  </div>
                  <div>
                    <label className="label label-text font-semibold">Tipo de ausencia</label>
                    <p className="text-base-content">{solicitudSeleccionada.tipoAusencia?.nombre}</p>
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
                    <p className="text-base-content font-bold">{solicitudSeleccionada.cantidad} días</p>
                  </div>
                  <div>
                    <label className="label label-text font-semibold">Fecha de solicitud</label>
                    <p className="text-sm text-base-content/60">
                      {formatearFecha(solicitudSeleccionada.createdAt)}
                    </p>
                  </div>
                </div>

                {solicitudSeleccionada.motivo && (
                  <div className="mt-4">
                    <label className="label label-text font-semibold">Motivo del colaborador</label>
                    <p className="text-base-content bg-base-100 p-3 rounded">{solicitudSeleccionada.motivo}</p>
                  </div>
                )}
              </div>

              {/* Formulario de aprobación/rechazo */}
              {accion && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Comentarios {accion === "rechazar" && <span className="text-error">*</span>}
                    </span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-24"
                    placeholder={accion === "aprobar" ? "Comentarios opcionales..." : "Indica el motivo del rechazo..."}
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                  ></textarea>
                  {accion === "rechazar" && (
                    <label className="label">
                      <span className="label-text-alt text-error">El motivo es obligatorio para rechazar</span>
                    </label>
                  )}
                </div>
              )}

              {!accion && (
                <div className="alert alert-info">
                  <Info className="w-5 h-5" />
                  <span>Revisa los detalles y usa los botones de aprobar/rechazar en la tabla</span>
                </div>
              )}
            </div>

            <div className="modal-action">
              {accion ? (
                <>
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => {
                      setMostrarModal(false);
                      setAccion(null);
                      setComentarios("");
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className={`btn ${accion === "aprobar" ? "btn-success" : "btn-error"}`}
                    onClick={procesarSolicitud}
                  >
                    {accion === "aprobar" ? (
                      <>
                        <Check className="w-4 h-4" />
                        Confirmar Aprobación
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        Confirmar Rechazo
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => setMostrarModal(false)}>
                  Cerrar
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => {
            setMostrarModal(false);
            setAccion(null);
            setComentarios("");
          }}></div>
        </div>
      )}
    </div>
  );
}
