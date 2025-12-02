"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  X,
  Save,
  ShieldCheck,
  Briefcase,
  Calendar,
} from "lucide-react";
import type { Session } from "next-auth";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";

registerLocale("es", es);

interface Usuario {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  esAdmin: boolean;
  esRrhh: boolean;
  esJefe: boolean;
  activo: boolean;
  departamentoId?: number;
  cargo?: string | null;
  fechaIngreso?: string | null;
  departamento?: {
    id: number;
    nombre: string;
  };
  diasVacaciones?: number;
  diasUsados?: number;
  diasDisponibles?: number;
}

interface UsuariosClientProps {
  session: Session;
}

interface Departamento {
  id: number;
  nombre: string;
}

export default function UsuariosClient({ session }: UsuariosClientProps) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nombre: "",
    apellido: "",
    departamento_id: "",
    cargo: "",
    fechaIngreso: "",
    esAdmin: false,
    esRrhh: false,
    esJefe: false,
    estaActivo: true,
  });

  // Load users and departments on mount
  useEffect(() => {
    cargarUsuarios();
    cargarDepartamentos();
  }, []);

  const cargarDepartamentos = async () => {
    try {
      const res = await fetch("/api/departamentos");
      if (res.ok) {
        const response = await res.json();
        const data = response.data || response;
        console.log("Departamentos cargados:", data);
        setDepartamentos(Array.isArray(data) ? data : []);
      } else {
        console.error("Error en respuesta de departamentos:", res.status);
      }
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  };

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/usuarios");
      if (res.ok) {
        const response = await res.json();
        const data = response.data || response;
        setUsuarios(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = "/api/usuarios";
      const method = editingUser ? "PATCH" : "POST";

      const body: any = {
        email: formData.email,
        nombre: formData.nombre,
        apellido: formData.apellido,
        departamentoId: Number.parseInt(formData.departamento_id),
        esAdmin: formData.esAdmin,
        esRrhh: formData.esRrhh,
        esJefe: formData.esJefe,
        activo: formData.estaActivo,
      };

      if (formData.cargo) {
        body.cargo = formData.cargo;
      }

      if (formData.fechaIngreso) {
        body.fechaIngreso = formData.fechaIngreso;
      }

      if (formData.password) {
        body.password = formData.password;
      }

      if (editingUser) {
        body.id = editingUser.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await cargarUsuarios();
        cerrarModal();
        await Swal.fire({
          icon: "success",
          title: editingUser ? "Usuario actualizado" : "Usuario creado",
          text: editingUser
            ? "El usuario ha sido actualizado exitosamente"
            : "El usuario ha sido creado exitosamente",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const errorData = await res.json();
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: errorData.error || "No se pudo guardar el usuario",
        });
      }
    } catch (error) {
      console.error("Error guardando usuario:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error guardando usuario",
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Estás seguro?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/usuarios?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await cargarUsuarios();
        await Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "El usuario ha sido eliminado exitosamente",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const data = await res.json();
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error eliminando usuario",
        });
      }
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al procesar la solicitud",
      });
    }
  };

  const abrirModalNuevo = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "",
      nombre: "",
      apellido: "",
      departamento_id: "",
      cargo: "",
      fechaIngreso: "",
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      estaActivo: true,
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const abrirModalEditar = (usuario: Usuario) => {
    setEditingUser(usuario);
    setFormData({
      email: usuario.email,
      password: "",
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      departamento_id: usuario.departamentoId?.toString() || "",
      cargo: usuario.cargo || "",
      fechaIngreso: usuario.fechaIngreso || "",
      esAdmin: usuario.esAdmin,
      esRrhh: usuario.esRrhh,
      esJefe: usuario.esJefe,
      estaActivo: usuario.activo,
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  // Filtrado
  const usuariosFiltrados = usuarios.filter((u) => {
    const matchSearch =
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRol =
      filtroRol === "todos" ||
      (filtroRol === "admin" && u.esAdmin) ||
      (filtroRol === "rrhh" && u.esRrhh) ||
      (filtroRol === "jefe" && u.esJefe) ||
      (filtroRol === "empleado" && !u.esAdmin && !u.esRrhh && !u.esJefe);

    const matchEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activos" && u.activo) ||
      (filtroEstado === "inactivos" && !u.activo);

    return matchSearch && matchRol && matchEstado;
  });

  // Estadísticas
  const totalUsuarios = usuarios.length;
  const usuariosActivos = usuarios.filter((u) => u.activo).length;
  const administradores = usuarios.filter((u) => u.esAdmin).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-content">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
              <p className="text-base-content/70">
                Administra usuarios del sistema
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

        {/* Barra de búsqueda y filtros */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Búsqueda */}
              <div className="lg:col-span-5">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Search className="w-5 h-5 text-base-content/50" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, apellido o email..."
                    className="input input-bordered w-full pl-12"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtro por rol */}
              <div className="lg:col-span-3">
                <select
                  className="select select-bordered w-full"
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                >
                  <option value="todos">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="rrhh">RRHH</option>
                  <option value="jefe">Jefes</option>
                  <option value="empleado">Empleados</option>
                </select>
              </div>

              {/* Filtro por estado */}
              <div className="lg:col-span-2">
                <select
                  className="select select-bordered w-full"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>
              </div>

              {/* Botón nuevo usuario */}
              <div className="lg:col-span-2">
                <button
                  onClick={abrirModalNuevo}
                  className="btn btn-primary gap-2 w-full"
                >
                  <UserPlus className="w-5 h-5" />
                  Nuevo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card bg-gradient-to-br from-primary to-primary/80 text-primary-content shadow-xl">
            <div className="card-body p-6">
              <h3 className="text-sm opacity-90 font-medium mb-2 h-8 flex items-center">Total Usuarios</h3>
              <p className="text-4xl font-bold">{totalUsuarios}</p>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-success to-success/80 text-success-content shadow-xl">
            <div className="card-body p-6">
              <h3 className="text-sm opacity-90 font-medium mb-2 h-8 flex items-center">Activos</h3>
              <p className="text-4xl font-bold">{usuariosActivos}</p>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-secondary to-secondary/80 text-secondary-content shadow-xl">
            <div className="card-body p-6">
              <h3 className="text-sm opacity-90 font-medium mb-2 h-8 flex items-center">
                Administradores
              </h3>
              <p className="text-4xl font-bold">{administradores}</p>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-accent to-accent/80 text-accent-content shadow-xl">
            <div className="card-body p-6">
              <h3 className="text-sm opacity-90 font-medium mb-2 h-8 flex items-center">Filtrados</h3>
              <p className="text-4xl font-bold">{usuariosFiltrados.length}</p>
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Lista de Usuarios ({usuariosFiltrados.length})
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Departamento</th>
                      <th>Estado</th>
                      <th>Días Disponibles</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>
                          <div className="font-semibold">
                            {usuario.nombre} {usuario.apellido}
                          </div>
                        </td>
                        <td>{usuario.email}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {usuario.esAdmin && (
                              <span className="badge badge-error gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                            {usuario.esRrhh && (
                              <span className="badge badge-warning gap-1">
                                <Users className="w-3 h-3" />
                                RRHH
                              </span>
                            )}
                            {usuario.esJefe && (
                              <span className="badge badge-info gap-1">
                                <Briefcase className="w-3 h-3" />
                                Jefe
                              </span>
                            )}
                            {!usuario.esAdmin &&
                              !usuario.esRrhh &&
                              !usuario.esJefe && (
                                <span className="badge badge-ghost">
                                  Empleado
                                </span>
                              )}
                          </div>
                        </td>
                        <td>
                          {usuario.departamento?.nombre || (
                            <span className="text-base-content/50">
                              Sin departamento
                            </span>
                          )}
                        </td>
                        <td>
                          {usuario.activo ? (
                            <span className="badge badge-success">Activo</span>
                          ) : (
                            <span className="badge badge-error">Inactivo</span>
                          )}
                        </td>
                        <td>
                          <span className="font-semibold">
                            {usuario.diasDisponibles !== undefined
                              ? usuario.diasDisponibles
                              : "-"}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => abrirModalEditar(usuario)}
                              className="btn btn-sm btn-ghost"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(usuario.id)}
                              className="btn btn-sm btn-ghost text-error"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {usuariosFiltrados.length === 0 && (
                  <div className="text-center py-12 text-base-content/70">
                    No se encontraron usuarios
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Crear/Editar Usuario */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email *</span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Password */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">
                      Contraseña {!editingUser && "*"}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered w-full pr-10"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Nombre */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Nombre *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Apellido */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Apellido *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.apellido}
                    onChange={(e) =>
                      setFormData({ ...formData, apellido: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Departamento */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Departamento *</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={formData.departamento_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        departamento_id: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Seleccione un departamento</option>
                    {departamentos.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cargo */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Cargo</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.cargo}
                    onChange={(e) =>
                      setFormData({ ...formData, cargo: e.target.value })
                    }
                    placeholder="Ej: Desarrollador"
                  />
                </div>

                {/* Fecha de Ingreso */}
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Fecha de Ingreso</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <Calendar className="w-5 h-5 text-base-content/50" />
                    </div>
                    <DatePicker
                      selected={formData.fechaIngreso ? new Date(formData.fechaIngreso) : null}
                      onChange={(date) =>
                        setFormData({
                          ...formData,
                          fechaIngreso: date ? date.toISOString().split('T')[0] : "",
                        })
                      }
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      placeholderText="Seleccione una fecha"
                      className="input input-bordered w-full pl-10"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      maxDate={new Date()}
                      isClearable
                    />
                  </div>
                </div>
              </div>

              {/* Roles (Checkboxes) */}
              <div className="divider">Roles y Permisos</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={formData.esAdmin}
                      onChange={(e) =>
                        setFormData({ ...formData, esAdmin: e.target.checked })
                      }
                    />
                    <span className="label-text">Administrador</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-warning"
                      checked={formData.esRrhh}
                      onChange={(e) =>
                        setFormData({ ...formData, esRrhh: e.target.checked })
                      }
                    />
                    <span className="label-text">RRHH</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-info"
                      checked={formData.esJefe}
                      onChange={(e) =>
                        setFormData({ ...formData, esJefe: e.target.checked })
                      }
                    />
                    <span className="label-text">Jefe</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-success"
                      checked={formData.estaActivo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estaActivo: e.target.checked,
                        })
                      }
                    />
                    <span className="label-text">Usuario Activo</span>
                  </label>
                </div>
              </div>

              {/* Botones */}
              <div className="modal-action">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-ghost gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary gap-2">
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
