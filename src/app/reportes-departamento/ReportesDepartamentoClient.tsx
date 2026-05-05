"use client";

import { useState, useEffect } from "react";
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
  Activity,
  Loader2,
} from "lucide-react";
import { notify, confirmAction } from '@/lib/swal';
import autoTable from 'jspdf-autotable';
import { generarPDFReporte, descargarPDF } from "@/lib/pdfExport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

// Constante para nombres de meses
const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

export default function ReportesDepartamentoClient({ session }: { session?: any } = {}) {
  const [reporte, setReporte] = useState<ReporteDepartamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
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
      notify.error("No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const exportarReporte = async (formato: 'csv' | 'pdf' = 'csv') => {
    if (!reporte) {
      notify.warning("No hay datos para exportar");
      return;
    }

    // Confirmación antes de exportar
    const formatoTexto = formato === 'csv' ? 'CSV' : 'PDF';
    const result = await confirmAction("¿Exportar reporte?", `Se descargará el reporte del departamento ${meses[mesSeleccionado - 1]} ${anioSeleccionado} en formato ${formatoTexto}`, { confirmText: "Exportar", icon: 'info' });

    if (!result.confirmed) return;

    try {
      setExportLoading(true);

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

        setExportLoading(false);
        notify.success("El reporte PDF completo se ha descargado exitosamente");
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

        setExportLoading(false);
        notify.success("El reporte CSV completo se ha descargado exitosamente");
      }
    } catch (error) {
      console.error('Error exportando:', error);
      setExportLoading(false);
      notify.error("No se pudo exportar el reporte");
    }
  };

  const calcularPorcentaje = (usado: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((usado / total) * 100);
  };

  const totalSolicitudes =
    reporte !== null
      ? reporte.solicitudesPendientes + reporte.solicitudesAprobadas + reporte.solicitudesRechazadas
      : 0;

  return (
    <div>
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="bg-muted/50 p-2.5 rounded-xl">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Reportes del Departamento</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Estadísticas y análisis de uso de vacaciones</p>
          </div>
        </div>

        {/* Filtros de período */}
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h2 className="text-[13px] font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                Período de análisis
              </h2>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Select
                  value={String(mesSeleccionado)}
                  onValueChange={(v) => setMesSeleccionado(Number(v))}
                >
                  <SelectTrigger className="flex-1 min-w-[140px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1, 1).toLocaleDateString("es-ES", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(anioSeleccionado)}
                  onValueChange={(v) => setAnioSeleccionado(Number(v))}
                >
                  <SelectTrigger className="w-24" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                    onClick={() => exportarReporte('csv')}
                    title="Descargar reporte en formato CSV"
                    disabled={exportLoading}
                  >
                    {exportLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => exportarReporte('pdf')}
                    title="Descargar reporte en formato PDF"
                    disabled={exportLoading}
                  >
                    {exportLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : !reporte ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[13px] text-foreground">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
            <span>No se pudo cargar el reporte</span>
          </div>
        ) : (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="rounded-2xl">
                <CardContent className="p-5 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">Total Equipo</p>
                      <p className="text-3xl font-bold tabular-nums text-sky-600 dark:text-sky-400">{reporte.totalColaboradores}</p>
                      <p className="text-xs text-muted-foreground">{reporte.colaboradoresActivos} activos</p>
                    </div>
                    <div className="text-sky-600 dark:text-sky-400 shrink-0">
                      <Users className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">De Vacaciones</p>
                      <p className="text-3xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{reporte.enVacacionesHoy}</p>
                      <p className="text-xs text-muted-foreground">Actualmente ausentes</p>
                    </div>
                    <div className="text-violet-600 dark:text-violet-400 shrink-0">
                      <Activity className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">Pendientes</p>
                      <p className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{reporte.solicitudesPendientes}</p>
                      <p className="text-xs text-muted-foreground">Por aprobar</p>
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 shrink-0">
                      <Clock className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">Uso Promedio</p>
                      <p className="text-3xl font-bold tabular-nums text-primary">{reporte.promedioUsoPorPersona}%</p>
                      <p className="text-xs text-muted-foreground">Por colaborador</p>
                    </div>
                    <div className="text-primary shrink-0">
                      <TrendingUp className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos de uso */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Balance total de días */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                    <PieChart className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    Balance Total de Días
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Asignados</span>
                      <span className="text-lg font-semibold tracking-tight text-primary">{reporte.diasTotalesAsignados}</span>
                    </div>
                    <Progress value={100} />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Usados</span>
                      <span className="text-lg font-semibold tracking-tight text-destructive">{reporte.diasTotalesUsados}</span>
                    </div>
                    <Progress
                      className="bg-destructive/20 [&_[data-slot=progress-indicator]]:bg-destructive"
                      value={calcularPorcentaje(reporte.diasTotalesUsados, reporte.diasTotalesAsignados)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {calcularPorcentaje(reporte.diasTotalesUsados, reporte.diasTotalesAsignados)}% utilizado
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Disponibles</span>
                      <span className="text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">{reporte.diasTotalesDisponibles}</span>
                    </div>
                    <Progress
                      className="bg-emerald-500/20 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                      value={calcularPorcentaje(reporte.diasTotalesDisponibles, reporte.diasTotalesAsignados)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {calcularPorcentaje(reporte.diasTotalesDisponibles, reporte.diasTotalesAsignados)}% disponible
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Estado de solicitudes */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    Estado de Solicitudes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <Card className="rounded-2xl shadow-none">
                      <CardContent className="p-4 pt-5">
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="text-amber-600 dark:text-amber-400">
                            <Clock className="w-5 h-5 md:w-6 md:h-6 mx-auto" />
                          </div>
                          <p className="text-sm text-muted-foreground">Pendientes</p>
                          <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{reporte.solicitudesPendientes}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-none">
                      <CardContent className="p-4 pt-5">
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6 mx-auto" />
                          </div>
                          <p className="text-sm text-muted-foreground">Aprobadas</p>
                          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{reporte.solicitudesAprobadas}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-none">
                      <CardContent className="p-4 pt-5">
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="text-destructive">
                            <XCircle className="w-5 h-5 md:w-6 md:h-6 mx-auto" />
                          </div>
                          <p className="text-sm text-muted-foreground">Rechazadas</p>
                          <p className="text-2xl font-bold tabular-nums text-destructive">{reporte.solicitudesRechazadas}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-4">
                    <Progress
                      className="bg-emerald-500/20 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                      value={calcularPorcentaje(reporte.solicitudesAprobadas, totalSolicitudes)}
                    />
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Tasa de aprobación: {calcularPorcentaje(
                        reporte.solicitudesAprobadas,
                        totalSolicitudes
                      )}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tablas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Próximas vacaciones */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    Próximas Vacaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reporte.proximasVacaciones.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No hay vacaciones programadas</p>
                    </div>
                  ) : (
                    <div className="-mx-2 md:mx-0 mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Días</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reporte.proximasVacaciones.map((vac, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{vac.usuario}</TableCell>
                              <TableCell className="text-xs whitespace-normal">
                                {new Date(vac.fechaInicio).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - {new Date(vac.fechaFin).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                              </TableCell>
                              <TableCell>
                                <Badge>{vac.dias}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top colaboradores por uso */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    Mayor Uso de Días
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reporte.topUsuarios.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-3 mt-2">
                      {reporte.topUsuarios.map((usuario, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/50 rounded-xl gap-2"
                        >
                          <div className="flex items-center gap-2 md:gap-3">
                            <Badge variant="secondary">{i + 1}</Badge>
                            <span className="font-medium text-sm md:text-base">{usuario.usuario}</span>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-destructive text-[13px]">{usuario.diasUsados} usados</p>
                            <p className="text-xs text-muted-foreground">{usuario.diasDisponibles} disponibles</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
