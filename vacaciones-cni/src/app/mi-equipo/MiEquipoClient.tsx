"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  Search, 
  User, 
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Award,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Car,
  TrendingUp,
  Activity
} from "lucide-react";
import Swal from "sweetalert2";

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  cargo: string | null;
  departamentoId: number | null;
  departamento: string | null;
  estado: string;
  fechaIngreso: string | null;
  diasAsignados: number;
  diasDisponibles: number;
  diasUsados: number;
  solicitudesPendientes: number;
  enVacaciones: boolean;
}

interface Stats {
  total: number;
  activos: number;
  enVacaciones: number;
  diasPromedio: number;
}

export default function MiEquipoClient() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, enVacaciones: 0, diasPromedio: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  
  // Detalles
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    cargarEquipo();
  }, [estadoFiltro]);

  const cargarEquipo = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (estadoFiltro !== "todos") {
        params.append("estado", estadoFiltro);
      }

      const response = await fetch(`/api/usuarios?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsuarios(data.usuarios || []);
        
        // Calcular estadísticas
        const usuariosData = data.usuarios || [];
        const activos = usuariosData.filter((u: Usuario) => u.estado === "activo").length;
        const enVacaciones = usuariosData.filter((u: Usuario) => u.enVacaciones).length;
        const diasPromedio = usuariosData.length > 0
          ? Math.round(usuariosData.reduce((sum: number, u: Usuario) => sum + (u.diasDisponibles || 0), 0) / usuariosData.length)
          : 0;

        setStats({
          total: usuariosData.length,
          activos,
          enVacaciones,
          diasPromedio,
        });
      }
    } catch (error) {
      console.error("Error al cargar equipo:", error);
      Swal.fire("Error", "No se pudo cargar la información del equipo", "error");
    } finally {
      setLoading(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchBusqueda = 
      usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.cargo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      false;
    return matchBusqueda;
  });

  const verDetalles = (usuario: Usuario) => {
    setUsuarioSeleccionado(usuario);
    setMostrarModal(true);
  };

  const getEstadoBadge = (estado: string) => {
    if (estado === "activo") {
      return <div className="badge badge-success gap-1"><CheckCircle className="w-3 h-3" />Activo</div>;
    }
    return <div className="badge badge-ghost gap-1"><XCircle className="w-3 h-3" />Inactivo</div>;
  };

  const calcularPorcentajeUso = (usados: number, asignados: number) => {
    if (asignados === 0) return 0;
    return Math.round((usados / asignados) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-info to-info/70 p-4 rounded-2xl shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-base-content">Mi Equipo</h1>
            <p className="text-base-content/70">Gestiona y supervisa a los colaboradores de tu departamento</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost gap-2"
          >
            ← Volver
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-info">
              <Users className="w-8 h-8" />
            </div>
            <div className="stat-title">Total del Equipo</div>
            <div className="stat-value text-info">{stats.total}</div>
            <div className="stat-desc">Colaboradores</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-success">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="stat-title">Activos</div>
            <div className="stat-value text-success">{stats.activos}</div>
            <div className="stat-desc">{stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 0}% del total</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-accent">
              <Car className="w-8 h-8" />
            </div>
            <div className="stat-title">De Vacaciones</div>
            <div className="stat-value text-accent">{stats.enVacaciones}</div>
            <div className="stat-desc">Actualmente ausentes</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-primary">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="stat-title">Días Promedio</div>
            <div className="stat-value text-primary">{stats.diasPromedio}</div>
            <div className="stat-desc">Disponibles por persona</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">
              <Filter className="w-5 h-5" />
              Filtros
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Buscar</span>
                </label>
                <input
                  type="text"
                  placeholder="Nombre, email, cargo..."
                  className="input input-bordered w-full"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                <span className="label-text">Estado</span>
                </label>
                <br />
                <select
                  className="select select-bordered"
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de colaboradores */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Colaboradores ({usuariosFiltrados.length})
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
                <p className="text-base-content/60">No se encontraron colaboradores</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usuariosFiltrados.map((usuario) => (
                  <div key={usuario.id} className="card bg-base-200 shadow hover:shadow-lg transition-all">
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-base">{usuario.nombre} {usuario.apellido}</h3>
                          {usuario.cargo && <p className="text-xs text-base-content/60">{usuario.cargo}</p>}
                        </div>
                        {getEstadoBadge(usuario.estado)}
                      </div>

                      {usuario.enVacaciones && (
                        <div className="alert alert-info py-2 mb-2">
                          <Car className="w-4 h-4" />
                          <span className="text-xs">De vacaciones</span>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-base-content/70">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{usuario.email}</span>
                        </div>
                        
                        {usuario.telefono && (
                          <div className="flex items-center gap-2 text-base-content/70">
                            <Phone className="w-4 h-4" />
                            <span>{usuario.telefono}</span>
                          </div>
                        )}
                      </div>

                      {/* Balance de días */}
                      <div className="mt-3 pt-3 border-t border-base-300">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-base-content/60">Días disponibles</span>
                          <span className="text-sm font-bold text-primary">{usuario.diasDisponibles}/{usuario.diasAsignados}</span>
                        </div>
                        <progress 
                          className="progress progress-primary w-full" 
                          value={usuario.diasDisponibles} 
                          max={usuario.diasAsignados}
                        ></progress>
                        <div className="flex justify-between text-xs text-base-content/50 mt-1">
                          <span>{calcularPorcentajeUso(usuario.diasUsados, usuario.diasAsignados)}% usado</span>
                          {usuario.solicitudesPendientes > 0 && (
                            <span className="text-warning">{usuario.solicitudesPendientes} pendiente(s)</span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions justify-end mt-3">
                        <button
                          className="btn btn-sm btn-ghost gap-1"
                          onClick={() => verDetalles(usuario)}
                        >
                          <Eye className="w-4 h-4" />
                          Ver detalles
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrarModal && usuarioSeleccionado && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              Información del Colaborador
            </h3>

            <div className="space-y-4">
              {/* Información personal */}
              <div className="bg-base-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label label-text font-semibold">Nombre completo</label>
                    <p className="text-base-content">{usuarioSeleccionado.nombre} {usuarioSeleccionado.apellido}</p>
                  </div>
                  <div>
                    <label className="label label-text font-semibold">Estado</label>
                    <div>{getEstadoBadge(usuarioSeleccionado.estado)}</div>
                  </div>
                  <div>
                    <label className="label label-text font-semibold">Email</label>
                    <p className="text-base-content">{usuarioSeleccionado.email}</p>
                  </div>
                  {usuarioSeleccionado.telefono && (
                    <div>
                      <label className="label label-text font-semibold">Teléfono</label>
                      <p className="text-base-content">{usuarioSeleccionado.telefono}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.cargo && (
                    <div>
                      <label className="label label-text font-semibold">Cargo</label>
                      <p className="text-base-content">{usuarioSeleccionado.cargo}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.departamento && (
                    <div>
                      <label className="label label-text font-semibold">Departamento</label>
                      <p className="text-base-content">{usuarioSeleccionado.departamento}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.fechaIngreso && (
                    <div>
                      <label className="label label-text font-semibold">Fecha de ingreso</label>
                      <p className="text-base-content">
                        {new Date(usuarioSeleccionado.fechaIngreso).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Balance de vacaciones */}
              <div className="bg-base-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Balance de Vacaciones
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="stat bg-base-100 rounded p-3">
                    <div className="stat-title text-xs">Asignados</div>
                    <div className="stat-value text-2xl text-primary">{usuarioSeleccionado.diasAsignados}</div>
                  </div>
                  <div className="stat bg-base-100 rounded p-3">
                    <div className="stat-title text-xs">Usados</div>
                    <div className="stat-value text-2xl text-error">{usuarioSeleccionado.diasUsados}</div>
                  </div>
                  <div className="stat bg-base-100 rounded p-3">
                    <div className="stat-title text-xs">Disponibles</div>
                    <div className="stat-value text-2xl text-success">{usuarioSeleccionado.diasDisponibles}</div>
                  </div>
                </div>
                <progress 
                  className="progress progress-primary w-full mt-3" 
                  value={usuarioSeleccionado.diasDisponibles} 
                  max={usuarioSeleccionado.diasAsignados}
                ></progress>
              </div>

              {/* Estado actual */}
              {usuarioSeleccionado.enVacaciones && (
                <div className="alert alert-info">
                  <Car className="w-5 h-5" />
                  <span>Actualmente de vacaciones</span>
                </div>
              )}

              {usuarioSeleccionado.solicitudesPendientes > 0 && (
                <div className="alert alert-warning">
                  <Clock className="w-5 h-5" />
                  <span>{usuarioSeleccionado.solicitudesPendientes} solicitud(es) pendiente(s) de aprobación</span>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setMostrarModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setMostrarModal(false)}></div>
        </div>
      )}
    </div>
  );
}
