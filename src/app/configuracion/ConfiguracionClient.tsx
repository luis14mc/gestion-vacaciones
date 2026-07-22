"use client";

/**
 * ============================================================
 * CONFIGURACIÓN DEL SISTEMA — Cliente
 * ============================================================
 * @description Interfaz premium de configuración con formularios
 *              agrupados por categoría. Diseño tipo Settings de
 *              aplicación SaaS (no listado key-value).
 * @version 6.0 — ISO/IEC 12207 + OWASP 2026
 * ============================================================
 */

import { useEffect, useState, useCallback } from "react";
import {
  Settings,
  Calendar,
  Mail,
  Building2,
  Shield,
  Save,
  Loader2,
  Lock,
  Clock,
  KeyRound,
  BellRing,
  Users,
  Globe,
  Wrench,
  Server,
  MailCheck,
  Play,
  Info,
  CalendarClock,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify } from "@/lib/swal";
import { CONFIG_KEYS } from "@/lib/config/catalog";
import {
  CONFIG_PASSWORD_MASK,
  debeOmitirActualizacionSmtpPassword,
  resolverConfigItem,
  SMTP_PASSWORD_CLAVE,
  type ConfiguracionCliente,
} from "@/lib/config/config-client";
import {
  REGLAS_ASIGNACION_MENSUAL_VACACIONES,
} from "@/lib/domain/vacaciones-asignacion";
import type { ResumenAsignacionMensual } from "@/services/asignacion-vacaciones.service";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────
interface ConfiguracionClientProps {
  session: Session;
}

type CategoriaId = "general" | "vacaciones" | "notificaciones" | "departamentos" | "seguridad";

interface CategoriaInfo {
  id: CategoriaId;
  nombre: string;
  descripcion: string;
  icon: React.ElementType;
}

// ─── Categorías del sidebar ───────────────────────────
const CATEGORIAS: CategoriaInfo[] = [
  { id: "general", nombre: "General", descripcion: "Identidad y datos de la aplicación", icon: Settings },
  { id: "vacaciones", nombre: "Vacaciones", descripcion: "Reglas del motor de vacaciones", icon: Calendar },
  { id: "notificaciones", nombre: "Notificaciones", descripcion: "Alertas y correos electrónicos", icon: Mail },
  { id: "departamentos", nombre: "Departamentos", descripcion: "Restricciones organizacionales", icon: Building2 },
  { id: "seguridad", nombre: "Seguridad", descripcion: "Contraseñas, sesiones y bloqueos", icon: Shield },
];

// ─── Mapeo de claves → label legible ──────────────────
const LABELS: Record<string, string> = {
  "app.nombre": "Nombre de la Aplicación",
  "app.version": "Versión del Sistema",
  "app.empresa": "Razón Social",
  "app.siglas": "Siglas",
  "app.pais": "País",
  "app.timezone": "Zona Horaria",
  "app.idioma": "Idioma",
  "app.mantenimiento": "Modo Mantenimiento",

  "vacaciones.dias_anuales_default": "Fallback para usuarios sin fecha de ingreso",
  "vacaciones.dias_minimos_solicitud": "Mínimo de Días por Solicitud",
  "vacaciones.dias_maximos_consecutivos": "Máximo Días Consecutivos",
  "vacaciones.dias_anticipacion": "Días de Anticipación Mínima",
  "vacaciones.permitir_medio_dia": "Permitir Medio Día",

  "notificaciones.email_habilitado": "Correo Electrónico Habilitado",
  "notificaciones.email_remitente": "Correo Remitente",
  "notificaciones.smtp_host": "Servidor SMTP",
  "notificaciones.smtp_port": "Puerto SMTP",
  "notificaciones.smtp_user": "Usuario SMTP",
  "notificaciones.smtp_password": "Contraseña SMTP",
  "notificaciones.smtp_secure": "Usar SSL/TLS Directo",
  "notificaciones.smtp_require_tls": "Requerir STARTTLS",
  "notificaciones.smtp_reject_unauthorized": "Validar Certificado TLS",
  "notificaciones.notificar_jefe_nueva_solicitud": "Notificar al Jefe (Nueva Solicitud)",
  "notificaciones.notificar_empleado_aprobacion": "Notificar al Empleado (Aprobación)",
  "notificaciones.notificar_empleado_rechazo": "Notificar al Empleado (Rechazo)",
  "notificaciones.notificar_rrhh_aprobacion_jefe": "Notificar a RRHH (Aprobación del Jefe)",
  "notificaciones.recordatorio_dias_antes": "Recordatorio (Días Antes)",

  "departamentos.max_ausencias_simultaneas": "Máximo Ausencias Simultáneas",
  "departamentos.validar_conflictos": "Validar Conflictos de Fechas",

  "seguridad.sesion_duracion_horas": "Duración de Sesión (horas)",
  "seguridad.password_min_length": "Longitud Mínima de Contraseña",
  "seguridad.password_requiere_mayuscula": "Requerir Mayúscula",
  "seguridad.password_requiere_numero": "Requerir Número",
  "seguridad.password_requiere_especial": "Requerir Carácter Especial",
  "seguridad.intentos_login_max": "Intentos de Login Máximos",
  "seguridad.bloqueo_duracion_minutos": "Duración de Bloqueo (minutos)",
  "seguridad.forzar_cambio_password_dias": "Forzar Cambio de Contraseña (días)",
};

// ─── Claves sin efecto real en backend (banner "Próximamente") ───
const CLAVES_NO_IMPLEMENTADAS: Record<string, string> = {
  "notificaciones.recordatorio_dias_antes":
    "No hay cron ni job programado que lea este valor. Se conserva en el catálogo para uso futuro.",
};

// ─── Grupos temáticos dentro de cada categoría ────────
interface GrupoConfiguracion {
  titulo: string;
  descripcion: string;
  icon: React.ElementType;
  claves: string[];
}

const GRUPOS: Record<CategoriaId, GrupoConfiguracion[]> = {
  general: [
    {
      titulo: "Identidad de la Aplicación",
      descripcion: "Nombre, versión y datos corporativos",
      icon: Globe,
      claves: ["app.nombre", "app.version", "app.empresa", "app.siglas"],
    },
    {
      titulo: "Localización",
      descripcion: "País, zona horaria e idioma",
      icon: Globe,
      claves: ["app.pais", "app.timezone", "app.idioma"],
    },
    {
      titulo: "Mantenimiento",
      descripcion: "Bloquear acceso de usuarios durante mantenimiento",
      icon: Wrench,
      claves: ["app.mantenimiento"],
    },
  ],
  vacaciones: [
    {
      titulo: "Reglas por Solicitud",
      descripcion: "Límites al crear solicitudes de vacaciones",
      icon: Calendar,
      claves: [
        "vacaciones.dias_minimos_solicitud",
        "vacaciones.dias_maximos_consecutivos",
        "vacaciones.dias_anticipacion",
        "vacaciones.permitir_medio_dia",
      ],
    },
  ],
  notificaciones: [
    {
      titulo: "Correo Electrónico",
      descripcion: "Estado general y correo remitente visible en las notificaciones",
      icon: Mail,
      claves: [
        "notificaciones.email_habilitado",
        "notificaciones.email_remitente",
      ],
    },
    {
      titulo: "Servidor SMTP",
      descripcion: "Credenciales y parámetros de conexión para enviar correos",
      icon: Server,
      claves: [
        "notificaciones.smtp_host",
        "notificaciones.smtp_port",
        "notificaciones.smtp_user",
        "notificaciones.smtp_password",
        "notificaciones.smtp_secure",
        "notificaciones.smtp_require_tls",
        "notificaciones.smtp_reject_unauthorized",
      ],
    },
    {
      titulo: "Eventos de Notificación",
      descripcion: "Cuándo y a quién notificar automáticamente",
      icon: BellRing,
      claves: [
        "notificaciones.notificar_jefe_nueva_solicitud",
        "notificaciones.notificar_empleado_aprobacion",
        "notificaciones.notificar_empleado_rechazo",
        "notificaciones.notificar_rrhh_aprobacion_jefe",
        "notificaciones.recordatorio_dias_antes",
      ],
    },
  ],
  departamentos: [
    {
      titulo: "Restricciones de Ausencia",
      descripcion: "Límites de ausencias simultáneas por departamento",
      icon: Users,
      claves: [
        "departamentos.max_ausencias_simultaneas",
      ],
    },
    {
      titulo: "Reglas de Flujo",
      descripcion: "Validaciones de capacidad y superposición al crear solicitudes",
      icon: Building2,
      claves: [
        "departamentos.validar_conflictos",
      ],
    },
  ],
  seguridad: [
    {
      titulo: "Políticas de Contraseña",
      descripcion: "Requisitos mínimos para contraseñas de usuarios",
      icon: KeyRound,
      claves: [
        "seguridad.password_min_length",
        "seguridad.password_requiere_mayuscula",
        "seguridad.password_requiere_numero",
        "seguridad.password_requiere_especial",
        "seguridad.forzar_cambio_password_dias",
      ],
    },
    {
      titulo: "Bloqueo de Cuentas",
      descripcion: "Protección contra ataques de fuerza bruta",
      icon: Lock,
      claves: [
        "seguridad.intentos_login_max",
        "seguridad.bloqueo_duracion_minutos",
      ],
    },
    {
      titulo: "Sesión",
      descripcion: "Duración máxima de la sesión activa",
      icon: Clock,
      claves: ["seguridad.sesion_duracion_horas"],
    },
  ],
};

const CLAVE_FALLBACK_DIAS_ANUALES = "vacaciones.dias_anuales_default";

const SMTP_CLAVES =
  GRUPOS.notificaciones.find((g) => g.titulo === "Servidor SMTP")?.claves ?? [];

interface ResultadoAsignacion {
  anio: number;
  mes: number;
  usuariosProcesados: number;
  asignacionesCreadas: number;
  usuariosOmitidos: number;
  totalDiasAsignados: number;
}

// ─── Componente Principal ─────────────────────────────
export default function ConfiguracionClient({ session }: ConfiguracionClientProps) {
  const [configs, setConfigs] = useState<ConfiguracionCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaId>("general");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [ejecutandoAsignacion, setEjecutandoAsignacion] = useState(false);
  const [resultadoAsignacion, setResultadoAsignacion] = useState<ResultadoAsignacion | null>(null);
  const [mostrarAlertaDefaults, setMostrarAlertaDefaults] = useState(false);
  const [anioAsignacionMensual, setAnioAsignacionMensual] = useState<number>(
    new Date().getFullYear()
  );
  const [mesAsignacionMensual, setMesAsignacionMensual] = useState<number>(
    new Date().getMonth() + 1
  );

  const puedeEjecutarAsignacion =
    Boolean(session.user?.esAdmin) || Boolean(session.user?.esRrhh);

  // ── Cargar configuraciones ──
  const cargarConfiguraciones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/configuracion");
      const data = await res.json();

      if (data.success) {
        const configsCatalogo = (data.data as ConfiguracionCliente[]) ?? [];
        setConfigs(configsCatalogo);
        setMostrarAlertaDefaults(
          Boolean(data.meta?.bdEstabaVacia) || Number(data.meta?.clavesInsertadas ?? 0) > 0
        );
        const valores: Record<string, string> = {};
        for (const c of configsCatalogo) {
          valores[c.clave] = c.valor;
        }
        setEditedValues(valores);
        setDirtyKeys(new Set());
      } else {
        notify.error("Error", data.error || "Error al cargar configuraciones");
      }
    } catch {
      notify.error("Error", "Error al cargar configuraciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguraciones();
  }, [cargarConfiguraciones]);

  // ── Manejar cambio de valor ──
  const handleValueChange = (clave: string, nuevoValor: string) => {
    setEditedValues((prev) => ({ ...prev, [clave]: nuevoValor }));
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      // Verificar si el valor cambió respecto al original
      const original = configs.find((c) => c.clave === clave)?.valor;
      if (nuevoValor === original) {
        next.delete(clave);
      } else {
        next.add(clave);
      }
      return next;
    });
  };

  // ── Guardar cambios de la categoría activa ──
  const guardarCambios = async () => {
    const clavesCategoria = GRUPOS[categoriaActiva].flatMap((g) => g.claves);
    const cambios = clavesCategoria
      .filter((clave) => dirtyKeys.has(clave))
      .filter(
        (clave) =>
          !(clave === SMTP_PASSWORD_CLAVE && debeOmitirActualizacionSmtpPassword(editedValues[clave]))
      )
      .map((clave) => ({ clave, valor: editedValues[clave] }));

    if (cambios.length === 0) {
      notify.info("Sin cambios", "No hay modificaciones pendientes en esta categoría");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });

      const data = await res.json();

      if (data.success) {
        await cargarConfiguraciones();
        notify.success("Guardado", data.message || "Configuraciones actualizadas exitosamente");
      } else {
        notify.error("Error", data.error || "Error al guardar configuraciones");
      }
    } catch {
      notify.error("Error", "Error al guardar configuraciones");
    } finally {
      setSaving(false);
    }
  };

  const probarConexionSmtp = async () => {
    const smtpDirty = SMTP_CLAVES.filter((clave) => dirtyKeys.has(clave));

    try {
      setTestingSmtp(true);

      if (smtpDirty.length > 0) {
        const cambios = smtpDirty.map((clave) => ({
          clave,
          valor: editedValues[clave],
        }));

        const saveRes = await fetch("/api/configuracion", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambios),
        });
        const saveData = await saveRes.json();

        if (!saveData.success) {
          notify.error(
            "Error",
            saveData.error || "No se pudieron guardar los cambios SMTP antes de probar"
          );
          return;
        }

        await cargarConfiguraciones();
      }

      const res = await fetch("/api/configuracion/verificar-smtp", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        notify.success("SMTP", data.message || "Conexión SMTP verificada correctamente.");
      } else {
        const detalle = data.detalle ? `: ${data.detalle}` : "";
        notify.error("SMTP", `${data.message || data.error || "No se pudo verificar SMTP"}${detalle}`);
      }
    } catch {
      notify.error("Error", "No se pudo verificar la conexión SMTP");
    } finally {
      setTestingSmtp(false);
    }
  };

  const ejecutarAsignacionAutomatica = async () => {
    try {
      setEjecutandoAsignacion(true);
      setResultadoAsignacion(null);

      const res = await fetch("/api/admin/asignacion-mensual-vacaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anio: anioAsignacionMensual,
          mes: mesAsignacionMensual,
          modo: "manual",
        }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        const r = data.data as ResumenAsignacionMensual;
        setResultadoAsignacion({
          anio: r.anio,
          mes: r.mes,
          usuariosProcesados: r.usuariosProcesados,
          asignacionesCreadas: r.asignacionesCreadas,
          usuariosOmitidos: r.usuariosOmitidos,
          totalDiasAsignados: r.totalDiasAsignados,
        });
        notify.success(
          "Asignación mensual completada",
          `${r.asignacionesCreadas} asignaciones creadas · ${r.usuariosOmitidos} omitidos · ${r.totalDiasAsignados.toFixed(4)} días`
        );
      } else {
        notify.error(
          "Error",
          data.error || "No se pudo ejecutar la asignación mensual"
        );
      }
    } catch {
      notify.error("Error", "No se pudo ejecutar la asignación mensual");
    } finally {
      setEjecutandoAsignacion(false);
    }
  };

  const fallbackDiasConfig = resolverConfigItem(CLAVE_FALLBACK_DIAS_ANUALES, configs);

  // ── Contar cambios pendientes en la categoría activa ──
  const cambiosPendientes = GRUPOS[categoriaActiva]
    .flatMap((g) => g.claves)
    .filter((clave) => dirtyKeys.has(clave)).length;

  const categoriaInfo = CATEGORIAS.find((c) => c.id === categoriaActiva)!;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {mostrarAlertaDefaults && (
          <Alert className="mb-6 border-amber-200 bg-amber-50/60 text-amber-950">
            <Info className="text-amber-600" />
            <AlertTitle className="text-amber-900">Valores predeterminados cargados</AlertTitle>
            <AlertDescription className="text-amber-800/90">
              No se encontraron parámetros persistidos o faltaban claves del catálogo. Se cargaron
              valores predeterminados. Revise y guarde para confirmarlos en la base de datos.
            </AlertDescription>
          </Alert>
        )}
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Configuración del Sistema
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Administra los parámetros y políticas del sistema
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ── Sidebar de categorías ── */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20 bg-card text-card-foreground">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-semibold text-foreground">
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TooltipProvider delayDuration={200}>
                <div className="flex flex-col gap-1">
                  {CATEGORIAS.map((cat) => {
                    const Icon = cat.icon;
                    const count = GRUPOS[cat.id].flatMap((g) => g.claves).filter((clave) =>
                      CONFIG_KEYS.has(clave)
                    ).length;
                    const isActive = categoriaActiva === cat.id;
                    const hasDirty = GRUPOS[cat.id]
                      .flatMap((g) => g.claves)
                      .some((clave) => dirtyKeys.has(clave));

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`
                          w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left
                          transition-all duration-200 group
                          ${isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }
                        `}
                        onClick={() => setCategoriaActiva(cat.id)}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          <span className="text-[13px] font-medium">{cat.nombre}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {hasDirty && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 cursor-help">
                                {count}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Cantidad de parámetros disponibles en esta categoría.
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      </button>
                    );
                  })}
                </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          {/* ── Contenido principal ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header de categoría + botón guardar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`p-2 rounded-lg ${categoriaActiva === 'seguridad' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                  <categoriaInfo.icon className={`w-4 h-4 ${categoriaActiva === 'seguridad' ? 'text-red-500' : 'text-primary'}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{categoriaInfo.nombre}</h2>
                  <p className="text-[12px] text-muted-foreground">{categoriaInfo.descripcion}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {cambiosPendientes > 0 && (
                  <Badge variant="outline" className="w-fit text-amber-600 border-amber-300 bg-amber-50 text-xs">
                    {cambiosPendientes} {cambiosPendientes === 1 ? "cambio" : "cambios"} pendiente{cambiosPendientes === 1 ? "" : "s"}
                  </Badge>
                )}
                <Button
                  onClick={guardarCambios}
                  disabled={saving || cambiosPendientes === 0}
                  size="sm"
                  className="gap-2 sm:w-auto"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </div>

            {/* Formularios agrupados */}
            {loading ? (
              <div className="space-y-6">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="bg-card">
                    <CardContent className="pt-6 space-y-4">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full max-w-sm" />
                      <div className="space-y-3 pt-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {categoriaActiva === "vacaciones" && (
                  <AsignacionAntiguedadCard
                    puedeEjecutar={puedeEjecutarAsignacion}
                    ejecutando={ejecutandoAsignacion}
                    resultado={resultadoAsignacion}
                    anio={anioAsignacionMensual}
                    mes={mesAsignacionMensual}
                    onAnioChange={setAnioAsignacionMensual}
                    onMesChange={setMesAsignacionMensual}
                    onEjecutar={ejecutarAsignacionAutomatica}
                  />
                )}
                {GRUPOS[categoriaActiva].map((grupo, idx) => (
                  <GrupoCard
                    key={`${categoriaActiva}-${idx}`}
                    grupo={grupo}
                    values={editedValues}
                    configs={configs}
                    dirtyKeys={dirtyKeys}
                    onValueChange={handleValueChange}
                    footer={
                      grupo.titulo === "Servidor SMTP" ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[11px] text-muted-foreground">
                            Si hay cambios sin guardar en SMTP, se guardan automáticamente antes de probar.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 shrink-0"
                            onClick={probarConexionSmtp}
                            disabled={testingSmtp || saving}
                          >
                            {testingSmtp ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MailCheck className="w-4 h-4" />
                            )}
                            Probar conexión SMTP
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                ))}
                {categoriaActiva === "vacaciones" && fallbackDiasConfig && (
                  <FallbackDiasAnualesCard
                    config={fallbackDiasConfig}
                    valor={editedValues[CLAVE_FALLBACK_DIAS_ANUALES] ?? fallbackDiasConfig.valor}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de Grupo ──────────────────────────────
interface GrupoCardProps {
  grupo: GrupoConfiguracion;
  values: Record<string, string>;
  configs: ConfiguracionCliente[];
  dirtyKeys: Set<string>;
  onValueChange: (clave: string, valor: string) => void;
  footer?: React.ReactNode;
}

function GrupoCard({ grupo, values, configs, dirtyKeys, onValueChange, footer }: GrupoCardProps) {
  const Icon = grupo.icon;

  return (
    <Card className="bg-card text-card-foreground border shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-[14px] font-semibold">{grupo.titulo}</CardTitle>
            <CardDescription className="text-[12px] mt-0.5">{grupo.descripcion}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-5" />
        <div className="space-y-5">
          {grupo.claves.map((clave) => {
            const config = resolverConfigItem(clave, configs);

            const valor = values[clave] ?? config.valor;
            const esBool = config.tipoDato === "boolean" || valor === "true" || valor === "false";
            const esNumero = config.tipoDato === "number";
            const esPassword = config.tipoDato === "password" || clave.toLowerCase().includes("password");
            const isDirty = dirtyKeys.has(clave);

            return (
              <ConfigField
                key={clave}
                clave={clave}
                valor={valor}
                descripcion={config.descripcion ?? undefined}
                esBool={esBool}
                esNumero={esNumero}
                esPassword={esPassword}
                isDirty={isDirty}
                persistido={config.persistido !== false}
                tieneValor={config.tieneValor}
                noImplementada={CLAVES_NO_IMPLEMENTADAS[clave]}
                onChange={(v) => onValueChange(clave, v)}
              />
            );
          })}
        </div>
        {footer ? (
          <>
            <Separator className="my-5" />
            {footer}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface AsignacionAntiguedadCardProps {
  puedeEjecutar: boolean;
  ejecutando: boolean;
  resultado: ResultadoAsignacion | null;
  anio: number;
  mes: number;
  onAnioChange: (anio: number) => void;
  onMesChange: (mes: number) => void;
  onEjecutar: () => void;
}

const MESES_LABEL: Record<number, string> = {
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
};

function AsignacionAntiguedadCard({
  puedeEjecutar,
  ejecutando,
  resultado,
  anio,
  mes,
  onAnioChange,
  onMesChange,
  onEjecutar,
}: AsignacionAntiguedadCardProps) {
  return (
    <Card className="bg-card text-card-foreground border shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-muted">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-[14px] font-semibold">
              {REGLAS_ASIGNACION_MENSUAL_VACACIONES.titulo}
            </CardTitle>
            <CardDescription className="text-[12px] mt-0.5">
              {REGLAS_ASIGNACION_MENSUAL_VACACIONES.descripcion}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-5" />

        <Alert className="border-blue-200 bg-blue-50/50 text-blue-950 mb-5">
          <Info className="text-blue-600" />
          <AlertTitle className="text-blue-900 text-[12px]">
            Código de Trabajo
          </AlertTitle>
          <AlertDescription className="text-blue-800/90 text-[11px]">
            Los días se asignan mes a mes según la antigüedad del colaborador. Un mismo
            (colaborador, año, mes) no puede asignarse dos veces.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px]">Antigüedad</TableHead>
                <TableHead className="text-[12px] text-right w-24">Días/año</TableHead>
                <TableHead className="text-[12px] text-right w-28">Días/mes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas.map((regla) => (
                <TableRow key={regla.aniosCumplidos}>
                  <TableCell className="text-[13px]">
                    {regla.aniosCumplidos === 0
                      ? "Menos de 1 año"
                      : regla.aniosCumplidos === 1
                        ? "1 año cumplido"
                        : regla.aniosCumplidos < 4
                          ? `${regla.aniosCumplidos} años cumplidos`
                          : "4 años o más"}
                  </TableCell>
                  <TableCell className="text-[13px] text-right font-medium tabular-nums">
                    {regla.diasAnuales}
                  </TableCell>
                  <TableCell className="text-[13px] text-right font-medium tabular-nums">
                    {regla.diasMensuales.toFixed(4).replace(/\.?0+$/, "") || "0"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {resultado && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Procesados</p>
              <p className="text-lg font-semibold tabular-nums">
                {resultado.usuariosProcesados}
              </p>
            </div>
            <div className="rounded-lg border bg-emerald-50/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Asignaciones</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-700">
                {resultado.asignacionesCreadas}
              </p>
            </div>
            <div className="rounded-lg border bg-amber-50/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Omitidos</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">
                {resultado.usuariosOmitidos}
              </p>
            </div>
            <div className="rounded-lg border bg-blue-50/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Total días</p>
              <p className="text-lg font-semibold tabular-nums text-blue-700">
                {resultado.totalDiasAsignados.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <Separator className="my-5" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Año</Label>
              <Select
                value={anio.toString()}
                onValueChange={(val) => onAnioChange(Number(val))}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Mes</Label>
              <Select
                value={mes.toString()}
                onValueChange={(val) => onMesChange(Number(val))}
              >
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MESES_LABEL).map(([numero, nombre]) => (
                    <SelectItem key={numero} value={numero}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 shrink-0"
            onClick={onEjecutar}
            disabled={!puedeEjecutar || ejecutando}
          >
            {ejecutando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Ejecutar asignación mensual
          </Button>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Asigna los días proporcionales del mes seleccionado a cada colaborador activo
          con al menos 1 año de antigüedad. Si el mes ya fue asignado, se omite
          (protección contra duplicados).
        </p>
      </CardContent>
    </Card>
  );
}

interface FallbackDiasAnualesCardProps {
  config: ConfiguracionCliente;
  valor: string;
}

function FallbackDiasAnualesCard({ config, valor }: FallbackDiasAnualesCardProps) {
  return (
    <Card className="bg-card text-card-foreground border border-dashed shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-muted">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-[14px] font-semibold">
              Configuración legacy (no en uso)
            </CardTitle>
            <CardDescription className="text-[12px] mt-0.5">
              Este valor no participa en la asignación automática por antigüedad.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <Alert className="border-amber-200 bg-amber-50/50 text-amber-950">
          <Info className="text-amber-600" />
          <AlertTitle className="text-amber-900">No afecta la asignación actual</AlertTitle>
          <AlertDescription className="text-amber-800/90">
            El endpoint de asignación automática usa únicamente la fecha de ingreso del
            colaborador. Este fallback se conserva solo por compatibilidad histórica.
          </AlertDescription>
        </Alert>
        <ConfigField
          clave={config.clave}
          valor={valor}
          descripcion={config.descripcion ?? undefined}
          esBool={false}
          esNumero
          esPassword={false}
          isDirty={false}
          disabled
          onChange={() => {}}
        />
      </CardContent>
    </Card>
  );
}

// ─── Componente de Campo Individual ───────────────────
interface ConfigFieldProps {
  clave: string;
  valor: string;
  descripcion?: string;
  esBool: boolean;
  esNumero: boolean;
  esPassword: boolean;
  isDirty: boolean;
  persistido?: boolean;
  tieneValor?: boolean;
  disabled?: boolean;
  noImplementada?: string;
  onChange: (valor: string) => void;
}

function ConfigField({
  clave,
  valor,
  descripcion,
  esBool,
  esNumero,
  esPassword,
  isDirty,
  persistido = true,
  tieneValor = false,
  disabled = false,
  noImplementada,
  onChange,
}: ConfigFieldProps) {
  const label = LABELS[clave] || clave;
  const inputValor =
    esPassword && !valor && tieneValor ? CONFIG_PASSWORD_MASK : valor;
  const passwordPlaceholder =
    esPassword && tieneValor && !isDirty ? "Contraseña configurada (sin cambios)" : undefined;

  if (esBool) {
    return (
      <div className="flex items-start justify-between gap-3 py-1 group">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-[13px] font-medium text-foreground cursor-pointer">
              {label}
            </Label>
            {!persistido && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-dashed">
                Valor predeterminado
              </Badge>
            )}
            {noImplementada && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 bg-amber-50 text-amber-700">
                Próximamente
              </Badge>
            )}
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          {descripcion && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{descripcion}</p>
          )}
          {noImplementada && (
            <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">{noImplementada}</p>
          )}
        </div>
        <Switch
          checked={valor === "true"}
          disabled={disabled || !!noImplementada}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Label htmlFor={`config-${clave}`} className="text-[13px] font-medium text-foreground">
          {label}
        </Label>
        {!persistido && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-dashed">
            Valor predeterminado
          </Badge>
        )}
        {noImplementada && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 bg-amber-50 text-amber-700">
            Próximamente
          </Badge>
        )}
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        )}
      </div>
      {descripcion && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{descripcion}</p>
      )}
      {noImplementada && (
        <p className="text-[11px] text-amber-700 leading-relaxed">{noImplementada}</p>
      )}
      <Input
        id={`config-${clave}`}
        type={esPassword ? "password" : esNumero ? "number" : "text"}
        value={inputValor}
        placeholder={passwordPlaceholder}
        disabled={disabled || !!noImplementada}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full sm:max-w-sm h-9 text-[13px] transition-all duration-200 ${
          disabled || noImplementada
            ? "opacity-60 cursor-not-allowed bg-muted/40"
            : isDirty
              ? "border-amber-400 ring-1 ring-amber-200 focus:ring-amber-300"
              : ""
        }`}
        min={esNumero ? 0 : undefined}
      />
    </div>
  );
}
