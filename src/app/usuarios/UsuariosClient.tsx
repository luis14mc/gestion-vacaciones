"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  Edit,
  Trash2,
  ShieldCheck,
  Briefcase,
  Calendar,
  Plus,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify, confirmAction } from '@/lib/swal';
import { UsuarioDialog } from "./UsuarioDialog";
import { ImportarUsuariosDialog } from "./ImportarUsuariosDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Usuario {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  esAdmin: boolean;
  esRrhh: boolean;
  esDirector: boolean;
  esJefe: boolean;
  activo: boolean;
  departamentoId?: number;
  cargo?: string | null;
  fechaIngreso?: string | null;
  jefeSuperiorId?: number | null;
  departamento?: {
    id: number;
    nombre: string;
  };
  diasVacaciones?: number;
  diasUsados?: number;
  diasDisponibles?: number;
}

interface UsuariosClientProps {
  session: Session;
}

interface Departamento {
  id: number;
  nombre: string;
}

export default function UsuariosClient({ session }: UsuariosClientProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nombre: "",
    apellido: "",
    departamento_id: "",
    cargo: "",
    fechaIngreso: "",
    esAdmin: false,
    esRrhh: false,
    esJefe: false,
    estaActivo: true,
  });

  const cargarDepartamentos = useCallback(async () => {
    try {
      const res = await fetch("/api/departamentos");
      if (res.ok) {
        const response = await res.json();
        const data = response.data || response;
        setDepartamentos(Array.isArray(data) ? data : []);
      } else {
        console.error("Error en respuesta de departamentos:", res.status);
      }
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  }, []);

  const cargarUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/usuarios");
      const response = await res.json();

      if (res.ok && response.success) {
        const data = response.usuarios || response.data || [];
        setUsuarios(Array.isArray(data) ? data : []);
      } else {
        console.error("❌ Error API usuarios:", response.error || res.status);
        setUsuarios([]);
      }
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarUsuarios();
    void cargarDepartamentos();
  }, [cargarUsuarios, cargarDepartamentos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = "/api/usuarios";
      const method = editingUser ? "PATCH" : "POST";

      const body: any = {
        email: formData.email,
        nombre: formData.nombre,
        apellido: formData.apellido,
        departamentoId: Number.parseInt(formData.departamento_id),
        esAdmin: formData.esAdmin,
        esRrhh: formData.esRrhh,
        esJefe: formData.esJefe,
        activo: formData.estaActivo,
      };

      if (formData.cargo) {
        body.cargo = formData.cargo;
      }

      if (formData.fechaIngreso) {
        body.fechaIngreso = formData.fechaIngreso;
      }

      if (formData.password) {
        body.password = formData.password;
      }

      if (editingUser) {
        body.id = editingUser.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await cargarUsuarios();
        cerrarModal();
        notify.success(
          editingUser
            ? "El usuario ha sido actualizado exitosamente"
            : "El usuario ha sido creado exitosamente"
        );
      } else {
        const errorData = await res.json();
        notify.error(errorData.error || "No se pudo guardar el usuario");
      }
    } catch (error) {
      console.error("Error guardando usuario:", error);
      notify.error("Error guardando usuario");
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmAction('Confirmar eliminación', '¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.', { confirmText: 'Eliminar', icon: 'warning' });

    if (!result.confirmed) return;

    try {
      const res = await fetch(`/api/usuarios?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await cargarUsuarios();
        notify.success("El usuario ha sido eliminado exitosamente");
      } else {
        const data = await res.json();
        notify.error(data.error || "Error eliminando usuario");
      }
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      notify.error("Error al procesar la solicitud");
    }
  };

  const abrirModalNuevo = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "",
      nombre: "",
      apellido: "",
      departamento_id: "",
      cargo: "",
      fechaIngreso: "",
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      estaActivo: true,
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const abrirModalEditar = (usuario: Usuario) => {
    setEditingUser(usuario);
    setFormData({
      email: usuario.email,
      password: "",
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      departamento_id: usuario.departamentoId?.toString() || "",
      cargo: usuario.cargo || "",
      fechaIngreso: usuario.fechaIngreso || "",
      esAdmin: usuario.esAdmin,
      esRrhh: usuario.esRrhh,
      esJefe: usuario.esJefe,
      estaActivo: usuario.activo,
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  // Filtrado
  const usuariosFiltrados = usuarios.filter((u) => {
    const matchSearch =
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRol =
      filtroRol === "todos" ||
      (filtroRol === "admin" && u.esAdmin) ||
      (filtroRol === "rrhh" && u.esRrhh) ||
      (filtroRol === "director" && u.esDirector) ||
      (filtroRol === "jefe" && u.esJefe) ||
      (filtroRol === "empleado" && !u.esAdmin && !u.esRrhh && !u.esDirector && !u.esJefe);

    const matchEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activos" && u.activo) ||
      (filtroEstado === "inactivos" && !u.activo);

    return matchSearch && matchRol && matchEstado;
  });

  // Estadísticas
  const totalUsuarios = usuarios.length;
  const usuariosActivos = usuarios.filter((u) => u.activo).length;
  const administradores = usuarios.filter((u) => u.esAdmin).length;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Gestión de Usuarios</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Administra usuarios del sistema
              </p>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl mb-6">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4">
              {/* Búsqueda */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  placeholder="Buscar por nombre, apellido o email..."
                  className="w-full pl-11 h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtros y Botón */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                {/* Filtro por rol */}
                <Select value={filtroRol} onValueChange={setFiltroRol}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Todos los roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los roles</SelectItem>
                    <SelectItem value="admin">Administradores</SelectItem>
                    <SelectItem value="rrhh">RRHH</SelectItem>
                    <SelectItem value="director">Directores</SelectItem>
                    <SelectItem value="jefe">Jefes</SelectItem>
                    <SelectItem value="empleado">Empleados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro por estado */}
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activos">Activos</SelectItem>
                    <SelectItem value="inactivos">Inactivos</SelectItem>
                  </SelectContent>
                </Select>

                {/* Botón nuevo usuario e importar */}
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:flex lg:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setImportarOpen(true)}
                    className="h-10 lg:w-auto lg:flex-none"
                  >
                    Importar Excel
                  </Button>
                  <Button
                    onClick={abrirModalNuevo}
                    className="h-10 lg:w-auto lg:flex-none"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Nuevo Usuario</span>
                    <span className="sm:hidden">Nuevo</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <h3 className="text-[13px] text-muted-foreground font-medium mb-2 h-8 flex items-center">Total Usuarios</h3>
            <p className="text-xl font-semibold text-primary">{totalUsuarios}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <h3 className="text-[13px] text-muted-foreground font-medium mb-2 h-8 flex items-center">Activos</h3>
            <p className="text-xl font-semibold text-green-500">{usuariosActivos}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <h3 className="text-[13px] text-muted-foreground font-medium mb-2 h-8 flex items-center">
              Administradores
            </h3>
            <p className="text-xl font-semibold text-blue-500">{administradores}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
            <h3 className="text-[13px] text-muted-foreground font-medium mb-2 h-8 flex items-center">Filtrados</h3>
            <p className="text-xl font-semibold text-orange-500">{usuariosFiltrados.length}</p>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl">
          <div className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-4">
              Lista de Usuarios ({usuariosFiltrados.length})
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                {/* Vista Desktop/Tablet - Tabla */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Días Disponibles</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuariosFiltrados.map((usuario) => (
                        <TableRow key={usuario.id}>
                          <TableCell>
                            <div className="font-semibold">
                              {usuario.nombre} {usuario.apellido}
                            </div>
                          </TableCell>
                          <TableCell>{usuario.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {usuario.esAdmin && (
                                <Badge variant="destructive" className="gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Admin
                                </Badge>
                              )}
                              {usuario.esRrhh && (
                                <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                                  <Users className="w-3 h-3" />
                                  RRHH
                                </Badge>
                              )}
                              {usuario.esDirector && (
                                <Badge variant="default" className="gap-1 bg-purple-500 hover:bg-purple-600">
                                  <Briefcase className="w-3 h-3" />
                                  Director
                                </Badge>
                              )}
                              {usuario.esJefe && (
                                <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600">
                                  <Briefcase className="w-3 h-3" />
                                  Jefe
                                </Badge>
                              )}
                              {!usuario.esAdmin && !usuario.esRrhh && !usuario.esDirector && !usuario.esJefe && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Empleado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {usuario.departamento ? (
                              typeof usuario.departamento === 'string'
                                ? usuario.departamento
                                : usuario.departamento.nombre
                            ) : (
                              <span className="text-muted-foreground">Sin departamento</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {usuario.activo ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">Activo</Badge>
                            ) : (
                              <Badge variant="destructive">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {usuario.diasDisponibles !== undefined ? usuario.diasDisponibles : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirModalEditar(usuario)}
                                aria-label={`Editar ${usuario.nombre} ${usuario.apellido}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(usuario.id)}
                                aria-label={`Eliminar ${usuario.nombre} ${usuario.apellido}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista Mobile - Cards */}
                <div className="lg:hidden space-y-4">
                  {usuariosFiltrados.map((usuario) => (
                    <div key={usuario.id} className="bg-card text-card-foreground border shadow-sm rounded-xl">
                      <div className="p-4">
                        {/* Header */}
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px]">
                              {usuario.nombre} {usuario.apellido}
                            </div>
                            <div className="break-all text-sm text-muted-foreground">
                              {usuario.email}
                            </div>
                          </div>
                          {usuario.activo ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Activo</Badge>
                          ) : (
                            <Badge variant="destructive">Inactivo</Badge>
                          )}
                        </div>

                        {/* Info */}
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Departamento:</span>{" "}
                            <span className="font-medium">
                              {usuario.departamento ? (
                                typeof usuario.departamento === 'string'
                                  ? usuario.departamento
                                  : usuario.departamento.nombre
                              ) : "Sin departamento"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Días disponibles:</span>{" "}
                            <span className="font-semibold">
                              {usuario.diasDisponibles !== undefined
                                ? usuario.diasDisponibles
                                : "-"}
                            </span>
                          </div>
                        </div>

                        {/* Roles */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {usuario.esAdmin && (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </Badge>
                          )}
                          {usuario.esRrhh && (
                            <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                              <Users className="w-3 h-3" />
                              RRHH
                            </Badge>
                          )}
                          {usuario.esDirector && (
                            <Badge variant="default" className="gap-1 bg-purple-500 hover:bg-purple-600">
                              <Briefcase className="w-3 h-3" />
                              Director
                            </Badge>
                          )}
                          {usuario.esJefe && (
                            <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600">
                              <Briefcase className="w-3 h-3" />
                              Jefe
                            </Badge>
                          )}
                          {!usuario.esAdmin && !usuario.esRrhh && !usuario.esDirector && !usuario.esJefe && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Empleado
                            </Badge>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-3 min-[420px]:grid-cols-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => abrirModalEditar(usuario)}
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => handleDelete(usuario.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {usuariosFiltrados.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No se encontraron usuarios
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <UsuarioDialog
        open={modalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) cerrarModal();
          else setModalOpen(true);
        }}
        usuario={editingUser}
        departamentos={departamentos}
        onSuccess={() => {
          cargarUsuarios();
        }}
      />

      <ImportarUsuariosDialog 
        open={importarOpen} 
        onOpenChange={setImportarOpen}
        onSuccess={cargarUsuarios}
      />
    </div>
  );
}
