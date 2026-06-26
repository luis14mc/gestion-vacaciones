"use client";

import { useState } from "react";
import { Session } from "next-auth";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Database,
  Users,
  Calendar,
  Building2,
  FileCheck,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { notify } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ExportarClientProps {
  session: Session;
}

type TipoExportacion =
  | "usuarios"
  | "solicitudes"
  | "balances"
  | "departamentos"
  | "auditoria"
  | "completo";

type FormatoExportacion = "excel" | "csv" | "json";

interface OpcionExportacion {
  id: TipoExportacion;
  nombre: string;
  descripcion: string;
  icono: any;
  color: string;
}

export default function ExportarClient({ session }: ExportarClientProps) {
  const [exportacionSeleccionada, setExportacionSeleccionada] =
    useState<TipoExportacion | null>(null);
  const [formato, setFormato] = useState<FormatoExportacion>("excel");
  const [cargando, setCargando] = useState(false);
  const [incluirEliminados, setIncluirEliminados] = useState(false);
  const [rangoFechas, setRangoFechas] = useState({
    inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    fin: new Date().toISOString().split("T")[0],
  });

  const opcionesExportacion: OpcionExportacion[] = [
    {
      id: "usuarios",
      nombre: "Usuarios",
      descripcion: "Exportar listado completo de usuarios del sistema",
      icono: Users,
      color: "text-primary",
    },
    {
      id: "solicitudes",
      nombre: "Solicitudes",
      descripcion: "Exportar historial de solicitudes de ausencias",
      icono: FileCheck,
      color: "text-secondary",
    },
    {
      id: "balances",
      nombre: "Balances de Días",
      descripcion: "Exportar balances de días disponibles por usuario",
      icono: Calendar,
      color: "text-purple-500",
    },
    {
      id: "departamentos",
      nombre: "Departamentos",
      descripcion: "Exportar estructura de departamentos",
      icono: Building2,
      color: "text-blue-500",
    },
    {
      id: "auditoria",
      nombre: "Auditoría",
      descripcion: "Exportar registros de auditoría del sistema",
      icono: FileText,
      color: "text-amber-500",
    },
    {
      id: "completo",
      nombre: "Exportación Completa",
      descripcion: "Exportar todos los datos del sistema (múltiples archivos)",
      icono: Database,
      color: "text-green-500",
    },
  ];

  const exportarDatos = async () => {
    if (!exportacionSeleccionada) {
      notify.warning(
        "Selecciona una opción",
        "Por favor selecciona qué datos deseas exportar"
      );
      return;
    }

    setCargando(true);
    try {
      const params = new URLSearchParams({
        tipo: exportacionSeleccionada,
        formato,
        incluirEliminados: incluirEliminados.toString(),
        fechaInicio: rangoFechas.inicio ?? '',
        fechaFin: rangoFechas.fin ?? '',
      });

      const res = await fetch(`/api/exportar?${params}`);

      if (!res.ok) {
        throw new Error("Error en la exportación");
      }

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `exportacion_${exportacionSeleccionada}_${new Date().getTime()}.${formato}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch?.[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify.success(
        "Exportación exitosa",
        "Los datos se han exportado correctamente"
      );
    } catch (error) {
      console.error("Error exportando datos:", error);
      notify.error(
        "Error",
        "Error al exportar los datos. Por favor intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  };

  const opcionSeleccionada = opcionesExportacion.find(
    (o) => o.id === exportacionSeleccionada
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <Download className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                Exportar Datos
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Descarga información del sistema en diferentes formatos
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Selecciona qué datos exportar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opcionesExportacion.map((opcion) => {
              const Icono = opcion.icono;
              return (
                <div
                  key={opcion.id}
                  onClick={() => setExportacionSeleccionada(opcion.id)}
                  className={cn(
                    "rounded-2xl border cursor-pointer transition-colors",
                    exportacionSeleccionada === opcion.id
                      ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary"
                      : "border-border bg-muted hover:bg-muted/80"
                  )}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <Icono
                        className={cn(
                          "w-8 h-8",
                          exportacionSeleccionada === opcion.id
                            ? "text-primary-foreground"
                            : opcion.color
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13px] font-semibold">
                          {opcion.nombre}
                        </h3>
                        <p
                          className={cn(
                            "text-sm",
                            exportacionSeleccionada === opcion.id
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {opcion.descripcion}
                        </p>
                      </div>
                      {exportacionSeleccionada === opcion.id && (
                        <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {exportacionSeleccionada && (
          <Card className="rounded-2xl mb-6 gap-0 py-0 shadow-sm">
            <CardHeader className="px-4 pt-5 pb-0 sm:px-5">
              <CardTitle className="text-[13px] font-semibold">
                Configuración de Exportación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold">Formato de archivo</Label>
                  <RadioGroup
                    value={formato}
                    onValueChange={(v) =>
                      setFormato(v as FormatoExportacion)
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="excel" id="formato-excel" />
                      <Label
                        htmlFor="formato-excel"
                        className="cursor-pointer font-normal flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        <span>Excel (.xlsx)</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="csv" id="formato-csv" />
                      <Label
                        htmlFor="formato-csv"
                        className="cursor-pointer font-normal flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-sky-600" />
                        <span>CSV</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="json" id="formato-json" />
                      <Label
                        htmlFor="formato-json"
                        className="cursor-pointer font-normal flex items-center gap-2"
                      >
                        <Database className="w-4 h-4 text-amber-600" />
                        <span>JSON</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Opciones</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="incluir-eliminados"
                      checked={incluirEliminados}
                      onCheckedChange={(c) =>
                        setIncluirEliminados(c === true)
                      }
                    />
                    <Label
                      htmlFor="incluir-eliminados"
                      className="cursor-pointer font-normal"
                    >
                      Incluir registros eliminados
                    </Label>
                  </div>
                </div>

                {(exportacionSeleccionada === "solicitudes" ||
                  exportacionSeleccionada === "auditoria") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-inicio" className="font-semibold">
                        Fecha Inicio
                      </Label>
                      <Input
                        id="fecha-inicio"
                        type="date"
                        value={rangoFechas.inicio}
                        onChange={(e) =>
                          setRangoFechas({
                            ...rangoFechas,
                            inicio: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-fin" className="font-semibold">
                        Fecha Fin
                      </Label>
                      <Input
                        id="fecha-fin"
                        type="date"
                        value={rangoFechas.fin}
                        onChange={(e) =>
                          setRangoFechas({
                            ...rangoFechas,
                            fin: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {exportacionSeleccionada && opcionSeleccionada && (
          <Card className="rounded-2xl gap-0 py-0 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="bg-muted p-2.5 rounded-xl">
                    {(() => {
                      const Icono = opcionSeleccionada.icono;
                      return (
                        <Icono className="w-4 h-4 text-muted-foreground" />
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold tracking-tight">
                      {opcionSeleccionada.nombre}
                    </h3>
                    <p className="text-muted-foreground">
                      Formato: {formato.toUpperCase()}
                      {incluirEliminados && " • Incluye eliminados"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={exportarDatos}
                  disabled={cargando}
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700 sm:w-auto"
                >
                  {cargando ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Exportar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 mt-6 flex gap-3">
          <Info className="shrink-0 w-6 h-6 mt-0.5" />
          <div>
            <h3 className="font-semibold">Información importante</h3>
            <div className="text-sm">
              <p>• Los datos exportados respetan los permisos de tu rol de usuario</p>
              <p>• Las exportaciones grandes pueden tardar varios segundos</p>
              <p>• Los archivos Excel incluyen formato y colores para mejor visualización</p>
              <p>• La exportación completa genera un archivo ZIP con múltiples archivos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
