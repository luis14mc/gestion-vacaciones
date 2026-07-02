"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Calendar,
  Users,
  Building2,
  Plus,
  Minus,
  Edit,
  Search,
  RefreshCw,
  Info,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify, confirmAction } from '@/lib/swal';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mapBalanceRegistro, formatDias } from '@/lib/domain/balance-display';

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  departamento?: {
    id: number;
    nombre: string;
  };
}

interface Departamento {
  id: number;
  nombre: string;
  codigo: string;
}

interface TipoAusencia {
  id: string;
  tipo: string;
  nombre: string;
  colorHex?: string;
}

interface Balance {
  id: number;
  usuarioId: number;
  tipoAusencia: string;
  cantidadInicial: string;
  cantidadAcumulada: string;
  cantidadUsada: string;
  cantidadPendiente: string;
  cantidadDisponible: string;
}

interface AsignacionDiasClientProps {
  readonly session: Session;
}

export default function AsignacionDiasClient({ session }: AsignacionDiasClientProps) {
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState<"individual" | "departamento">("individual");
  const loadRequestRef = useRef(0);

  // Form states
  const [formData, setFormData] = useState({
    usuarioId: "",
    departamentoId: "",
    tipoAusenciaId: "",
    cantidadAsignada: "",
    operacion: "reemplazar", // reemplazar, sumar, restar
  });


  const cargarUsuarios = async () => {
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/usuarios?activo=true&_t=${timestamp}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        return data.usuarios as Usuario[];
      }
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
    return [];
  };

  const cargarBalances = async () => {
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/balances?anio=${anioSeleccionado}&_t=${timestamp}`, {
        cache: 'no-store'
      });
      const data = await res.json();

      if (data.success && data.data) {
        return data.data.map((b: any) => ({
          id: Number(b.id),
          usuarioId: Number(b.usuarioId),
          tipoAusencia: b.tipoAusencia,
          cantidadInicial: b.cantidadInicial ?? '0',
          cantidadAcumulada: b.cantidadAcumulada ?? '0',
          cantidadUsada: b.cantidadUsada ?? '0',
          cantidadPendiente: b.cantidadPendiente ?? '0',
          cantidadDisponible: b.cantidadDisponible ?? '0',
        })) as Balance[];
      }
    } catch (error) {
      console.error("Error cargando balances:", error);
    }
    return [];
  };

  const cargarDepartamentos = async () => {
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/departamentos?_t=${timestamp}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setDepartamentos(data.data);
      }
    } catch (error) {
      console.error("Error cargando departamentos:", error);
    }
  };

  const cargarTiposAusencia = async () => {
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/tipos-ausencia?_t=${timestamp}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setTiposAusencia(data.data);
      }
    } catch (error) {
      console.error("Error cargando tipos de ausencia:", error);
    }
  };

  const cargarDatos = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    try {
      setLoading(true);
      const [usuariosData, balancesData] = await Promise.all([
        cargarUsuarios(),
        cargarBalances(),
        cargarDepartamentos(),
        cargarTiposAusencia(),
      ]);

      if (loadRequestRef.current !== requestId) return;

      if (usuariosData) setUsuarios(usuariosData);
      if (balancesData) setBalances(balancesData);
      setRefreshKey(prev => prev + 1);
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [anioSeleccionado]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const abrirModalIndividual = (usuario?: Usuario) => {
    setModoModal("individual");
    if (usuario) {
      // Usar el primer tipo de ausencia (vacaciones) por defecto
      const tipoVacacionesId = tiposAusencia[0]?.id.toString() ?? "";
      setFormData({
        usuarioId: usuario.id.toString(),
        departamentoId: "",
        tipoAusenciaId: tipoVacacionesId,
        cantidadAsignada: "",
        operacion: "sumar",
      });
    } else {
      const tipoVacacionesId = tiposAusencia[0]?.id.toString() ?? "";
      setFormData({
        usuarioId: "",
        departamentoId: "",
        tipoAusenciaId: tipoVacacionesId,
        cantidadAsignada: "",
        operacion: "sumar",
      });
    }
    setModalAbierto(true);
  };

  const abrirModalDepartamento = () => {
    setModoModal("departamento");
    // Buscar específicamente el tipo "Vacaciones"
    const tipoVacaciones = tiposAusencia.find(t => t.tipo === 'vacaciones') || tiposAusencia[0];
    const tipoVacacionesId = tipoVacaciones ? tipoVacaciones.id.toString() : "";
    setFormData({
      usuarioId: "",
      departamentoId: "",
      tipoAusenciaId: tipoVacacionesId,
      cantidadAsignada: "",
      operacion: "reemplazar",
    });
    setModalAbierto(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modoModal === "individual") {
      await asignarIndividual();
    } else {
      await asignarPorDepartamento();
    }
  };

  const asignarIndividual = async () => {
    if (!formData.usuarioId || !formData.tipoAusenciaId || !formData.cantidadAsignada) {
      notify.warning("Por favor completa todos los campos obligatorios");
      return;
    }

    try {
      const balanceActual = balances.find(
        b => b.usuarioId === Number(formData.usuarioId) &&
          b.tipoAusencia === formData.tipoAusenciaId
      );

      let cantidadActual = 0;
      if (balanceActual) {
        cantidadActual = Number.parseFloat(balanceActual.cantidadInicial) || 0;
      }

      let cantidadFinal = Number.parseFloat(formData.cantidadAsignada);

      if (formData.operacion === "sumar") {
        cantidadFinal = cantidadActual + cantidadFinal;
      } else if (formData.operacion === "restar") {
        if (cantidadActual === 0) {
          notify.warning("El empleado no tiene días asignados para restar.");
          return;
        }
        cantidadFinal = cantidadActual - cantidadFinal;
        if (cantidadFinal < 0) {
          notify.warning("No se pueden restar más días de los que tiene asignados.");
          return;
        }
      }

      const res = await fetch("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: Number(formData.usuarioId),
          tipoAusencia: formData.tipoAusenciaId,
          anio: anioSeleccionado,
          cantidadInicial: cantidadFinal.toString(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const operacionTexto = formData.operacion === "sumar" ? "sumados" : "restados";
        setModalAbierto(false);

        // Pequeño delay para asegurar que la columna generada se actualice en BD
        await new Promise(resolve => setTimeout(resolve, 200));

        await cargarDatos();
        notify.success(`${formData.cantidadAsignada} días ${operacionTexto}. Balance final: ${cantidadFinal.toFixed(1)} días`);
      } else {
        notify.error(data.error || "Error al asignar días");
      }
    } catch (error) {
      console.error("Error asignando días:", error);
      notify.error("Error al asignar días");
    }
  };

  const asignarPorDepartamento = async () => {
    if (!formData.departamentoId || !formData.tipoAusenciaId || !formData.cantidadAsignada) {
      notify.warning("Por favor completa todos los campos obligatorios");
      return;
    }

    const departamento = departamentos.find(d => d.id === Number(formData.departamentoId));
    const tipo = tiposAusencia.find(t => t.id === formData.tipoAusenciaId);

    const operacionTexto = formData.operacion === "sumar" ? "sumarán" :
      formData.operacion === "restar" ? "restarán" : "asignarán";

    setModalAbierto(false);

    // Pequeño delay para asegurar que el modal se cierre antes de lanzar la alerta
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await confirmAction('¿Confirmar asignación masiva?', `Se ${operacionTexto} ${formData.cantidadAsignada} días de ${tipo?.nombre} a todos los empleados del departamento ${departamento?.nombre} para el año ${anioSeleccionado}.`, { confirmText: 'Sí, continuar', icon: 'warning' });

    if (!result.confirmed) {
      setModalAbierto(true);
      return;
    }

    try {
      const res = await fetch("/api/asignacion-masiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departamentoId: Number(formData.departamentoId),
          tipoAusencia: formData.tipoAusenciaId,
          anio: anioSeleccionado,
          cantidadAsignada: formData.cantidadAsignada,
          operacion: formData.operacion,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Pequeño delay para asegurar que las columnas generadas se actualicen en BD

        // Pequeño delay para asegurar que las columnas generadas se actualicen en BD
        await new Promise(resolve => setTimeout(resolve, 200));

        await cargarDatos();
        notify.success(`Asignación completada: operación realizada en ${data.usuariosAfectados} usuarios`);
      } else {
        notify.error(data.error || "Error en la asignación masiva");
      }
    } catch (error) {
      console.error("Error en asignación masiva:", error);
      notify.error("Error en la asignación masiva");
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchNombre =
      u.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) ||
      u.apellido.toLowerCase().includes(filtroNombre.toLowerCase());
    const matchDepartamento = !filtroDepartamento || u.departamento?.id.toString() === filtroDepartamento;
    return matchNombre && matchDepartamento;
  });

  const getBalanceUsuario = (usuarioId: number, tipoAusencia: string) => {
    return balances.find(
      b => b.usuarioId === usuarioId && b.tipoAusencia === tipoAusencia
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted p-2.5 rounded-xl">
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Gestión de Días Disponibles</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Asigna y actualiza los días de vacaciones de los empleados
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl mb-6">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
                <Button
                  onClick={() => abrirModalIndividual()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Asignar Individual
                </Button>
                <Button
                  variant="secondary"
                  onClick={abrirModalDepartamento}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Asignar por Departamento
                </Button>
                <Button
                  variant="ghost"
                  onClick={cargarDatos}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>

              <div className="flex w-full items-center gap-2 lg:w-auto">
                <Label className="text-sm font-medium">Año:</Label>
                <Select
                  value={anioSeleccionado.toString()}
                  onValueChange={(val) => setAnioSeleccionado(Number(val))}
                >
                  <SelectTrigger className="h-9 w-full lg:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtros */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
              <div className="relative min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre..."
                  className="w-full pl-9 h-10"
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                />
              </div>
              <Select
                value={filtroDepartamento}
                onValueChange={(val) => setFiltroDepartamento(val === "all" ? "" : val)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los departamentos</SelectItem>
                  {departamentos.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabla de Balances */}
        <div className="bg-card text-card-foreground border shadow-sm rounded-xl">
          <div className="p-4 sm:p-5">
            <h2 className="text-[13px] font-semibold mb-4">
              Balances de Días - Año {anioSeleccionado}
            </h2>

            <div className="overflow-x-auto" key={refreshKey}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-center">Días vencidos</TableHead>
                    <TableHead className="text-center">Días proporcionales</TableHead>
                    <TableHead className="text-center">Días asignados</TableHead>
                    <TableHead className="text-center">Días usados</TableHead>
                    <TableHead className="text-center">Días pendientes</TableHead>
                    <TableHead className="text-center">Días disponibles</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-12 h-12 text-muted-foreground/30" />
                          <p className="text-muted-foreground">No hay usuarios para mostrar</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosFiltrados.map((usuario) => {
                      const balanceVacaciones = getBalanceUsuario(usuario.id, 'vacaciones');
                      const saldo = balanceVacaciones
                        ? mapBalanceRegistro(balanceVacaciones)
                        : mapBalanceRegistro({});

                      return (
                        <TableRow key={usuario.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{usuario.nombre} {usuario.apellido}</div>
                              <div className="text-xs text-muted-foreground">{usuario.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {usuario.departamento?.nombre || "Sin departamento"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatDias(saldo.diasVencidos)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatDias(saldo.diasProporcionales)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-semibold text-primary">
                            {formatDias(saldo.diasAsignados)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatDias(saldo.diasUsados)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatDias(saldo.diasPendientes)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-semibold text-green-600 dark:text-green-400">
                            {formatDias(saldo.diasDisponibles)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              onClick={() => abrirModalIndividual(usuario)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Asignar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Asignación */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {modoModal === "individual" ? "Ajustar Balance de Días" : "Asignación Masiva por Departamento"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {modoModal === "individual" ? (
                <>
                  {/* Usuario */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Usuario *</Label>
                    {formData.usuarioId ? (
                      // Usuario seleccionado desde la tabla - Solo lectura
                      <div className="p-3 bg-muted rounded-xl">
                        <div className="font-medium">
                          {usuarios.find(u => u.id === Number(formData.usuarioId))?.nombre}{" "}
                          {usuarios.find(u => u.id === Number(formData.usuarioId))?.apellido}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {usuarios.find(u => u.id === Number(formData.usuarioId))?.email}
                        </div>
                      </div>
                    ) : (
                      // Usuario no seleccionado - Mostrar dropdown
                      <Select
                        value={formData.usuarioId}
                        onValueChange={(val) => setFormData({ ...formData, usuarioId: val })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccione un usuario" />
                        </SelectTrigger>
                        <SelectContent>
                          {usuarios.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.nombre} {user.apellido} - {user.departamento?.nombre || 'Sin depto'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Operación - Solo sumar o restar */}
                  <div className="space-y-2">
                    <Label>Operación *</Label>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                      <Label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="operacion"
                          value="sumar"
                          checked={formData.operacion === "sumar"}
                          onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                          className="hidden peer"
                        />
                        <div className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-center text-sm leading-tight shadow-sm transition-colors peer-checked:bg-green-500 peer-checked:text-white peer-checked:border-green-500">
                          <Plus className="w-4 h-4" /> Sumar días
                        </div>
                      </Label>
                      <Label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="operacion"
                          value="restar"
                          checked={formData.operacion === "restar"}
                          onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                          className="hidden peer"
                        />
                        <div className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-center text-sm leading-tight shadow-sm transition-colors peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-500">
                          <Minus className="w-4 h-4" /> Restar días
                        </div>
                      </Label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Departamento */}
                  <div className="space-y-2">
                    <Label>Departamento *</Label>
                    <Select
                      value={formData.departamentoId}
                      onValueChange={(val) => setFormData({ ...formData, departamentoId: val })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccione un departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departamentos.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.nombre} ({dept.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operación por Departamento */}
                  <div className="space-y-2">
                    <Label>Operación *</Label>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                      <Label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="operacion-dept"
                          value="reemplazar"
                          checked={formData.operacion === "reemplazar"}
                          onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                          className="hidden peer"
                        />
                        <div className="flex min-h-10 items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2 py-2 text-center text-xs leading-tight shadow-sm transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary">
                          <RefreshCw className="w-3 h-3" /> Reemplazar
                        </div>
                      </Label>
                      <Label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="operacion-dept"
                          value="sumar"
                          checked={formData.operacion === "sumar"}
                          onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                          className="hidden peer"
                        />
                        <div className="flex min-h-10 items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2 py-2 text-center text-xs leading-tight shadow-sm transition-colors peer-checked:bg-green-500 peer-checked:text-white peer-checked:border-green-500">
                          <Plus className="w-3 h-3" /> Sumar
                        </div>
                      </Label>
                      <Label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="operacion-dept"
                          value="restar"
                          checked={formData.operacion === "restar"}
                          onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                          className="hidden peer"
                        />
                        <div className="flex min-h-10 items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2 py-2 text-center text-xs leading-tight shadow-sm transition-colors peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-500">
                          <Minus className="w-3 h-3" /> Restar
                        </div>
                      </Label>
                    </div>
                  </div>

                  {/* Alerta informativa según operación */}
                  <Alert variant={formData.operacion === 'reemplazar' ? 'default' : formData.operacion === 'restar' ? 'destructive' : 'default'} className={formData.operacion === 'sumar' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800' : ''}>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs ml-2">
                      {formData.operacion === 'reemplazar' &&
                        <>Esta operación <strong>reemplazará</strong> el balance actual de todos los empleados del departamento</>
                      }
                      {formData.operacion === 'sumar' &&
                        <>Esta operación <strong>sumará</strong> días al balance actual de todos los empleados del departamento</>
                      }
                      {formData.operacion === 'restar' &&
                        <>Esta operación <strong>restará</strong> días del balance actual de todos los empleados del departamento</>
                      }
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* Cantidad de Días */}
              <div className="space-y-2">
                <Label>Cantidad de Días *</Label>
                <Input
                  type="number"
                  className="h-12 text-center text-2xl font-semibold"
                  value={formData.cantidadAsignada}
                  onChange={(e) => setFormData({ ...formData, cantidadAsignada: e.target.value })}
                  min="0"
                  step="0.5"
                  placeholder="0.0"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {modoModal === "individual" ? (
                    formData.operacion === "sumar"
                      ? "Estos días se sumarán al balance actual del empleado"
                      : "Estos días se restarán del balance actual del empleado"
                  ) : (
                    "Todos los empleados del departamento tendrán exactamente esta cantidad de días"
                  )}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {modoModal === "individual"
                  ? (formData.operacion === "sumar" ? "Sumar Días" : "Restar Días")
                  : "Asignar a Departamento"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
