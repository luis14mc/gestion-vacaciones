"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Award,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Palmtree,
  TrendingUp,
  Activity
} from "lucide-react";
import { notify } from '@/lib/swal';
import { formatDate } from '@/lib/utils/date-format';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  cargo: string | null;
  departamentoId: number | null;
  departamento: string | null;
  estado: string;
  fechaIngreso: string | null;
  diasAsignados: number;
  diasDisponibles: number;
  diasUsados: number;
  solicitudesPendientes: number;
  enVacaciones: boolean;
}

interface Stats {
  total: number;
  activos: number;
  enVacaciones: number;
  diasPromedio: number;
}

export default function MiEquipoClient({ session }: { session?: any } = {}) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, enVacaciones: 0, diasPromedio: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");

  // Detalles
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  const cargarEquipo = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (estadoFiltro === "activo") {
        params.append("activo", "true");
      }

      const response = await fetch(`/api/usuarios?${params}`);
      const data = await response.json();

      if (data.success) {
        const mapped = (data.usuarios || []).map((u: any) => ({
          id: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          email: u.email,
          telefono: u.telefono ?? null,
          cargo: u.cargo ?? null,
          departamentoId: u.departamentoId,
          departamento: u.departamento?.nombre ?? null,
          estado: u.activo ? 'activo' : 'inactivo',
          fechaIngreso: u.fechaIngreso ?? null,
          diasAsignados: u.diasDisponibles ?? 0,
          diasDisponibles: u.diasDisponibles ?? 0,
          diasUsados: 0,
          solicitudesPendientes: 0,
          enVacaciones: false,
        }));

        if (estadoFiltro === "inactivo") {
          setUsuarios(mapped.filter((u: Usuario) => u.estado === "inactivo"));
        } else {
          setUsuarios(mapped);
        }

        const activos = mapped.filter((u: Usuario) => u.estado === "activo").length;
        const diasPromedio = mapped.length > 0
          ? Math.round(mapped.reduce((sum: number, u: Usuario) => sum + (u.diasDisponibles || 0), 0) / mapped.length)
          : 0;

        setStats({
          total: mapped.length,
          activos,
          enVacaciones: 0,
          diasPromedio,
        });
      }
    } catch (error) {
      console.error("Error al cargar equipo:", error);
      notify.error("Error", "No se pudo cargar la información del equipo");
    } finally {
      setLoading(false);
    }
  }, [estadoFiltro]);

  useEffect(() => {
    void cargarEquipo();
  }, [cargarEquipo]);

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchBusqueda =
      usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.cargo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      false;
    return matchBusqueda;
  });

  const verDetalles = (usuario: Usuario) => {
    setUsuarioSeleccionado(usuario);
    setMostrarModal(true);
  };

  const getEstadoBadge = (estado: string) => {
    if (estado === "activo") {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle className="w-3 h-3" />Activo</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><XCircle className="w-3 h-3" />Inactivo</Badge>;
  };

  const calcularPorcentajeUso = (usados: number, asignados: number) => {
    if (asignados === 0) return 0;
    return Math.round((usados / asignados) * 100);
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="bg-muted p-2.5 rounded-xl">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi Equipo</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Gestiona y supervisa a los colaboradores de tu departamento</p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 space-y-0 pb-2">
                <p className="text-sm font-medium">Total del Equipo</p>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Colaboradores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 space-y-0 pb-2">
                <p className="text-sm font-medium">Activos</p>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-bold">{stats.activos}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 0}% del total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 space-y-0 pb-2">
                <p className="text-sm font-medium">De Vacaciones</p>
                <Palmtree className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-bold text-orange-500">{stats.enVacaciones}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Actualmente ausentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 space-y-0 pb-2">
                <p className="text-sm font-medium">Días Promedio</p>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-bold text-primary">{stats.diasPromedio}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Disponibles por persona</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-[13px] font-semibold tracking-tight mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Nombre, email, cargo..."
                    className="w-full pl-9"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={estadoFiltro}
                  onValueChange={(val) => setEstadoFiltro(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de colaboradores */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-[13px] font-semibold tracking-tight mb-4">
              Colaboradores ({usuariosFiltrados.length})
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-[13px] text-muted-foreground text-center">No se encontraron colaboradores</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usuariosFiltrados.map((usuario) => (
                  <Card key={usuario.id} className="hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[13px]">{usuario.nombre} {usuario.apellido}</h3>
                          {usuario.cargo && <p className="text-xs text-muted-foreground">{usuario.cargo}</p>}
                        </div>
                        {getEstadoBadge(usuario.estado)}
                      </div>

                      {usuario.enVacaciones && (
                        <Alert className="py-2 mb-2 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                          <Palmtree className="w-4 h-4" />
                          <AlertDescription className="text-xs flex items-center ml-2 h-4">De vacaciones</AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2 text-[13px]">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{usuario.email}</span>
                        </div>

                        {usuario.telefono && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{usuario.telefono}</span>
                          </div>
                        )}
                      </div>

                      {/* Balance de días */}
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs text-muted-foreground">Días disponibles</span>
                          <span className="text-[13px] font-semibold text-primary">{usuario.diasDisponibles}/{usuario.diasAsignados}</span>
                        </div>
                        <Progress
                          value={usuario.diasAsignados > 0 ? (usuario.diasDisponibles / usuario.diasAsignados) * 100 : 0}
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>{calcularPorcentajeUso(usuario.diasUsados, usuario.diasAsignados)}% usado</span>
                          {usuario.solicitudesPendientes > 0 && (
                            <span className="text-amber-500 font-medium">{usuario.solicitudesPendientes} pendiente(s)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verDetalles(usuario)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver detalles
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de detalles */}
      <Dialog open={mostrarModal} onOpenChange={setMostrarModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Información del Colaborador
            </DialogTitle>
          </DialogHeader>

          {usuarioSeleccionado && (
            <div className="space-y-6 mt-4">
              {/* Información personal */}
              <div className="bg-muted p-4 rounded-xl border">
                <h4 className="font-semibold mb-3 flex items-center text-sm gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nombre completo</Label>
                    <p className="text-sm font-medium">{usuarioSeleccionado.nombre} {usuarioSeleccionado.apellido}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <div className="mt-1">{getEstadoBadge(usuarioSeleccionado.estado)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium break-all">{usuarioSeleccionado.email}</p>
                  </div>
                  {usuarioSeleccionado.telefono && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Teléfono</Label>
                      <p className="text-sm font-medium">{usuarioSeleccionado.telefono}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.cargo && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Cargo</Label>
                      <p className="text-sm font-medium">{usuarioSeleccionado.cargo}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.departamento && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Departamento</Label>
                      <p className="text-sm font-medium">{usuarioSeleccionado.departamento}</p>
                    </div>
                  )}
                  {usuarioSeleccionado.fechaIngreso && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de ingreso</Label>
                      <p className="text-sm font-medium">
                        {formatDate(usuarioSeleccionado.fechaIngreso)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Balance de vacaciones */}
              <div className="bg-muted p-4 rounded-xl border">
                <h4 className="font-semibold mb-3 flex items-center text-sm gap-2">
                  <Calendar className="w-4 h-4" />
                  Balance de Vacaciones
                </h4>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
                  <div className="bg-background rounded-xl p-3 border shadow-sm">
                    <div className="text-xs text-muted-foreground text-center">Asignados</div>
                    <div className="text-lg font-bold text-primary text-center mt-1">{usuarioSeleccionado.diasAsignados}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border shadow-sm">
                    <div className="text-xs text-muted-foreground text-center">Usados</div>
                    <div className="text-lg font-bold text-red-500 text-center mt-1">{usuarioSeleccionado.diasUsados}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border shadow-sm">
                    <div className="text-xs text-muted-foreground text-center">Disponibles</div>
                    <div className="text-lg font-bold text-green-500 text-center mt-1">{usuarioSeleccionado.diasDisponibles}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress
                    value={usuarioSeleccionado.diasAsignados > 0 ? (usuarioSeleccionado.diasDisponibles / usuarioSeleccionado.diasAsignados) * 100 : 0}
                    className="h-2"
                  />
                </div>
              </div>

              {/* Estado actual */}
              {usuarioSeleccionado.enVacaciones && (
                <Alert className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  <Palmtree className="w-4 h-4" />
                  <AlertDescription className="ml-2">Actualmente de vacaciones</AlertDescription>
                </Alert>
              )}

              {usuarioSeleccionado.solicitudesPendientes > 0 && (
                <Alert className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  <Clock className="w-4 h-4" />
                  <AlertDescription className="ml-2">{usuarioSeleccionado.solicitudesPendientes} solicitud(es) pendiente(s) de aprobación</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setMostrarModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
