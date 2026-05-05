"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  UserCheck,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify, confirmAction } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Departamento {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  jefeId: number | null;
  activo: boolean;
  totalEmpleados: number;
  jefe: { id: number; nombre: string; apellido: string } | null;
}

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  departamentoId: number | null;
  esDirector: boolean;
  esJefe: boolean;
  activo: boolean;
}

interface DepartamentosClientProps {
  session: Session;
}

export default function DepartamentosClient({ session }: DepartamentosClientProps) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Departamento | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    jefeId: "",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([cargarDepartamentos(), cargarUsuarios()]);
    setLoading(false);
  };

  const cargarDepartamentos = async () => {
    try {
      const res = await fetch("/api/departamentos");
      const data = await res.json();
      if (data.success) {
        setDepartamentos(data.data || []);
      }
    } catch (error) {
      console.error("Error cargando departamentos:", error);
      notify.error("Error al cargar departamentos");
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await fetch("/api/usuarios");
      const data = await res.json();
      if (data.success) {
        setUsuariosDisponibles(
          (data.usuarios || []).filter((u: Usuario) => u.activo)
        );
      }
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
  };

  const abrirModalNuevo = () => {
    setEditingDept(null);
    setFormData({ codigo: "", nombre: "", descripcion: "", jefeId: "" });
    setModalOpen(true);
  };

  const abrirModalEditar = (dept: Departamento) => {
    setEditingDept(dept);
    setFormData({
      codigo: dept.codigo,
      nombre: dept.nombre,
      descripcion: dept.descripcion || "",
      jefeId: dept.jefeId?.toString() || "",
    });
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditingDept(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      notify.warning("Código y nombre son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const url = "/api/departamentos";
      const method = editingDept ? "PATCH" : "POST";
      const body: any = {
        codigo: formData.codigo.toUpperCase(),
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        jefeId: formData.jefeId ? Number(formData.jefeId) : null,
      };

      if (editingDept) body.id = editingDept.id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        await cargarDatos();
        cerrarModal();
        notify.success(
          editingDept
            ? "Departamento actualizado"
            : "Departamento creado exitosamente"
        );
      } else {
        notify.error(data.error || "Error al guardar");
      }
    } catch (error) {
      console.error("Error guardando:", error);
      notify.error("Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Departamento) => {
    const result = await confirmAction(
      "Eliminar departamento",
      `¿Está seguro de eliminar "${dept.nombre}"? ${
        dept.totalEmpleados > 0
          ? `Tiene ${dept.totalEmpleados} empleado(s) activo(s).`
          : ""
      }`,
      { confirmText: "Eliminar", icon: "warning" }
    );

    if (!result.confirmed) return;

    try {
      const res = await fetch(`/api/departamentos?id=${dept.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        await cargarDatos();
        notify.success("Departamento eliminado");
      } else {
        notify.error(data.error || "Error al eliminar");
      }
    } catch (error) {
      console.error("Error eliminando:", error);
      notify.error("Error al procesar la solicitud");
    }
  };

  const deptsFiltrados = departamentos.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.nombre.toLowerCase().includes(term) ||
      d.codigo.toLowerCase().includes(term) ||
      (d.jefe && `${d.jefe.nombre} ${d.jefe.apellido}`.toLowerCase().includes(term))
    );
  });

  const totalEmpleados = departamentos.reduce((sum, d) => sum + d.totalEmpleados, 0);
  const sinJefe = departamentos.filter((d) => !d.jefe).length;

  // Usuarios que podrían ser jefe de un departamento dado
  const getUsuariosParaJefe = () => {
    if (editingDept) {
      return usuariosDisponibles.filter(
        (u) => u.departamentoId === editingDept.id || !u.esDirector
      );
    }
    return usuariosDisponibles.filter((u) => !u.esDirector);
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Gestión de Departamentos
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Administra departamentos y asigna jefes
              </p>
            </div>
          </div>
          <Button onClick={abrirModalNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Departamento
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card text-card-foreground border shadow-sm rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground font-medium">
                  Departamentos
                </p>
                <p className="text-2xl font-bold">{departamentos.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground border shadow-sm rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground font-medium">
                  Total Empleados
                </p>
                <p className="text-2xl font-bold">{totalEmpleados}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground border shadow-sm rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${
                  sinJefe > 0
                    ? "bg-amber-500/10"
                    : "bg-green-500/10"
                }`}
              >
                {sinJefe > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                ) : (
                  <UserCheck className="w-5 h-5 text-green-500" />
                )}
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground font-medium">
                  Sin Jefe Asignado
                </p>
                <p className="text-2xl font-bold">{sinJefe}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl mb-6">
          <div className="p-5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código o jefe..."
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl">
          <div className="p-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Jefe de Departamento</TableHead>
                        <TableHead className="text-center">Empleados</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptsFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-muted-foreground">
                              No se encontraron departamentos
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        deptsFiltrados.map((dept) => (
                          <TableRow key={dept.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {dept.codigo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold">{dept.nombre}</div>
                                {dept.descripcion && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {dept.descripcion}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {dept.jefe ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                    {dept.jefe.nombre[0]}
                                    {dept.jefe.apellido[0]}
                                  </div>
                                  <span className="text-sm font-medium">
                                    {dept.jefe.nombre} {dept.jefe.apellido}
                                  </span>
                                </div>
                              ) : (
                                <Badge
                                  variant="destructive"
                                  className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  Sin asignar
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {dept.totalEmpleados}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {dept.activo ? (
                                <Badge
                                  variant="default"
                                  className="bg-green-500 hover:bg-green-600"
                                >
                                  Activo
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Inactivo</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => abrirModalEditar(dept)}
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(dept)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {deptsFiltrados.map((dept) => (
                    <div
                      key={dept.id}
                      className="border rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {dept.codigo}
                            </Badge>
                            <span className="font-semibold text-sm">
                              {dept.nombre}
                            </span>
                          </div>
                          {dept.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {dept.descripcion}
                            </p>
                          )}
                        </div>
                        {dept.activo ? (
                          <Badge
                            variant="default"
                            className="bg-green-500 hover:bg-green-600 text-xs"
                          >
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Inactivo
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-muted-foreground">Jefe: </span>
                          {dept.jefe ? (
                            <span className="font-medium">
                              {dept.jefe.nombre} {dept.jefe.apellido}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {dept.totalEmpleados} empleados
                        </Badge>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => abrirModalEditar(dept)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => handleDelete(dept)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Crear/Editar */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && cerrarModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDept ? "Editar Departamento" : "Nuevo Departamento"}
            </DialogTitle>
            <DialogDescription>
              {editingDept
                ? "Modifica la información del departamento."
                : "Completa los datos para crear un nuevo departamento."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="Ej: VENTAS"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  disabled={!!editingDept}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Departamento de Ventas"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                placeholder="Descripción del departamento (opcional)"
                className="resize-none min-h-[60px]"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Jefe de Departamento</Label>
              <Select
                value={formData.jefeId || "none"}
                onValueChange={(val) =>
                  setFormData({ ...formData, jefeId: val === "none" ? "" : val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar jefe..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sin jefe asignado</span>
                  </SelectItem>
                  {getUsuariosParaJefe().map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.nombre} {u.apellido}
                      {u.departamentoId && editingDept && u.departamentoId !== editingDept.id
                        ? " (otro depto.)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {editingDept?.jefe && formData.jefeId && Number(formData.jefeId) !== editingDept.jefe.id && (
                <p className="text-xs text-amber-600">
                  Se reemplazará a {editingDept.jefe.nombre} {editingDept.jefe.apellido} como jefe.
                </p>
              )}

              {!formData.jefeId && (
                <p className="text-xs text-amber-600">
                  Sin jefe, las solicitudes de empleados de este departamento no
                  podrán ser aprobadas.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={cerrarModal}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingDept ? "Guardar Cambios" : "Crear Departamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
