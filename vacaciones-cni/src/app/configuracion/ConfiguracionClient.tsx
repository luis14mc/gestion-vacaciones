"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Calendar,
  Mail,
  Building2,
  Shield,
  Edit,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Session } from "next-auth";
import Swal from "sweetalert2";

interface ConfigItem {
  id: number;
  clave: string;
  valor: string;
  descripcion?: string;
  categoria: string;
  tipoDato?: string;
  esPublico?: boolean;
}

interface ConfiguracionClientProps {
  session: Session;
}

export default function ConfiguracionClient({ session }: ConfiguracionClientProps) {
  const router = useRouter();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState("general");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);

  const [formData, setFormData] = useState({
    clave: "",
    valor: "",
    descripcion: "",
    categoria: "general",
    tipoDato: "string",
    esPublico: false,
  });

  const categorias = [
    { id: "general", nombre: "General", icon: Settings },
    { id: "vacaciones", nombre: "Vacaciones", icon: Calendar },
    { id: "notificaciones", nombre: "Notificaciones", icon: Mail },
    { id: "departamentos", nombre: "Departamentos", icon: Building2 },
    { id: "seguridad", nombre: "Seguridad", icon: Shield },
  ];

  // Load configurations on mount
  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  const cargarConfiguraciones = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/configuracion");
      const data = await res.json();

      if (data.success) {
        setConfigs(data.data);
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al cargar configuraciones",
        });
      }
    } catch (error) {
      console.error("Error cargando configuraciones:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al cargar configuraciones",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validar formato snake_case para la clave
      if (!/^[a-z0-9_]+$/.test(formData.clave)) {
        await Swal.fire({
          icon: "warning",
          title: "Formato inválido",
          text: "La clave debe estar en formato snake_case (solo minúsculas, números y guiones bajos)",
        });
        return;
      }

      const method = editingConfig ? "PATCH" : "POST";
      
      // Al editar, no enviar la clave (no se puede modificar)
      const body = editingConfig
        ? { 
            id: editingConfig.id,
            valor: formData.valor,
            descripcion: formData.descripcion,
            categoria: formData.categoria,
            tipoDato: formData.tipoDato,
            esPublico: formData.esPublico
          }
        : formData;

      console.log('Enviando:', { method, body }); // Debug

      const res = await fetch("/api/configuracion", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      console.log('Respuesta:', data); // Debug

      if (data.success) {
        await cargarConfiguraciones();
        await Swal.fire({
          icon: "success",
          title: editingConfig ? "Actualizado" : "Creado",
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
        });
        cerrarModal();
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al guardar configuración",
        });
      }
    } catch (error) {
      console.error("Error guardando configuración:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al guardar configuración",
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Estás seguro?",
      text: "Esta configuración será eliminada permanentemente",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/configuracion?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        await cargarConfiguraciones();
        await Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al eliminar configuración",
        });
      }
    } catch (error) {
      console.error("Error eliminando configuración:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al eliminar configuración",
      });
    }
  };

  const abrirModalNueva = () => {
    setEditingConfig(null);
    setFormData({
      clave: "",
      valor: "",
      descripcion: "",
      categoria: categoriaActiva,
      tipoDato: "string",
      esPublico: false,
    });
    setModalOpen(true);
  };

  const abrirModalEditar = (config: ConfigItem) => {
    setEditingConfig(config);
    setFormData({
      clave: config.clave,
      valor: config.valor,
      descripcion: config.descripcion || "",
      categoria: config.categoria,
      tipoDato: config.tipoDato || "string",
      esPublico: config.esPublico || false,
    });
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditingConfig(null);
  };

  const configsFiltradas = configs.filter((c) => c.categoria === categoriaActiva);

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-content">
              <Settings className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Configuración del Sistema</h1>
              <p className="text-base-content/70">
                Administra la configuración general
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Categorías */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl sticky top-4">
              <div className="card-body p-4">
                <h2 className="card-title text-lg mb-3">Categorías</h2>
                <div className="flex flex-col gap-2">
                  {categorias.map((cat) => {
                    const Icon = cat.icon;
                    const count = configs.filter(
                      (c) => c.categoria === cat.id
                    ).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategoriaActiva(cat.id)}
                        className={`btn btn-sm justify-between ${
                          categoriaActiva === cat.id
                            ? "btn-primary"
                            : "btn-ghost"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{cat.nombre}</span>
                        </div>
                        <span className="badge badge-sm">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Configuraciones */}
          <div className="lg:col-span-3">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title">
                    {categorias.find((c) => c.id === categoriaActiva)?.nombre}
                  </h2>
                  <button
                    onClick={abrirModalNueva}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Configuración
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg"></span>
                  </div>
                ) : configsFiltradas.length === 0 ? (
                  <div className="text-center py-12 text-base-content/70">
                    <Settings className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No hay configuraciones en esta categoría</p>
                    <button
                      onClick={abrirModalNueva}
                      className="btn btn-sm btn-primary mt-4"
                    >
                      Crear primera configuración
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {configsFiltradas.map((config) => (
                      <div
                        key={config.id}
                        className="card bg-base-200 hover:shadow-lg transition-shadow"
                      >
                        <div className="card-body p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <code className="text-sm font-semibold bg-base-300 px-2 py-1 rounded">
                                {config.clave}
                              </code>
                              {config.descripcion && (
                                <p className="text-sm text-base-content/70 mt-2">
                                  {config.descripcion}
                                </p>
                              )}
                              <div className="mt-3">
                                <span className="text-xs text-base-content/60">
                                  Valor actual:
                                </span>
                                <div className="mt-1">
                                  {config.valor === "true" ||
                                  config.valor === "false" ? (
                                    <span
                                      className={`badge ${
                                        config.valor === "true"
                                          ? "badge-success"
                                          : "badge-error"
                                      }`}
                                    >
                                      {config.valor === "true"
                                        ? "Activado"
                                        : "Desactivado"}
                                    </span>
                                  ) : (
                                    <span className="font-semibold">
                                      {config.valor}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirModalEditar(config)}
                                className="btn btn-sm btn-ghost"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(config.id)}
                                className="btn btn-sm btn-ghost text-error"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Crear/Editar Configuración */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingConfig
                ? "Editar Configuración"
                : "Nueva Configuración"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Categoría */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Categoría *</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={formData.categoria}
                    onChange={(e) =>
                      setFormData({ ...formData, categoria: e.target.value })
                    }
                    required
                  >
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clave */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Clave *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.clave}
                    onChange={(e) =>
                      setFormData({ ...formData, clave: e.target.value })
                    }
                    placeholder="nombre_configuracion"
                    pattern="[a-z0-9_]+"
                    title="Solo minúsculas, números y guiones bajos (snake_case)"
                    required
                    disabled={!!editingConfig}
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      Formato: snake_case (ej: dias_vacaciones_default)
                    </span>
                  </label>
                </div>

                {/* Valor */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Valor *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.valor}
                    onChange={(e) =>
                      setFormData({ ...formData, valor: e.target.value })
                    }
                    placeholder="15"
                    required
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      Para booleanos usa: true o false
                    </span>
                  </label>
                </div>

                {/* Descripción */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Descripción</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-20"
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        descripcion: e.target.value,
                      })
                    }
                    placeholder="Descripción de la configuración..."
                  />
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
