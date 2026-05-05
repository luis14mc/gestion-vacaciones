"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Calendar,
  Mail,
  Building2,
  Shield,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify, confirmAction } from "@/lib/swal";
import { ConfiguracionDialog } from "./ConfiguracionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { ConfiguracionFormValues } from "@/lib/schemas/configuracion.schema";

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
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState("general");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);

  const categorias = [
    { id: "general", nombre: "General", icon: Settings },
    { id: "vacaciones", nombre: "Vacaciones", icon: Calendar },
    { id: "notificaciones", nombre: "Notificaciones", icon: Mail },
    { id: "departamentos", nombre: "Departamentos", icon: Building2 },
    { id: "seguridad", nombre: "Seguridad", icon: Shield },
  ];

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
        notify.error("Error", data.error || "Error al cargar configuraciones");
      }
    } catch (error) {
      notify.error("Error", "Error al cargar configuraciones");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (values: ConfiguracionFormValues) => {
    try {
      const method = editingConfig ? "PATCH" : "POST";

      const body = editingConfig
        ? {
            id: editingConfig.id,
            valor: values.valor,
            descripcion: values.descripcion,
            categoria: values.categoria,
            tipoDato: values.tipoDato,
            esPublico: values.esPublico,
          }
        : values;

      const res = await fetch("/api/configuracion", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        await cargarConfiguraciones();
        notify.success(editingConfig ? "Actualizado" : "Creado", data.message);
        cerrarModal();
      } else {
        notify.error("Error", data.error || "Error al guardar configuración");
      }
    } catch (error) {
      notify.error("Error", "Error al guardar configuración");
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmAction(
      "Confirmar eliminación",
      "¿Está seguro de eliminar esta configuración? Esta acción es permanente.",
      { confirmText: "Eliminar", icon: "warning" }
    );

    if (!result.confirmed) return;

    try {
      const res = await fetch(`/api/configuracion?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        await cargarConfiguraciones();
        notify.success("Eliminado", data.message);
      } else {
        notify.error("Error", data.error || "Error al eliminar configuración");
      }
    } catch (error) {
      notify.error("Error", "Error al eliminar configuración");
    }
  };

  const abrirModalNueva = () => {
    setEditingConfig(null);
    setModalOpen(true);
  };

  const abrirModalEditar = (config: ConfigItem) => {
    setEditingConfig(config);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditingConfig(null);
  };

  const configsFiltradas = configs.filter((c) => c.categoria === categoriaActiva);

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Configuración del Sistema
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Administra la configuración general
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card className="sticky top-4 bg-card text-card-foreground">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-semibold text-foreground">
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-2">
                  {categorias.map((cat) => {
                    const Icon = cat.icon;
                    const count = configs.filter((c) => c.categoria === cat.id).length;
                    const isActive = categoriaActiva === cat.id;
                    return (
                      <Button
                        key={cat.id}
                        type="button"
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setCategoriaActiva(cat.id)}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{cat.nombre}</span>
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {count}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="bg-card text-card-foreground border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-[13px] font-semibold text-foreground">
                  {categorias.find((c) => c.id === categoriaActiva)?.nombre}
                </CardTitle>
                <Button size="sm" onClick={abrirModalNueva}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Configuración
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4 py-2">
                    {[0, 1, 2].map((i) => (
                      <Card key={i} className="bg-muted/30">
                        <CardContent className="pt-6 space-y-3">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-4 w-full max-w-md" />
                          <Skeleton className="h-4 w-24" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : configsFiltradas.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No hay configuraciones en esta categoría</p>
                    <Button size="sm" className="mt-4" onClick={abrirModalNueva}>
                      Crear primera configuración
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {configsFiltradas.map((config) => (
                      <Card
                        key={config.id}
                        className="bg-card text-card-foreground transition-shadow duration-200 hover:shadow-md"
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <code className="text-sm font-semibold bg-muted text-foreground px-2 py-1 rounded-lg">
                                {config.clave}
                              </code>
                              {config.descripcion && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {config.descripcion}
                                </p>
                              )}
                              <div className="mt-3">
                                <span className="text-xs text-muted-foreground">
                                  Valor actual:
                                </span>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {config.valor === "true" || config.valor === "false" ? (
                                    <Switch
                                      checked={config.valor === "true"}
                                      disabled
                                    />
                                  ) : (
                                    <span className="font-semibold text-foreground">
                                      {config.valor}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirModalEditar(config)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(config.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfiguracionDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        configuracion={editingConfig}
        categorias={categorias}
        categoriaActiva={categoriaActiva}
        onSubmit={handleSaveConfig}
      />
    </div>
  );
}
