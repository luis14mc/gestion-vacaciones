"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Building2,
  Plus,
  Edit,
  Search,
  RefreshCw,
} from "lucide-react";
import type { Session } from "next-auth";
import Swal from "sweetalert2";

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  departamento?: {
    id: number;
    nombre: string;
  };
}

interface Departamento {
  id: number;
  nombre: string;
  codigo: string;
}

interface TipoAusencia {
  id: number;
  tipo: string;
  nombre: string;
  colorHex?: string;
}

interface Balance {
  id: number;
  usuario_id: number;
  tipo_ausencia_id: number;
  anio: number;
  cantidad_asignada: string;
  cantidad_utilizada: string;
  cantidad_pendiente: string;
  cantidad_disponible: string;
  fecha_vencimiento: string | null;
  notas: string | null;
  tipo_nombre: string;
  tipo_codigo: string;
}

interface AsignacionDiasClientProps {
  readonly session: Session;
}

export default function AsignacionDiasClient({ session }: AsignacionDiasClientProps) {
  const router = useRouter();
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState<"individual" | "departamento">("individual");
  
  // Form states
  const [formData, setFormData] = useState({
    usuarioId: "",
    departamentoId: "",
    tipoAusenciaId: "",
    cantidadAsignada: "",
    operacion: "reemplazar", // reemplazar, sumar, restar
  });

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioSeleccionado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      await Promise.all([
        cargarUsuarios(),
        cargarDepartamentos(),
        cargarTiposAusencia(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await fetch("/api/usuarios?activo=true");
      const data = await res.json();
      if (data.success) {
        console.log("📦 Usuarios recibidos:", data.usuarios);
        console.log("👤 Primer usuario ejemplo:", data.usuarios?.[0]);
        setUsuarios(data.usuarios); // Cambiar de data.data a data.usuarios
        // Cargar balances de todos los usuarios
        await cargarTodosBalances(data.usuarios.map((u: Usuario) => u.id));
      }
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
  };

  const cargarTodosBalances = async (usuarioIds: number[]) => {
    try {
      // Agregar timestamp para evitar cache del navegador
      const timestamp = Date.now();
      const promesas = usuarioIds.map(id =>
        fetch(`/api/balances?usuarioId=${id}&anio=${anioSeleccionado}&_t=${timestamp}`, {
          cache: 'no-store'
        }).then(r => r.json())
      );
      const resultados = await Promise.all(promesas);
      
      const todosBalances: Balance[] = [];
      for (const resultado of resultados) {
        if (resultado.success && resultado.data) {
          // Convertir IDs de string a number
          const balancesConvertidos = resultado.data.map((b: any) => ({
            ...b,
            id: Number(b.id),
            usuario_id: Number(b.usuario_id),
            tipo_ausencia_id: Number(b.tipo_ausencia_id),
            anio: Number(b.anio)
          }));
          todosBalances.push(...balancesConvertidos);
        }
      }
      
      // Forzar actualización del estado con spread operator para nueva referencia
      setBalances([...todosBalances]);
      
      // Incrementar key para forzar re-render de tabla
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Error cargando balances:", error);
    }
  };

  const cargarDepartamentos = async () => {
    try {
      const res = await fetch("/api/departamentos");
      const data = await res.json();
      if (data.success) {
        setDepartamentos(data.data);
      }
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  };

  const cargarTiposAusencia = async () => {
    try {
      const res = await fetch("/api/tipos-ausencia");
      const data = await res.json();
      if (data.success) {
        setTiposAusencia(data.data);
      }
    } catch (error) {
      console.error("Error cargando tipos de ausencia:", error);
    }
  };

  const abrirModalIndividual = (usuario?: Usuario) => {
    setModoModal("individual");
    if (usuario) {
      // Usar el primer tipo de ausencia (vacaciones) por defecto
      const tipoVacacionesId = tiposAusencia.length > 0 ? tiposAusencia[0].id.toString() : "";
      setFormData({
        usuarioId: usuario.id.toString(),
        departamentoId: "",
        tipoAusenciaId: tipoVacacionesId,
        cantidadAsignada: "",
        operacion: "sumar",
      });
    } else {
      const tipoVacacionesId = tiposAusencia.length > 0 ? tiposAusencia[0].id.toString() : "";
      setFormData({
        usuarioId: "",
        departamentoId: "",
        tipoAusenciaId: tipoVacacionesId,
        cantidadAsignada: "",
        operacion: "sumar",
      });
    }
    setModalAbierto(true);
  };

  const abrirModalDepartamento = () => {
    setModoModal("departamento");
    // Buscar específicamente el tipo "Vacaciones"
    const tipoVacaciones = tiposAusencia.find(t => t.tipo === 'vacaciones') || tiposAusencia[0];
    const tipoVacacionesId = tipoVacaciones ? tipoVacaciones.id.toString() : "";
    setFormData({
      usuarioId: "",
      departamentoId: "",
      tipoAusenciaId: tipoVacacionesId,
      cantidadAsignada: "",
      operacion: "reemplazar",
    });
    setModalAbierto(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modoModal === "individual") {
      await asignarIndividual();
    } else {
      await asignarPorDepartamento();
    }
  };

  const asignarIndividual = async () => {
    if (!formData.usuarioId || !formData.tipoAusenciaId || !formData.cantidadAsignada) {
      await Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Por favor completa todos los campos obligatorios",
      });
      return;
    }

    try {
      // Obtener balance actual si existe
      const balanceActual = balances.find(
        b => b.usuario_id === Number(formData.usuarioId) && 
             b.tipo_ausencia_id === Number(formData.tipoAusenciaId)
      );

      let cantidadFinal = Number.parseFloat(formData.cantidadAsignada);

      if (balanceActual && formData.operacion !== "reemplazar") {
        const cantidadActual = Number.parseFloat(balanceActual.cantidad_asignada);
        if (formData.operacion === "sumar") {
          cantidadFinal = cantidadActual + cantidadFinal;
        } else if (formData.operacion === "restar") {
          cantidadFinal = cantidadActual - cantidadFinal;
          if (cantidadFinal < 0) cantidadFinal = 0;
        }
      }

      const res = await fetch("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: Number(formData.usuarioId),
          tipoAusenciaId: Number(formData.tipoAusenciaId),
          anio: anioSeleccionado,
          cantidadAsignada: cantidadFinal.toString(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const operacionTexto = formData.operacion === "sumar" ? "sumados" : "restados";
        setModalAbierto(false);
        
        // Pequeño delay para asegurar que la columna generada se actualice en BD
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await cargarDatos();
        await Swal.fire({
          icon: "success",
          title: "Operación exitosa",
          html: `${formData.cantidadAsignada} días ${operacionTexto}<br>Balance final: ${cantidadFinal.toFixed(1)} días`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al asignar días",
        });
      }
    } catch (error) {
      console.error("Error asignando días:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al asignar días",
      });
    }
  };

  const asignarPorDepartamento = async () => {
    if (!formData.departamentoId || !formData.tipoAusenciaId || !formData.cantidadAsignada) {
      await Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Por favor completa todos los campos obligatorios",
      });
      return;
    }

    const departamento = departamentos.find(d => d.id === Number(formData.departamentoId));
    const tipo = tiposAusencia.find(t => t.id === Number(formData.tipoAusenciaId));
    
    const operacionTexto = formData.operacion === "sumar" ? "sumarán" : 
                           formData.operacion === "restar" ? "restarán" : "asignarán";

    const result = await Swal.fire({
      icon: "question",
      title: "¿Confirmar asignación masiva?",
      html: `Se <strong>${operacionTexto}</strong> <strong>${formData.cantidadAsignada} días</strong> de <strong>${tipo?.nombre}</strong> a todos los empleados del departamento <strong>${departamento?.nombre}</strong> para el año ${anioSeleccionado}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1A3C64",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch("/api/asignacion-masiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departamentoId: Number(formData.departamentoId),
          tipoAusenciaId: Number(formData.tipoAusenciaId),
          anio: anioSeleccionado,
          cantidadAsignada: formData.cantidadAsignada,
          operacion: formData.operacion,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setModalAbierto(false);
        
        // Pequeño delay para asegurar que las columnas generadas se actualicen en BD
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await cargarDatos();
        await Swal.fire({
          icon: "success",
          title: "Asignación completada",
          html: `Operación realizada correctamente en <strong>${data.usuariosAfectados}</strong> usuarios`,
          timer: 3000,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error en la asignación masiva",
        });
      }
    } catch (error) {
      console.error("Error en asignación masiva:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error en la asignación masiva",
      });
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchNombre = 
      u.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) ||
      u.apellido.toLowerCase().includes(filtroNombre.toLowerCase());
    const matchDepartamento = !filtroDepartamento || u.departamento?.id.toString() === filtroDepartamento;
    return matchNombre && matchDepartamento;
  });

  const getBalanceUsuario = (usuarioId: number, tipoAusenciaId: number) => {
    return balances.find(
      b => b.usuario_id === usuarioId && b.tipo_ausencia_id === tipoAusenciaId
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-linear-to-br from-primary to-secondary text-primary-content">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gestión de Días Disponibles</h1>
              <p className="text-base-content/70">
                Asigna y actualiza los días de vacaciones de los empleados
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

        {/* Toolbar */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModalIndividual()}
                  className="btn btn-primary gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Asignar Individual
                </button>
                <button
                  onClick={abrirModalDepartamento}
                  className="btn btn-secondary gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Asignar por Departamento
                </button>
                <button
                  onClick={cargarDatos}
                  className="btn btn-ghost gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <label className="text-sm font-medium">Año:</label>
                <select
                  className="select select-bordered select-sm"
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                >
                  {[2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  className="input input-bordered w-full pl-10"
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                />
              </div>
              <select
                className="select select-bordered min-w-[250px]"
                value={filtroDepartamento}
                onChange={(e) => setFiltroDepartamento(e.target.value)}
              >
                <option value="">Todos los departamentos</option>
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Balances */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Balances de Días - Año {anioSeleccionado}
            </h2>
            
            <div className="overflow-x-auto" key={refreshKey}>
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Departamento</th>
                    <th className="text-center">Días Asignados</th>
                    <th className="text-center">Días Disponibles</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-12 h-12 text-base-content/30" />
                          <p className="text-base-content/60">No hay usuarios para mostrar</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((usuario) => {
                      // Buscar específicamente el tipo "Vacaciones"
                      const tipoVacaciones = tiposAusencia.find(t => t.tipo === 'vacaciones') || tiposAusencia[0];
                      const balanceVacaciones = tipoVacaciones
                        ? getBalanceUsuario(usuario.id, tipoVacaciones.id)
                        : null;
                      
                      return (
                        <tr key={usuario.id}>
                          <td>
                            <div>
                              <div className="font-medium">{usuario.nombre} {usuario.apellido}</div>
                              <div className="text-xs opacity-60">{usuario.email}</div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-ghost">
                              {usuario.departamento?.nombre || "Sin departamento"}
                            </span>
                          </td>
                          <td className="text-center">
                            {balanceVacaciones ? (
                              <span className="font-semibold text-lg text-primary">
                                {Number.parseFloat(balanceVacaciones.cantidad_asignada).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-base-content/40">0.0</span>
                            )}
                          </td>
                          <td className="text-center">
                            {balanceVacaciones ? (
                              <span className="font-semibold text-lg text-success">
                                {Number.parseFloat(balanceVacaciones.cantidad_disponible).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-base-content/40">0.0</span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => abrirModalIndividual(usuario)}
                              className="btn btn-sm btn-primary gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Asignar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Asignación */}
      {modalAbierto && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {modoModal === "individual" ? "Ajustar Balance de Días" : "Asignación Masiva por Departamento"}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {modoModal === "individual" ? (
                  <>
                    {/* Usuario */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Usuario *</span>
                      </label>
                      {formData.usuarioId ? (
                        // Usuario seleccionado desde la tabla - Solo lectura
                        <div className="p-3 bg-base-200 rounded-lg">
                          <div className="font-medium">
                            {usuarios.find(u => u.id === Number(formData.usuarioId))?.nombre}{" "}
                            {usuarios.find(u => u.id === Number(formData.usuarioId))?.apellido}
                          </div>
                          <div className="text-xs text-base-content/60">
                            {usuarios.find(u => u.id === Number(formData.usuarioId))?.email}
                          </div>
                        </div>
                      ) : (
                        // Usuario no seleccionado - Mostrar dropdown
                        <select
                          className="select select-bordered"
                          value={formData.usuarioId}
                          onChange={(e) => setFormData({ ...formData, usuarioId: e.target.value })}
                          required
                        >
                          <option value="">Seleccione un usuario</option>
                          {usuarios.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.nombre} {user.apellido} - {user.departamento?.nombre || 'Sin depto'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Operación - Solo sumar o restar */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Operación *</span>
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="operacion"
                            value="sumar"
                            checked={formData.operacion === "sumar"}
                            onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                            className="hidden peer"
                          />
                          <div className="btn btn-outline w-full peer-checked:btn-success peer-checked:btn-active">
                            ➕ Sumar días
                          </div>
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="operacion"
                            value="restar"
                            checked={formData.operacion === "restar"}
                            onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                            className="hidden peer"
                          />
                          <div className="btn btn-outline w-full peer-checked:btn-error peer-checked:btn-active">
                            ➖ Restar días
                          </div>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Departamento */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Departamento *</span>
                      </label>
                      <select
                        className="select select-bordered"
                        value={formData.departamentoId}
                        onChange={(e) => setFormData({ ...formData, departamentoId: e.target.value })}
                        required
                      >
                        <option value="">Seleccione un departamento</option>
                        {departamentos.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.nombre} ({dept.codigo})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operación por Departamento */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Operación *</span>
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="operacion-dept"
                            value="reemplazar"
                            checked={formData.operacion === "reemplazar"}
                            onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                            className="hidden peer"
                          />
                          <div className="btn btn-outline btn-sm w-full peer-checked:btn-primary peer-checked:btn-active">
                            🔄 Reemplazar
                          </div>
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="operacion-dept"
                            value="sumar"
                            checked={formData.operacion === "sumar"}
                            onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                            className="hidden peer"
                          />
                          <div className="btn btn-outline btn-sm w-full peer-checked:btn-success peer-checked:btn-active">
                            ➕ Sumar
                          </div>
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="operacion-dept"
                            value="restar"
                            checked={formData.operacion === "restar"}
                            onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                            className="hidden peer"
                          />
                          <div className="btn btn-outline btn-sm w-full peer-checked:btn-error peer-checked:btn-active">
                            ➖ Restar
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Alerta informativa según operación */}
                    <div className={`alert ${
                      formData.operacion === 'reemplazar' ? 'alert-info' :
                      formData.operacion === 'sumar' ? 'alert-success' : 'alert-warning'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span className="text-sm">
                        {formData.operacion === 'reemplazar' && 
                          <>Esta operación <strong>reemplazará</strong> el balance actual de todos los empleados del departamento</>
                        }
                        {formData.operacion === 'sumar' && 
                          <>Esta operación <strong>sumará</strong> días al balance actual de todos los empleados del departamento</>
                        }
                        {formData.operacion === 'restar' && 
                          <>Esta operación <strong>restará</strong> días del balance actual de todos los empleados del departamento</>
                        }
                      </span>
                    </div>
                  </>
                )}

                {/* Cantidad de Días */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Cantidad de Días *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-lg text-center text-2xl font-bold"
                    value={formData.cantidadAsignada}
                    onChange={(e) => setFormData({ ...formData, cantidadAsignada: e.target.value })}
                    min="0"
                    step="0.5"
                    placeholder="0.0"
                    required
                  />
                  <label className="label">
                    <span className="label-text-alt text-xs">
                      {modoModal === "individual" ? (
                        formData.operacion === "sumar" 
                          ? "Estos días se sumarán al balance actual del empleado"
                          : "Estos días se restarán del balance actual del empleado"
                      ) : (
                        "Todos los empleados del departamento tendrán exactamente esta cantidad de días"
                      )}
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {modoModal === "individual" 
                    ? (formData.operacion === "sumar" ? "Sumar Días" : "Restar Días")
                    : "Asignar a Departamento"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
