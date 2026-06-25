import { useState, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle, FileText, ChevronRight, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/swal";

interface FilaImportacion {
  fila: number;
  email: string;
  nombre: string;
  apellido: string;
  numeroEmpleado?: string;
  departamento: string;
  cargo: string;
  esJefe: boolean;
  esDirector: boolean;
  emailJefeSuperior?: string | null;
  errores: string[];
}

interface ImportarUsuariosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportarUsuariosDialog({ open, onOpenChange, onSuccess }: ImportarUsuariosDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [previewData, setPreviewData] = useState<{
    valido: boolean;
    total: number;
    conErrores: number;
    filas: FilaImportacion[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setStep("upload");
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleValidate = async () => {
    if (!file) {
      notify.warning("Debe seleccionar un archivo");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "validate");

      const res = await fetch("/api/usuarios/importar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPreviewData({
          valido: data.valido,
          total: data.total,
          conErrores: data.conErrores,
          filas: data.filas,
        });
        setStep("preview");
      } else {
        notify.error(data.error || "Error al validar el archivo");
      }
    } catch (error) {
      console.error("Error validando:", error);
      notify.error("Ocurrió un error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  };

  const descargarCredencialesCSV = (
    credenciales: Array<{ email: string; nombre: string; password: string }>
  ) => {
    const encabezado = "email,nombre,password_temporal";
    const filas = credenciales.map(
      (c) => `${c.email},"${c.nombre.replace(/"/g, '""')}",${c.password}`
    );
    const csv = "﻿" + [encabezado, ...filas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales_temporales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "import");

      const res = await fetch("/api/usuarios/importar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        notify.success(data.message || "Usuarios importados con éxito");
        if (Array.isArray(data.credenciales) && data.credenciales.length > 0) {
          descargarCredencialesCSV(data.credenciales);
          notify.success(
            "Se descargó el archivo de credenciales temporales. Distribúyalas de forma segura; cada usuario deberá cambiar su contraseña al ingresar."
          );
        }
        onSuccess();
        handleOpenChange(false);
      } else {
        notify.error(data.error || "Error en la importación");
      }
    } catch (error) {
      console.error("Error importando:", error);
      notify.error("Ocurrió un error en la importación masiva");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-[800px] ${step === "preview" ? "flex flex-col" : ""}`}>
        <DialogHeader>
          <DialogTitle>Importación Masiva de Usuarios</DialogTitle>
          <DialogDescription>
            {step === "upload" 
              ? "Sube un archivo Excel (.xlsx) con los datos de los empleados. Se generará una contraseña temporal única por usuario."
              : "Revisa los datos antes de importar."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6">
            <div 
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors sm:p-8 ${
                file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full text-primary">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="break-all font-semibold">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-muted rounded-full text-muted-foreground">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-medium">Haz clic aquí para seleccionar un archivo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El Excel debe contener: Email, Nombre, Apellido, Número Empleado, Departamento
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center mt-4">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={() => window.location.href = '/api/usuarios/importar/plantilla'}
              >
                <Download className="w-4 h-4" />
                Descargar Plantilla Excel
              </Button>
            </div>

            <div className="mt-4 bg-muted/50 p-4 rounded-xl text-sm border">
              <p className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> 
                Instrucciones importantes
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Los encabezados del Excel deben estar en la primera fila.</li>
                <li>La columna "Número Empleado" (opcional) permite asociar el código único de empleado.</li>
                <li>Los nombres de departamentos deben coincidir <strong>exactamente</strong> con los registrados en el sistema.</li>
                <li>La columna "Es Jefe" (opcional) acepta valores "Si" o "No".</li>
                <li>La columna "Es Director" (opcional) acepta valores "Si" o "No".</li>
                <li>El "Email Jefe Superior" puede referenciar un usuario existente o una fila del mismo Excel.</li>
                <li>Cada usuario recibirá una contraseña temporal única; al finalizar se descargará un CSV con las credenciales para distribuir.</li>
                <li>Todos deberán cambiar su contraseña en el primer ingreso.</li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="py-4 flex min-h-[320px] flex-1 flex-col gap-4 overflow-hidden sm:min-h-[400px]">
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-sm text-muted-foreground">Total filas:</span>
                <span className="ml-2 font-semibold">{previewData.total}</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm text-muted-foreground">Estado:</span>
                {previewData.valido ? (
                  <Badge className="ml-2 bg-green-500">Todo Correcto</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-2">Con Errores ({previewData.conErrores})</Badge>
                )}
              </div>
            </div>

            <div className="border rounded-md flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px]">Fila</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.filas.map((fila, idx) => (
                    <TableRow key={idx} className={fila.errores.length > 0 ? "bg-red-500/5 hover:bg-red-500/10" : ""}>
                      <TableCell className="font-medium">{fila.fila}</TableCell>
                      <TableCell>
                        <div className="font-medium">{fila.nombre} {fila.apellido}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span>{fila.email}</span>
                          {fila.numeroEmpleado && (
                            <>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{fila.numeroEmpleado}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{fila.departamento || "-"}</TableCell>
                      <TableCell>
                        <div>{fila.cargo || "-"}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {fila.esDirector && <Badge variant="secondary">Director</Badge>}
                          {fila.esJefe && <Badge variant="secondary">Jefe</Badge>}
                        </div>
                        {fila.emailJefeSuperior && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Jefe: {fila.emailJefeSuperior}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {fila.errores.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {fila.errores.map((err, i) => (
                              <span key={i} className="text-xs text-destructive flex items-start gap-1">
                                <X className="w-3 h-3 mt-0.5 shrink-0" />
                                {err}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          {step === "upload" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button 
                onClick={handleValidate} 
                disabled={!file || loading}
                className="gap-2"
              >
                {loading ? "Procesando..." : "Siguiente"}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>
                Volver
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!previewData?.valido || loading}
                className={previewData?.valido ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                {loading ? "Importando..." : "Confirmar Importación"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
