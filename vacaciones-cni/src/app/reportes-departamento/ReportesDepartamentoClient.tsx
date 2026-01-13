"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Filter,
  PieChart,
  Activity
} from "lucide-react";
import Swal from "sweetalert2";
import autoTable from 'jspdf-autotable';
import { generarPDFReporte, descargarPDF } from "@/lib/pdfExport";

interface ReporteDepartamento {
  totalColaboradores: number;
  colaboradoresActivos: number;
  enVacacionesHoy: number;
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesRechazadas: number;
  diasTotalesAsignados: number;
  diasTotalesUsados: number;
  diasTotalesDisponibles: number;
  promedioUsoPorPersona: number;
  proximasVacaciones: Array<{
    usuario: string;
    fechaInicio: string;
    fechaFin: string;
    dias: number;
  }>;
  topUsuarios: Array<{
    usuario: string;
    diasUsados: number;
    diasDisponibles: number;
  }>;
}

export default function ReportesDepartamentoClient() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteDepartamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());

  useEffect(() => {
    cargarReporte();
  }, [mesSeleccionado, anioSeleccionado]);

  const cargarReporte = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reportes/departamento?mes=${mesSeleccionado}&anio=${anioSeleccionado}`);
      const data = await response.json();

      if (data.success) {
        setReporte(data.reporte);
      }
    } catch (error) {
      console.error("Error al cargar reporte:", error);
      Swal.fire("Error", "No se pudo cargar el reporte", "error");
    } finally {
      setLoading(false);
    }
  };

  const exportarReporte = async (formato: 'csv' | 'pdf' = 'csv') => {
    if (!reporte) {
      await Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay datos para exportar",
      });
      return;
    }

    // Confirmación antes de exportar
    const formatoTexto = formato === 'csv' ? 'CSV' : 'PDF';
    const result = await Swal.fire({
      title: "¿Exportar reporte?",
      html: `Se descargará el reporte del departamento<br><strong>${meses[mesSeleccionado - 1]} ${anioSeleccionado}</strong> en formato ${formatoTexto}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "<i class='fas fa-download'></i> Sí, exportar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      // Mostrar indicador de carga
      Swal.fire({
        title: 'Generando exportación...',
        html: 'Por favor espera',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      if (formato === 'pdf') {
        // Preparar datos para PDF
        const proximasVacaciones = reporte.proximasVacaciones.map(vac => ({
          ...vac,
          periodo: `${new Date(vac.fechaInicio).toLocaleDateString()} - ${new Date(vac.fechaFin).toLocaleDateString()}`,
        }));

        const topUsuarios = reporte.topUsuarios;

        // Crear documento con datos de resumen
        const datosResumen = [
          { concepto: 'Colaboradores Totales', valor: reporte.totalColaboradores },
          { concepto: 'Colaboradores Activos', valor: reporte.colaboradoresActivos },
          { concepto: 'En Vacaciones Hoy', valor: reporte.enVacacionesHoy },
          { concepto: 'Solicitudes Pendientes', valor: reporte.solicitudesPendientes },
          { concepto: 'Solicitudes Aprobadas', valor: reporte.solicitudesAprobadas },
          { concepto: 'Solicitudes Rechazadas', valor: reporte.solicitudesRechazadas },
          { concepto: 'Días Totales Asignados', valor: reporte.diasTotalesAsignados },
          { concepto: 'Días Totales Usados', valor: reporte.diasTotalesUsados },
          { concepto: 'Días Totales Disponibles', valor: reporte.diasTotalesDisponibles },
          { concepto: 'Promedio Uso por Persona', valor: reporte.promedioUsoPorPersona.toFixed(1) },
        ];

        const config = {
          titulo: 'Reporte Departamental',
          subtitulo: `${meses[mesSeleccionado - 1]} ${anioSeleccionado}`,
          datos: datosResumen,
          columnas: ['Concepto', 'Valor'],
          campos: ['concepto', 'valor'],
        };

        const doc = generarPDFReporte(config);

        // Añadir segunda página con próximas vacaciones si hay datos
        if (proximasVacaciones.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setTextColor(59, 130, 246);
          doc.text('Próximas Vacaciones', doc.internal.pageSize.width / 2, 15, { align: 'center' });

          autoTable(doc, {
            head: [['Colaborador', 'Período', 'Días']],
            body: proximasVacaciones.map(v => [v.usuario, v.periodo, v.dias]),
            startY: 25,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
          });
        }

        // Añadir tercera página con top usuarios
        if (topUsuarios.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setTextColor(59, 130, 246);
          doc.text('Mayor Uso de Días', doc.internal.pageSize.width / 2, 15, { align: 'center' });

          autoTable(doc, {
            head: [['Colaborador', 'Días Usados', 'Días Disponibles']],
            body: topUsuarios.map(u => [u.usuario, u.diasUsados, u.diasDisponibles]),
            startY: 25,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
          });
        }

        descargarPDF(doc, `reporte_departamento_${mesSeleccionado}_${anioSeleccionado}.pdf`);

        Swal.close(); // Cerrar el loading
        Swal.fire({
          icon: "success",
          title: "¡Exportado!",
          text: "El reporte PDF completo se ha descargado exitosamente",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Exportar CSV desde API
        const params = new URLSearchParams({
          formato: 'excel',
          tipoReporte: 'departamentos',
          anio: String(anioSeleccionado),
          mes: String(mesSeleccionado)
        });

        const response = await fetch(`/api/reportes/exportar?${params}`);
        
        if (!response.ok) {
          throw new Error('Error al exportar');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_departamento_${mesSeleccionado}_${anioSeleccionado}.csv`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);

        Swal.close(); // Cerrar el loading
        Swal.fire({
          icon: "success",
          title: "¡Exportado!",
          text: "El reporte CSV completo se ha descargado exitosamente",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error('Error exportando:', error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo exportar el reporte",
      });
    }
  };

  const calcularPorcentaje = (usado: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((usado / total) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-secondary to-secondary/70 p-4 rounded-2xl shadow-lg">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-base-content">Reportes del Departamento</h1>
            <p className="text-base-content/70">Estadísticas y análisis de uso de vacaciones</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost gap-2"
          >
            ← Volver
          </button>
        </div>

        {/* Filtros de período */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">
                <Filter className="w-5 h-5" />
                Período de análisis
              </h2>
              <div className="flex gap-2">
                <select
                  className="select select-bordered select-sm"
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleDateString("es-ES", { month: "long" })}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                >
                  {[2024, 2025, 2026].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button 
                    className="btn btn-sm btn-success gap-1 shadow-lg hover:shadow-xl transition-all" 
                    onClick={() => exportarReporte('csv')}
                    title="Descargar reporte en formato CSV"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button 
                    className="btn btn-sm btn-error gap-1 shadow-lg hover:shadow-xl transition-all" 
                    onClick={() => exportarReporte('pdf')}
                    title="Descargar reporte en formato PDF"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : !reporte ? (
          <div className="alert alert-warning">
            <AlertCircle className="w-5 h-5" />
            <span>No se pudo cargar el reporte</span>
          </div>
        ) : (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-figure text-info">
                  <Users className="w-8 h-8" />
                </div>
                <div className="stat-title">Total Equipo</div>
                <div className="stat-value text-info">{reporte.totalColaboradores}</div>
                <div className="stat-desc">{reporte.colaboradoresActivos} activos</div>
              </div>

              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-figure text-accent">
                  <Activity className="w-8 h-8" />
                </div>
                <div className="stat-title">De Vacaciones</div>
                <div className="stat-value text-accent">{reporte.enVacacionesHoy}</div>
                <div className="stat-desc">Actualmente ausentes</div>
              </div>

              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-figure text-warning">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="stat-title">Pendientes</div>
                <div className="stat-value text-warning">{reporte.solicitudesPendientes}</div>
                <div className="stat-desc">Por aprobar</div>
              </div>

              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-figure text-primary">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div className="stat-title">Uso Promedio</div>
                <div className="stat-value text-primary">{reporte.promedioUsoPorPersona}%</div>
                <div className="stat-desc">Por colaborador</div>
              </div>
            </div>

            {/* Gráficos de uso */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Balance total de días */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">
                    <PieChart className="w-5 h-5" />
                    Balance Total de Días
                  </h2>
                  
                  <div className="space-y-4 mt-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Asignados</span>
                        <span className="text-2xl font-bold text-primary">{reporte.diasTotalesAsignados}</span>
                      </div>
                      <progress className="progress progress-primary w-full" value={100} max={100}></progress>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Usados</span>
                        <span className="text-2xl font-bold text-error">{reporte.diasTotalesUsados}</span>
                      </div>
                      <progress 
                        className="progress progress-error w-full" 
                        value={reporte.diasTotalesUsados} 
                        max={reporte.diasTotalesAsignados}
                      ></progress>
                      <span className="text-xs text-base-content/60">
                        {calcularPorcentaje(reporte.diasTotalesUsados, reporte.diasTotalesAsignados)}% utilizado
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Disponibles</span>
                        <span className="text-2xl font-bold text-success">{reporte.diasTotalesDisponibles}</span>
                      </div>
                      <progress 
                        className="progress progress-success w-full" 
                        value={reporte.diasTotalesDisponibles} 
                        max={reporte.diasTotalesAsignados}
                      ></progress>
                      <span className="text-xs text-base-content/60">
                        {calcularPorcentaje(reporte.diasTotalesDisponibles, reporte.diasTotalesAsignados)}% disponible
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de solicitudes */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">
                    <BarChart3 className="w-5 h-5" />
                    Estado de Solicitudes
                  </h2>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="stat bg-base-200 rounded p-4">
                      <div className="stat-figure text-warning">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div className="stat-title text-xs">Pendientes</div>
                      <div className="stat-value text-2xl text-warning">{reporte.solicitudesPendientes}</div>
                    </div>

                    <div className="stat bg-base-200 rounded p-4">
                      <div className="stat-figure text-success">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div className="stat-title text-xs">Aprobadas</div>
                      <div className="stat-value text-2xl text-success">{reporte.solicitudesAprobadas}</div>
                    </div>

                    <div className="stat bg-base-200 rounded p-4">
                      <div className="stat-figure text-error">
                        <XCircle className="w-6 h-6" />
                      </div>
                      <div className="stat-title text-xs">Rechazadas</div>
                      <div className="stat-value text-2xl text-error">{reporte.solicitudesRechazadas}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <progress 
                      className="progress progress-success w-full" 
                      value={reporte.solicitudesAprobadas} 
                      max={reporte.solicitudesPendientes + reporte.solicitudesAprobadas + reporte.solicitudesRechazadas}
                    ></progress>
                    <p className="text-xs text-center text-base-content/60 mt-2">
                      Tasa de aprobación: {calcularPorcentaje(
                        reporte.solicitudesAprobadas, 
                        reporte.solicitudesPendientes + reporte.solicitudesAprobadas + reporte.solicitudesRechazadas
                      )}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tablas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Próximas vacaciones */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">
                    <Calendar className="w-5 h-5" />
                    Próximas Vacaciones
                  </h2>

                  {reporte.proximasVacaciones.length === 0 ? (
                    <div className="text-center py-8 text-base-content/60">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No hay vacaciones programadas</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Colaborador</th>
                            <th>Período</th>
                            <th>Días</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reporte.proximasVacaciones.map((vac, i) => (
                            <tr key={i}>
                              <td className="font-medium">{vac.usuario}</td>
                              <td className="text-xs">
                                {new Date(vac.fechaInicio).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - {new Date(vac.fechaFin).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                              </td>
                              <td>
                                <div className="badge badge-primary badge-sm">{vac.dias}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Top colaboradores por uso */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">
                    <TrendingUp className="w-5 h-5" />
                    Mayor Uso de Días
                  </h2>

                  {reporte.topUsuarios.length === 0 ? (
                    <div className="text-center py-8 text-base-content/60">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {reporte.topUsuarios.map((usuario, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-base-200 rounded">
                          <div className="flex items-center gap-3">
                            <div className="badge badge-neutral">{i + 1}</div>
                            <span className="font-medium">{usuario.usuario}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-error">{usuario.diasUsados} usados</p>
                            <p className="text-xs text-base-content/60">{usuario.diasDisponibles} disponibles</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
