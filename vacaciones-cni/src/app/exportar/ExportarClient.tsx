"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  CheckCircle2
} from "lucide-react";
import Swal from "sweetalert2";

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
  const router = useRouter();
  const [exportacionSeleccionada, setExportacionSeleccionada] = useState<TipoExportacion | null>(null);
  const [formato, setFormato] = useState<FormatoExportacion>("excel");
  const [cargando, setCargando] = useState(false);
  const [incluirEliminados, setIncluirEliminados] = useState(false);
  const [rangoFechas, setRangoFechas] = useState({
    inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0],
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
      color: "text-accent",
    },
    {
      id: "departamentos",
      nombre: "Departamentos",
      descripcion: "Exportar estructura de departamentos",
      icono: Building2,
      color: "text-info",
    },
    {
      id: "auditoria",
      nombre: "Auditoría",
      descripcion: "Exportar registros de auditoría del sistema",
      icono: FileText,
      color: "text-warning",
    },
    {
      id: "completo",
      nombre: "Exportación Completa",
      descripcion: "Exportar todos los datos del sistema (múltiples archivos)",
      icono: Database,
      color: "text-success",
    },
  ];

  const exportarDatos = async () => {
    if (!exportacionSeleccionada) {
      await Swal.fire({
        icon: "warning",
        title: "Selecciona una opción",
        text: "Por favor selecciona qué datos deseas exportar",
      });
      return;
    }

    setCargando(true);
    try {
      const params = new URLSearchParams({
        tipo: exportacionSeleccionada,
        formato,
        incluirEliminados: incluirEliminados.toString(),
        fechaInicio: rangoFechas.inicio,
        fechaFin: rangoFechas.fin,
      });

      const res = await fetch(`/api/exportar?${params}`);
      
      if (!res.ok) {
        throw new Error("Error en la exportación");
      }

      // Obtener el nombre del archivo del header
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `exportacion_${exportacionSeleccionada}_${new Date().getTime()}.${formato}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Descargar el archivo
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await Swal.fire({
        icon: "success",
        title: "Exportación exitosa",
        text: `Los datos se han exportado correctamente`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error exportando datos:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al exportar los datos. Por favor intenta nuevamente.",
      });
    } finally {
      setCargando(false);
    }
  };

  const opcionSeleccionada = opcionesExportacion.find(o => o.id === exportacionSeleccionada);

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-success to-success/80 text-success-content">
              <Download className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Exportar Datos</h1>
              <p className="text-base-content/70">
                Descarga información del sistema en diferentes formatos
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

        {/* Selección de tipo de exportación */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Selecciona qué datos exportar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opcionesExportacion.map((opcion) => {
              const Icono = opcion.icono;
              return (
                <div
                  key={opcion.id}
                  onClick={() => setExportacionSeleccionada(opcion.id)}
                  className={`card cursor-pointer transition-all hover:shadow-lg ${
                    exportacionSeleccionada === opcion.id
                      ? "bg-primary text-primary-content ring-2 ring-primary"
                      : "bg-base-100 hover:bg-base-200"
                  }`}
                >
                  <div className="card-body">
                    <div className="flex items-start gap-3">
                      <Icono
                        className={`w-8 h-8 ${
                          exportacionSeleccionada === opcion.id 
                            ? "text-primary-content" 
                            : opcion.color
                        }`}
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{opcion.nombre}</h3>
                        <p
                          className={`text-sm ${
                            exportacionSeleccionada === opcion.id
                              ? "text-primary-content/80"
                              : "text-base-content/60"
                          }`}
                        >
                          {opcion.descripcion}
                        </p>
                      </div>
                      {exportacionSeleccionada === opcion.id && (
                        <CheckCircle2 className="w-6 h-6" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuración de exportación */}
        {exportacionSeleccionada && (
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <h2 className="card-title mb-4">Configuración de Exportación</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formato */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Formato de archivo</span>
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="formato"
                        className="radio radio-primary"
                        checked={formato === "excel"}
                        onChange={() => setFormato("excel")}
                      />
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-success" />
                        <span>Excel (.xlsx)</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="formato"
                        className="radio radio-primary"
                        checked={formato === "csv"}
                        onChange={() => setFormato("csv")}
                      />
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-info" />
                        <span>CSV</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="formato"
                        className="radio radio-primary"
                        checked={formato === "json"}
                        onChange={() => setFormato("json")}
                      />
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-warning" />
                        <span>JSON</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Opciones adicionales */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Opciones</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={incluirEliminados}
                      onChange={(e) => setIncluirEliminados(e.target.checked)}
                    />
                    <span>Incluir registros eliminados</span>
                  </label>
                </div>

                {/* Rango de fechas (solo para solicitudes y auditoría) */}
                {(exportacionSeleccionada === "solicitudes" || exportacionSeleccionada === "auditoria") && (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Fecha Inicio</span>
                      </label>
                      <input
                        type="date"
                        className="input input-bordered"
                        value={rangoFechas.inicio}
                        onChange={(e) => setRangoFechas({ ...rangoFechas, inicio: e.target.value })}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Fecha Fin</span>
                      </label>
                      <input
                        type="date"
                        className="input input-bordered"
                        value={rangoFechas.fin}
                        onChange={(e) => setRangoFechas({ ...rangoFechas, fin: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Información y botón de exportación */}
        {exportacionSeleccionada && opcionSeleccionada && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-lg bg-gradient-to-br from-success to-success/80 text-success-content`}>
                    {(() => {
                      const Icono = opcionSeleccionada.icono;
                      return <Icono className="w-8 h-8" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{opcionSeleccionada.nombre}</h3>
                    <p className="text-base-content/60">
                      Formato: {formato.toUpperCase()} 
                      {incluirEliminados && " • Incluye eliminados"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportarDatos}
                  disabled={cargando}
                  className="btn btn-success btn-lg gap-2"
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
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="alert alert-info mt-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">Información importante</h3>
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
