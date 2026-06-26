"use client";

import { useState, useEffect } from "react";
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
import { notify, confirmAction } from '@/lib/swal';
import { generarPDFReporte, descargarPDF } from "@/lib/pdfExport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [reporteSeleccionado, setReporteSeleccionado] = useState<TipoReporte>("balances");
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [datosReporte, setDatosReporte] = useState<any>(null);

  const [filtros, setFiltros] = useState<FiltrosReporte>({
    tipoReporte: "balances",
    fechaInicio: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    fechaFin: new Date().toISOString().slice(0, 10),
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
        tipo: reporteSeleccionado,
      } as any);

      const res = await fetch(`/api/reportes?${params}`);
      const data = await res.json();

      if (data.success) {
        setDatosReporte(data.data);
      } else {
        notify.error("Error", data.error || "Error al generar reporte");
      }
    } catch (error) {
      console.error("Error generando reporte:", error);
      notify.error("Error", "Error al generar reporte");
    } finally {
      setCargando(false);
    }
  };

  const exportarReporte = async (formato: "excel" | "pdf") => {
    if (!reporteSeleccionado) {
      notify.warning("Sin selección", "Primero selecciona un tipo de reporte");
      return;
    }

    // Confirmación antes de exportar
    const formatoTexto = formato === "excel" ? "CSV" : "PDF";
    const result = await confirmAction('¿Exportar reporte?', `Se descargará el reporte de ${tiposReporte.find(t => t.id === reporteSeleccionado)?.nombre} en formato ${formatoTexto}`, { confirmText: `Descargar ${formatoTexto}`, icon: 'info' });

    if (!result.confirmed) return;

    setExportLoading(true);
    try {

      if (formato === "pdf") {
        // Obtener datos COMPLETOS de la API para PDF (sin limitaciones del frontend)
        const params = new URLSearchParams({
          ...filtros,
          tipo: reporteSeleccionado,
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

        notify.success("Exportado", `${config.datos.length} registros exportados exitosamente`);
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

        notify.success("Exportado", "Archivo CSV descargado exitosamente con todos los registros");
      }
    } catch (error) {
      console.error("Error exportando reporte:", error);
      notify.error("Error", "Error al exportar reporte");
    } finally {
      setExportLoading(false);
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
      color: "text-blue-500",
    },
    {
      id: "departamentos" as TipoReporte,
      nombre: "Uso por Departamento",
      descripcion: "Consolidado de uso de días por departamento",
      icono: Users,
      color: "text-green-500",
    },
    {
      id: "proyecciones" as TipoReporte,
      nombre: "Proyecciones y Vencimientos",
      descripcion: "Días próximos a vencer y alertas",
      icono: AlertTriangle,
      color: "text-amber-500",
    },
    {
      id: "ausentismo" as TipoReporte,
      nombre: "Análisis de Ausentismo",
      descripcion: "Tendencias y estadísticas de ausencias",
      icono: TrendingUp,
      color: "text-red-500",
    },
  ];

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Reportes Avanzados</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Genera reportes detallados y exporta información del sistema
              </p>
            </div>
          </div>
        </div>

        {/* Selección de Tipo de Reporte */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
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
                className={`rounded-2xl border cursor-pointer transition-colors shadow-sm ${reporteSeleccionado === tipo.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/30"
                  }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icono
                      className={`w-5 h-5 ${reporteSeleccionado === tipo.id ? "text-primary-foreground" : tipo.color
                        }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm">{tipo.nombre}</h3>
                      <p
                        className={`text-[13px] mt-0.5 ${reporteSeleccionado === tipo.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
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
        <Card className="mb-6 shadow-sm border">
          <CardContent className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-semibold text-sm mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Filtros
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Rango de Fechas */}
              {(reporteSeleccionado === "solicitudes" || reporteSeleccionado === "ausentismo") && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha Inicio</Label>
                    <Input
                      type="date"
                      value={filtros.fechaInicio}
                      onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Fin</Label>
                    <Input
                      type="date"
                      value={filtros.fechaFin}
                      onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Año */}
              {(reporteSeleccionado === "balances" || reporteSeleccionado === "proyecciones") && (
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Select
                    value={filtros.anio.toString()}
                    onValueChange={(val) => setFiltros({ ...filtros, anio: Number(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Departamento */}
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={filtros.departamentoId || "todos"}
                  onValueChange={(val) => setFiltros({ ...filtros, departamentoId: val === "todos" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {departamentos.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Ausencia */}
              {reporteSeleccionado !== "departamentos" && (
                <div className="space-y-2">
                  <Label>Tipo de Ausencia</Label>
                  <Select
                    value={filtros.tipoAusenciaId || "todos"}
                    onValueChange={(val) => setFiltros({ ...filtros, tipoAusenciaId: val === "todos" ? "" : val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {tiposAusencia.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id.toString()}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Estado (solo para solicitudes) */}
              {reporteSeleccionado === "solicitudes" && (
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={filtros.estado || "todos"}
                    onValueChange={(val) => setFiltros({ ...filtros, estado: val === "todos" ? "" : val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendiente_jefe">Pendiente Jefe</SelectItem>
                      <SelectItem value="aprobada_jefe">Aprobada Jefe</SelectItem>
                      <SelectItem value="aprobada_rrhh">Aprobada RRHH</SelectItem>
                      <SelectItem value="rechazada_jefe">Rechazada Jefe</SelectItem>
                      <SelectItem value="rechazada_rrhh">Rechazada RRHH</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                      <SelectItem value="finalizada">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-wrap gap-2 mt-4 pt-2">
              <Button
                onClick={generarReporte}
                disabled={cargando}
              >
                {cargando ? (
                  <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                ) : (
                  <BarChart3 className="w-4 h-4 mr-2" />
                )}
                Generar Reporte
              </Button>

              {datosReporte && (
                <>
                  <Button
                    onClick={() => exportarReporte("excel")}
                    variant="outline"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    title="Descargar reporte en formato CSV"
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Exportar CSV
                  </Button>
                  <Button
                    onClick={() => exportarReporte("pdf")}
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    title="Descargar reporte en formato PDF"
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Exportar PDF
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Área de Resultados */}
        {datosReporte && (
          <Card className="mb-6 shadow-sm border">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold text-sm mb-4">
                <PieChart className="w-4 h-4 text-muted-foreground" />
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
            </CardContent>
          </Card>
        )}

        {cargando && (
          <Card className="rounded-2xl shadow-sm border mt-6">
            <CardContent className="p-5 flex items-center justify-center py-12 flex-col">
              <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></span>
              <p className="mt-4 text-[13px] text-muted-foreground">Generando reporte...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Componentes de visualización de reportes
function ReporteBalances({ datos }: { datos: any }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Tipo Ausencia</TableHead>
            <TableHead className="text-center">Asignados</TableHead>
            <TableHead className="text-center">Utilizados</TableHead>
            <TableHead className="text-center">Pendientes</TableHead>
            <TableHead className="text-center">Disponibles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datos.balances?.map((balance: any, index: number) => (
            <TableRow key={index}>
              <TableCell>
                <div className="font-medium">{balance.empleado}</div>
                <div className="text-xs text-muted-foreground">{balance.email}</div>
              </TableCell>
              <TableCell>{balance.departamento}</TableCell>
              <TableCell>
                <Badge variant="secondary">{balance.tipo_ausencia}</Badge>
              </TableCell>
              <TableCell className="text-center font-semibold">{balance.asignados}</TableCell>
              <TableCell className="text-center text-red-500">{balance.utilizados}</TableCell>
              <TableCell className="text-center text-amber-500">{balance.pendientes}</TableCell>
              <TableCell className="text-center text-green-600 font-semibold">{balance.disponibles}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReporteSolicitudes({ datos }: { datos: any }) {
  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, string> = {
      pendiente_jefe: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      aprobada_jefe: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      aprobada_rrhh: "bg-green-100 text-green-800 hover:bg-green-100",
      rechazada_jefe: "bg-red-100 text-red-800 hover:bg-red-100",
      rechazada_rrhh: "bg-red-100 text-red-800 hover:bg-red-100",
      cancelada: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      finalizada: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    };
    return badges[estado] || "bg-gray-100 text-gray-800 hover:bg-gray-100";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha Inicio</TableHead>
            <TableHead>Fecha Fin</TableHead>
            <TableHead className="text-center">Días</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha Solicitud</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datos.solicitudes?.map((solicitud: any, index: number) => (
            <TableRow key={index}>
              <TableCell>
                <div className="font-medium">{solicitud.empleado}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{solicitud.tipo_ausencia}</Badge>
              </TableCell>
              <TableCell>{new Date(solicitud.fecha_inicio).toLocaleDateString()}</TableCell>
              <TableCell>{new Date(solicitud.fecha_fin).toLocaleDateString()}</TableCell>
              <TableCell className="text-center font-semibold">{solicitud.dias_solicitados}</TableCell>
              <TableCell>
                <Badge className={getEstadoBadge(solicitud.estado)}>
                  {solicitud.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(solicitud.fecha_solicitud).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReporteDepartamentos({ datos }: { datos: any }) {
  return (
    <div className="space-y-6">
      {datos.departamentos?.map((dept: any, index: number) => (
        <Card key={index} className="shadow-sm border">
          <CardContent className="p-4 sm:p-5">
            <h3 className="font-semibold text-sm mb-3">{dept.nombre}</h3>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4 md:gap-4">
              <div className="bg-background rounded-xl p-3 border shadow-sm">
                <div className="text-xs text-muted-foreground">Empleados</div>
                <div className="text-lg font-bold text-primary mt-1">{dept.total_empleados}</div>
              </div>
              <div className="bg-background rounded-xl p-3 border shadow-sm">
                <div className="text-xs text-muted-foreground">Días Asignados</div>
                <div className="text-lg font-bold text-blue-500 mt-1">{dept.total_asignados}</div>
              </div>
              <div className="bg-background rounded-xl p-3 border shadow-sm">
                <div className="text-xs text-muted-foreground">Días Usados</div>
                <div className="text-lg font-bold text-red-500 mt-1">{dept.total_usados}</div>
              </div>
              <div className="bg-background rounded-xl p-3 border shadow-sm">
                <div className="text-xs text-muted-foreground">% Uso</div>
                <div className="text-lg font-bold text-green-600 mt-1">{dept.porcentaje_uso}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Días Próximos a Vencer
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Días Disponibles</TableHead>
                  <TableHead>Fecha Vencimiento</TableHead>
                  <TableHead>Días Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.proximos_vencer.map((item: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{item.empleado}</TableCell>
                    <TableCell><Badge variant="secondary">{item.tipo_ausencia}</Badge></TableCell>
                    <TableCell className="text-center font-semibold text-amber-500">{item.dias_disponibles}</TableCell>
                    <TableCell>{new Date(item.fecha_vencimiento).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={item.dias_restantes < 30 ? "destructive" : "secondary"} className={item.dias_restantes >= 30 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}>
                        {item.dias_restantes} días
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Empleados con días acumulados */}
      {datos.dias_acumulados && datos.dias_acumulados.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Empleados con Días Acumulados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datos.dias_acumulados.map((item: any, index: number) => (
              <Card key={index} className="shadow-sm border">
                <CardContent className="p-4 sm:p-5">
                  <h4 className="font-semibold text-sm">{item.empleado}</h4>
                  <div className="mt-2 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                    <span className="text-[13px] text-muted-foreground">{item.tipo_ausencia}</span>
                    <Badge variant="default" className="bg-primary hover:bg-primary">{item.dias_acumulados} días</Badge>
                  </div>
                </CardContent>
              </Card>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Ausencias</div>
            <div className="text-2xl font-bold text-primary mt-1">{datos.resumen?.total_ausencias || 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Días Totales</div>
            <div className="text-2xl font-bold text-blue-500 mt-1">{datos.resumen?.total_dias || 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Promedio/Empleado</div>
            <div className="text-2xl font-bold text-green-500 mt-1">{datos.resumen?.promedio_empleado || 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Tipo Más Usado</div>
            <div className="text-xl font-bold mt-1 truncate">{datos.resumen?.tipo_mas_usado || "-"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tendencia por mes */}
      {datos.tendencia_mensual && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Tendencia Mensual</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-center">Solicitudes</TableHead>
                  <TableHead className="text-center">Días</TableHead>
                  <TableHead className="text-center">Promedio Días/Solicitud</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.tendencia_mensual.map((mes: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{mes.mes}</TableCell>
                    <TableCell className="text-center">{mes.solicitudes}</TableCell>
                    <TableCell className="text-center font-semibold">{mes.dias}</TableCell>
                    <TableCell className="text-center">{mes.promedio}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
