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
import Swal from "sweetalert2";

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
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al cargar los registros de auditoría",
      });
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

  const verDetalles = async (registro: RegistroAuditoria) => {
    await Swal.fire({
      title: `Detalles de ${registro.accion}`,
      html: `
        <div class="text-left space-y-2">
          <p><strong>Usuario:</strong> ${registro.usuario.nombre} ${registro.usuario.apellido}</p>
          <p><strong>Email:</strong> ${registro.usuario.email}</p>
          <p><strong>Acción:</strong> ${registro.accion}</p>
          <p><strong>Tabla:</strong> ${registro.tabla_afectada}</p>
          <p><strong>ID Registro:</strong> ${registro.registro_id || "N/A"}</p>
          <p><strong>Fecha:</strong> ${new Date(registro.fecha_creacion).toLocaleString("es-ES")}</p>
          <p><strong>IP:</strong> ${registro.ip_address || "N/A"}</p>
          ${registro.detalles ? `<p><strong>Detalles:</strong><br><pre class="text-xs bg-base-200 p-2 rounded mt-1">${JSON.stringify(JSON.parse(registro.detalles), null, 2)}</pre></p>` : ""}
        </div>
      `,
      width: 600,
      confirmButtonText: "Cerrar",
    });
  };

  const getIconoAccion = (accion: string) => {
    switch (accion.toLowerCase()) {
      case "crear":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "actualizar":
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case "eliminar":
        return <XCircle className="w-4 h-4 text-error" />;
      case "login":
        return <User className="w-4 h-4 text-info" />;
      case "logout":
        return <User className="w-4 h-4 text-base-content/50" />;
      default:
        return <Activity className="w-4 h-4 text-base-content" />;
    }
  };

  const getBadgeAccion = (accion: string) => {
    switch (accion.toLowerCase()) {
      case "crear":
        return "badge-success";
      case "actualizar":
        return "badge-warning";
      case "eliminar":
        return "badge-error";
      case "login":
        return "badge-info";
      case "logout":
        return "badge-ghost";
      default:
        return "badge-neutral";
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
      <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-warning to-warning/80 text-warning-content">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Auditoría del Sistema</h1>
              <p className="text-base-content/70">
                Registro detallado de todas las acciones realizadas en el sistema
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost"
          >
            ← Volver
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-primary">
              <Activity className="w-8 h-8" />
            </div>
            <div className="stat-title">Registros Totales</div>
            <div className="stat-value text-primary">{totalRegistros}</div>
            <div className="stat-desc">En esta página</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-info">
              <Clock className="w-8 h-8" />
            </div>
            <div className="stat-title">Acciones Hoy</div>
            <div className="stat-value text-info">{registrosHoy}</div>
            <div className="stat-desc">En las últimas 24 horas</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-secondary">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="stat-title">Página Actual</div>
            <div className="stat-value text-secondary">{paginaActual}</div>
            <div className="stat-desc">de {totalPaginas} páginas</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">
              <Filter className="w-5 h-5" />
              Filtros de Búsqueda
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Búsqueda de texto */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Buscar</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                  <input
                    type="text"
                    placeholder="Usuario, acción, tabla..."
                    className="input input-bordered w-full pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtro por acción */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tipo de Acción</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filtroAccion}
                  onChange={(e) => setFiltroAccion(e.target.value as TipoAccion)}
                >
                  <option value="todas">Todas las acciones</option>
                  <option value="crear">Crear</option>
                  <option value="actualizar">Actualizar</option>
                  <option value="eliminar">Eliminar</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                </select>
              </div>

              {/* Filtro por tabla */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tabla Afectada</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filtroTabla}
                  onChange={(e) => setFiltroTabla(e.target.value as TablaAfectada)}
                >
                  <option value="todas">Todas las tablas</option>
                  <option value="usuarios">Usuarios</option>
                  <option value="solicitudes">Solicitudes</option>
                  <option value="balances">Balances</option>
                  <option value="departamentos">Departamentos</option>
                  <option value="tipos_ausencia">Tipos de Ausencia</option>
                </select>
              </div>

              {/* Fecha inicio */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Fecha Inicio</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>

              {/* Fecha fin */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Fecha Fin</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>

              {/* Botones */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">&nbsp;</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={aplicarFiltros}
                    className="btn btn-primary flex-1"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={limpiarFiltros}
                    className="btn btn-ghost"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de registros */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Registros de Auditoría
            </h2>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Tabla</th>
                    <th>ID Registro</th>
                    <th>IP</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-12 h-12 text-base-content/30" />
                          <p className="text-base-content/60">
                            No se encontraron registros de auditoría
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    registrosFiltrados.map((registro) => (
                      <tr key={registro.id} className="hover">
                        <td>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-base-content/50" />
                            {new Date(registro.fecha_creacion).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="font-semibold">
                              {registro.usuario.nombre} {registro.usuario.apellido}
                            </div>
                            <div className="text-sm text-base-content/60">
                              {registro.usuario.email}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {getIconoAccion(registro.accion)}
                            <span className={`badge ${getBadgeAccion(registro.accion)}`}>
                              {registro.accion}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-outline">
                            {registro.tabla_afectada}
                          </span>
                        </td>
                        <td className="text-center">
                          {registro.registro_id || "—"}
                        </td>
                        <td className="font-mono text-xs">
                          {registro.ip_address || "—"}
                        </td>
                        <td>
                          <button
                            onClick={() => verDetalles(registro)}
                            className="btn btn-ghost btn-sm"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="btn btn-sm"
                >
                  Anterior
                </button>
                
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
                      <button
                        key={pagina}
                        onClick={() => setPaginaActual(pagina)}
                        className={`btn btn-sm ${
                          paginaActual === pagina ? "btn-primary" : ""
                        }`}
                      >
                        {pagina}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="btn btn-sm"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
