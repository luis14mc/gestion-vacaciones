"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "next-auth";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Users, 
  Download,
  Filter,
  BarChart3,
  PieChart,
  AlertTriangle
} from "lucide-react";
import Swal from "sweetalert2";
import { generarPDFReporte, descargarPDF } from "@/lib/pdfExport";

interface ReportesClientProps {
  session: Session;
}

type TipoReporte = 
  | "balances" 
  | "solicitudes" 
  | "departamentos" 
  | "proyecciones" 
  | "ausentismo";

interface Departamento {
  id: number;
  nombre: string;
  codigo: string;
}

interface TipoAusencia {
  id: number;
  nombre: string;
  tipo: string;
}

interface FiltrosReporte {
  tipoReporte: TipoReporte;
  fechaInicio: string;
  fechaFin: string;
  departamentoId: string;
  tipoAusenciaId: string;
  anio: number;
  estado: string;
}

export default function ReportesClient({ session }: ReportesClientProps) {
  const router = useRouter();
  const [reporteSeleccionado, setReporteSeleccionado] = useState<TipoReporte>("balances");
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [datosReporte, setDatosReporte] = useState<any>(null);

  const [filtros, setFiltros] = useState<FiltrosReporte>({
    tipoReporte: "balances",
    fechaInicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    fechaFin: new Date().toISOString().split('T')[0],
    departamentoId: "",
    tipoAusenciaId: "",
    anio: new Date().getFullYear(),
    estado: "",
  });

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatos = async () => {
    try {
      const [deptRes, tiposRes] = await Promise.all([
        fetch("/api/departamentos"),
        fetch("/api/tipos-ausencia"),
      ]);

      const [deptData, tiposData] = await Promise.all([
        deptRes.json(),
        tiposRes.json(),
      ]);

      if (deptData.success) setDepartamentos(deptData.data);
      if (tiposData.success) setTiposAusencia(tiposData.data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const generarReporte = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({
        ...filtros,
        tipoReporte: reporteSeleccionado,
      } as any);

      const res = await fetch(`/api/reportes?${params}`);
      const data = await res.json();

      if (data.success) {
        setDatosReporte(data.data);
      } else {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al generar reporte",
        });
      }
    } catch (error) {
      console.error("Error generando reporte:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al generar reporte",
      });
    } finally {
      setCargando(false);
    }
  };

  const exportarReporte = async (formato: "excel" | "pdf") => {
    if (!reporteSeleccionado) {
      await Swal.fire({
        icon: "warning",
        title: "Sin selección",
        text: "Primero selecciona un tipo de reporte",
      });
      return;
    }

    // Confirmación antes de exportar
    const formatoTexto = formato === "excel" ? "CSV" : "PDF";
    const result = await Swal.fire({
      title: "¿Exportar reporte?",
      text: `Se descargará el reporte de ${tiposReporte.find(t => t.id === reporteSeleccionado)?.nombre} en formato ${formatoTexto}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, exportar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3b82f6",
    });

    if (!result.isConfirmed) return;

    try {
      // Mostrar indicador de carga
      Swal.fire({
        title: 'Generando exportación...',
        html: 'Por favor espera mientras se obtienen todos los datos',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      if (formato === "pdf") {
        // Obtener datos COMPLETOS de la API para PDF (sin limitaciones del frontend)
        const params = new URLSearchParams({
          ...filtros,
          tipoReporte: reporteSeleccionado,
        } as any);

        const res = await fetch(`/api/reportes?${params}`);
        const data = await res.json();

        if (!data.success || !data.data) {
          throw new Error('No se pudieron obtener los datos');
        }

        const datosCompletos = data.data;

        // Generar PDF con TODOS los datos de la API
        let config: any = {};
        const tituloReporte = tiposReporte.find(t => t.id === reporteSeleccionado)?.nombre || '';
        
        switch (reporteSeleccionado) {
          case "balances":
            config = {
              titulo: tituloReporte,
              subtitulo: `Período: ${filtros.fechaInicio} a ${filtros.fechaFin}`,
              datos: datosCompletos.balances || [],
              columnas: ['Empleado', 'Departamento', 'Tipo', 'Asignados', 'Usados', 'Pendientes', 'Disponibles'],
              campos: ['empleado', 'departamento', 'tipo_ausencia', 'asignados', 'utilizados', 'pendientes', 'disponibles'],
            };
            break;
          case "solicitudes":
            config = {
              titulo: tituloReporte,
              subtitulo: `Período: ${filtros.fechaInicio} a ${filtros.fechaFin}`,
              datos: datosCompletos.solicitudes || [],
              columnas: ['Empleado', 'Tipo', 'Inicio', 'Fin', 'Días', 'Estado', 'Motivo'],
              campos: ['empleado', 'tipo_ausencia', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'motivo'],
            };
            break;
          case "departamentos":
            config = {
              titulo: tituloReporte,
              subtitulo: `Año ${filtros.anio}`,
              datos: datosCompletos.departamentos || [],
              columnas: ['Departamento', 'Empleados', 'Total Asignados', 'Total Usados', 'Total Pendientes', 'Total Disponibles', '% Uso'],
              campos: ['departamento', 'total_empleados', 'total_asignados', 'total_usados', 'total_pendientes', 'total_disponibles', 'porcentaje_uso'],
            };
            break;
          case "proyecciones":
            config = {
              titulo: tituloReporte,
              subtitulo: 'Días próximos a vencer',
              datos: datosCompletos.proximos_vencer || [],
              columnas: ['Empleado', 'Tipo', 'Disponibles', 'Vencimiento', 'Días Restantes'],
              campos: ['empleado', 'tipo_ausencia', 'dias_disponibles', 'fecha_vencimiento', 'dias_restantes'],
            };
            break;
          case "ausentismo":
            config = {
              titulo: tituloReporte,
              subtitulo: `Año ${filtros.anio}`,
              datos: datosCompletos.por_mes || [],
              columnas: ['Mes', 'Solicitudes', 'Días Totales', 'Días Promedio', 'Aprobadas', 'Rechazadas', 'Pendientes'],
              campos: ['mes', 'total_solicitudes', 'total_dias', 'promedio_dias', 'aprobadas', 'rechazadas', 'pendientes'],
            };
            break;
        }

        const doc = generarPDFReporte(config);
        descargarPDF(doc, `reporte_${reporteSeleccionado}_${Date.now()}.pdf`);

        Swal.close(); // Cerrar el loading
        await Swal.fire({
          icon: "success",
          title: "Exportado",
          html: `<strong>${config.datos.length}</strong> registros exportados exitosamente`,
          timer: 3000,
          showConfirmButton: false,
        });
      } else {
        // Exportar CSV desde API (ya obtiene todos los datos)
        const params = new URLSearchParams({
          ...filtros,
          tipoReporte: reporteSeleccionado,
          formato,
        } as any);

        const res = await fetch(`/api/reportes/exportar?${params}`);
        
        if (!res.ok) {
          throw new Error('Error al exportar');
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${reporteSeleccionado}_${Date.now()}.csv`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);

        Swal.close(); // Cerrar el loading
        await Swal.fire({
          icon: "success",
          title: "Exportado",
          text: "Archivo CSV descargado exitosamente con todos los registros",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error exportando reporte:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al exportar reporte",
      });
    }
  };

  const tiposReporte = [
    {
      id: "balances" as TipoReporte,
      nombre: "Balances Actuales",
      descripcion: "Balance de días por empleado y tipo de ausencia",
      icono: FileText,
      color: "text-primary",
    },
    {
      id: "solicitudes" as TipoReporte,
      nombre: "Historial de Solicitudes",
      descripcion: "Todas las solicitudes de ausencia por período",
      icono: Calendar,
      color: "text-info",
    },
    {
      id: "departamentos" as TipoReporte,
      nombre: "Uso por Departamento",
      descripcion: "Consolidado de uso de días por departamento",
      icono: Users,
      color: "text-success",
    },
    {
      id: "proyecciones" as TipoReporte,
      nombre: "Proyecciones y Vencimientos",
      descripcion: "Días próximos a vencer y alertas",
      icono: AlertTriangle,
      color: "text-warning",
    },
    {
      id: "ausentismo" as TipoReporte,
      nombre: "Análisis de Ausentismo",
      descripcion: "Tendencias y estadísticas de ausencias",
      icono: TrendingUp,
      color: "text-error",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-content">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Reportes Avanzados</h1>
              <p className="text-base-content/70">
                Genera reportes detallados y exporta información del sistema
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

        {/* Selección de Tipo de Reporte */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {tiposReporte.map((tipo) => {
            const Icono = tipo.icono;
            return (
              <div
                key={tipo.id}
                onClick={() => {
                  setReporteSeleccionado(tipo.id);
                  setFiltros({ ...filtros, tipoReporte: tipo.id });
                  setDatosReporte(null);
                }}
                className={`card cursor-pointer transition-all hover:shadow-lg ${
                  reporteSeleccionado === tipo.id
                    ? "bg-primary text-primary-content ring-2 ring-primary"
                    : "bg-base-100 hover:bg-base-200"
                }`}
              >
                <div className="card-body">
                  <div className="flex items-start gap-3">
                    <Icono
                      className={`w-8 h-8 ${
                        reporteSeleccionado === tipo.id ? "text-primary-content" : tipo.color
                      }`}
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{tipo.nombre}</h3>
                      <p
                        className={`text-sm ${
                          reporteSeleccionado === tipo.id
                            ? "text-primary-content/80"
                            : "text-base-content/60"
                        }`}
                      >
                        {tipo.descripcion}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel de Filtros */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">
              <Filter className="w-5 h-5" />
              Filtros
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Rango de Fechas */}
              {(reporteSeleccionado === "solicitudes" || reporteSeleccionado === "ausentismo") && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Fecha Inicio</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={filtros.fechaInicio}
                      onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Fecha Fin</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={filtros.fechaFin}
                      onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Año */}
              {(reporteSeleccionado === "balances" || reporteSeleccionado === "proyecciones") && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Año</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filtros.anio}
                    onChange={(e) => setFiltros({ ...filtros, anio: Number(e.target.value) })}
                  >
                    {[2024, 2025, 2026].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Departamento */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Departamento</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filtros.departamentoId}
                  onChange={(e) => setFiltros({ ...filtros, departamentoId: e.target.value })}
                >
                  <option value="">Todos</option>
                  {departamentos.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Ausencia */}
              {reporteSeleccionado !== "departamentos" && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Tipo de Ausencia</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filtros.tipoAusenciaId}
                    onChange={(e) => setFiltros({ ...filtros, tipoAusenciaId: e.target.value })}
                  >
                    <option value="">Todos</option>
                    {tiposAusencia.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Estado (solo para solicitudes) */}
              {reporteSeleccionado === "solicitudes" && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Estado</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filtros.estado}
                    onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado_jefe">Aprobado Jefe</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={generarReporte}
                className="btn btn-primary gap-2"
                disabled={cargando}
              >
                {cargando ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Generar Reporte
              </button>

              {datosReporte && (
                <>
                  <button
                    onClick={() => exportarReporte("excel")}
                    className="btn btn-success gap-2 shadow-lg hover:shadow-xl transition-all"
                    title="Descargar reporte en formato CSV"
                  >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                  </button>
                  <button
                    onClick={() => exportarReporte("pdf")}
                    className="btn btn-error gap-2 shadow-lg hover:shadow-xl transition-all"
                    title="Descargar reporte en formato PDF"
                  >
                    <Download className="w-4 h-4" />
                    Exportar PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Área de Resultados */}
        {datosReporte && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title mb-4">
                <PieChart className="w-5 h-5" />
                Resultados
              </h2>

              {/* Renderizar diferentes vistas según el tipo de reporte */}
              {reporteSeleccionado === "balances" && (
                <ReporteBalances datos={datosReporte} />
              )}
              {reporteSeleccionado === "solicitudes" && (
                <ReporteSolicitudes datos={datosReporte} />
              )}
              {reporteSeleccionado === "departamentos" && (
                <ReporteDepartamentos datos={datosReporte} />
              )}
              {reporteSeleccionado === "proyecciones" && (
                <ReporteProyecciones datos={datosReporte} />
              )}
              {reporteSeleccionado === "ausentismo" && (
                <ReporteAusentismo datos={datosReporte} />
              )}
            </div>
          </div>
        )}

        {cargando && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="mt-4 text-base-content/60">Generando reporte...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componentes de visualización de reportes
function ReporteBalances({ datos }: { datos: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Departamento</th>
            <th>Tipo Ausencia</th>
            <th className="text-center">Asignados</th>
            <th className="text-center">Utilizados</th>
            <th className="text-center">Pendientes</th>
            <th className="text-center">Disponibles</th>
          </tr>
        </thead>
        <tbody>
          {datos.balances?.map((balance: any, index: number) => (
            <tr key={index}>
              <td>
                <div className="font-medium">{balance.empleado}</div>
                <div className="text-xs opacity-60">{balance.email}</div>
              </td>
              <td>{balance.departamento}</td>
              <td>
                <span className="badge badge-ghost">{balance.tipo_ausencia}</span>
              </td>
              <td className="text-center font-semibold">{balance.asignados}</td>
              <td className="text-center text-error">{balance.utilizados}</td>
              <td className="text-center text-warning">{balance.pendientes}</td>
              <td className="text-center text-success font-bold">{balance.disponibles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReporteSolicitudes({ datos }: { datos: any }) {
  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, string> = {
      pendiente: "badge-warning",
      aprobado_jefe: "badge-info",
      aprobado: "badge-success",
      rechazado: "badge-error",
      cancelado: "badge-ghost",
    };
    return badges[estado] || "badge-ghost";
  };

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Tipo</th>
            <th>Fecha Inicio</th>
            <th>Fecha Fin</th>
            <th className="text-center">Días</th>
            <th>Estado</th>
            <th>Fecha Solicitud</th>
          </tr>
        </thead>
        <tbody>
          {datos.solicitudes?.map((solicitud: any, index: number) => (
            <tr key={index}>
              <td>
                <div className="font-medium">{solicitud.empleado}</div>
              </td>
              <td>
                <span className="badge badge-ghost">{solicitud.tipo_ausencia}</span>
              </td>
              <td>{new Date(solicitud.fecha_inicio).toLocaleDateString()}</td>
              <td>{new Date(solicitud.fecha_fin).toLocaleDateString()}</td>
              <td className="text-center font-semibold">{solicitud.dias_solicitados}</td>
              <td>
                <span className={`badge ${getEstadoBadge(solicitud.estado)}`}>
                  {solicitud.estado}
                </span>
              </td>
              <td className="text-sm opacity-60">
                {new Date(solicitud.fecha_solicitud).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReporteDepartamentos({ datos }: { datos: any }) {
  return (
    <div className="space-y-6">
      {datos.departamentos?.map((dept: any, index: number) => (
        <div key={index} className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">{dept.nombre}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Empleados</div>
                <div className="stat-value text-primary">{dept.total_empleados}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Días Asignados</div>
                <div className="stat-value text-info">{dept.total_asignados}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Días Usados</div>
                <div className="stat-value text-error">{dept.total_usados}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">% Uso</div>
                <div className="stat-value text-success">{dept.porcentaje_uso}%</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReporteProyecciones({ datos }: { datos: any }) {
  return (
    <div className="space-y-6">
      {/* Días próximos a vencer */}
      {datos.proximos_vencer && datos.proximos_vencer.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Días Próximos a Vencer
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th className="text-center">Días Disponibles</th>
                  <th>Fecha Vencimiento</th>
                  <th>Días Restantes</th>
                </tr>
              </thead>
              <tbody>
                {datos.proximos_vencer.map((item: any, index: number) => (
                  <tr key={index}>
                    <td>{item.empleado}</td>
                    <td><span className="badge badge-ghost">{item.tipo_ausencia}</span></td>
                    <td className="text-center font-semibold text-warning">{item.dias_disponibles}</td>
                    <td>{new Date(item.fecha_vencimiento).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${item.dias_restantes < 30 ? 'badge-error' : 'badge-warning'}`}>
                        {item.dias_restantes} días
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empleados con días acumulados */}
      {datos.dias_acumulados && datos.dias_acumulados.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3">Empleados con Días Acumulados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datos.dias_acumulados.map((item: any, index: number) => (
              <div key={index} className="card bg-base-200">
                <div className="card-body">
                  <h4 className="font-bold">{item.empleado}</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-60">{item.tipo_ausencia}</span>
                    <span className="badge badge-lg badge-primary">{item.dias_acumulados} días</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReporteAusentismo({ datos }: { datos: any }) {
  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Total Ausencias</div>
          <div className="stat-value text-primary">{datos.resumen?.total_ausencias || 0}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Días Totales</div>
          <div className="stat-value text-info">{datos.resumen?.total_dias || 0}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Promedio/Empleado</div>
          <div className="stat-value text-success">{datos.resumen?.promedio_empleado || 0}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Tipo Más Usado</div>
          <div className="stat-value text-sm">{datos.resumen?.tipo_mas_usado || "-"}</div>
        </div>
      </div>

      {/* Tendencia por mes */}
      {datos.tendencia_mensual && (
        <div>
          <h3 className="text-lg font-bold mb-3">Tendencia Mensual</h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="text-center">Solicitudes</th>
                  <th className="text-center">Días</th>
                  <th className="text-center">Promedio Días/Solicitud</th>
                </tr>
              </thead>
              <tbody>
                {datos.tendencia_mensual.map((mes: any, index: number) => (
                  <tr key={index}>
                    <td className="font-medium">{mes.mes}</td>
                    <td className="text-center">{mes.solicitudes}</td>
                    <td className="text-center font-semibold">{mes.dias}</td>
                    <td className="text-center">{mes.promedio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
