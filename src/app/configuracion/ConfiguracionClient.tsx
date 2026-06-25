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
  CalendarDays,
  Globe,
  Wrench,
  Server,
  MailCheck,
} from "lucide-react";
import type { Session } from "next-auth";
import { notify } from "@/lib/swal";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

// ─── Types ────────────────────────────────────────────
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

  "vacaciones.dias_anuales_default": "Días Anuales por Defecto",
  "vacaciones.dias_minimos_solicitud": "Mínimo de Días por Solicitud",
  "vacaciones.dias_maximos_consecutivos": "Máximo Días Consecutivos",
  "vacaciones.dias_anticipacion": "Días de Anticipación Mínima",
  "vacaciones.permitir_medio_dia": "Permitir Medio Día",
  "vacaciones.acumulacion_habilitada": "Acumulación Habilitada",
  "vacaciones.max_acumulacion": "Máximo de Días Acumulables",

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
  "departamentos.porcentaje_max_ausentes": "Porcentaje Máximo de Ausentes (%)",
  "departamentos.validar_conflictos": "Validar Conflictos de Fechas",
  "departamentos.mostrar_calendario_equipo": "Mostrar Calendario del Equipo",

  "seguridad.sesion_duracion_horas": "Duración de Sesión (horas)",
  "seguridad.password_min_length": "Longitud Mínima de Contraseña",
  "seguridad.password_requiere_mayuscula": "Requerir Mayúscula",
  "seguridad.password_requiere_numero": "Requerir Número",
  "seguridad.password_requiere_especial": "Requerir Carácter Especial",
  "seguridad.intentos_login_max": "Intentos de Login Máximos",
  "seguridad.bloqueo_duracion_minutos": "Duración de Bloqueo (minutos)",
  "seguridad.forzar_cambio_password_dias": "Forzar Cambio de Contraseña (días)",
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
      titulo: "Asignación Base",
      descripcion: "Configuración de días anuales y límites por solicitud",
      icon: CalendarDays,
      claves: [
        "vacaciones.dias_anuales_default",
        "vacaciones.dias_minimos_solicitud",
        "vacaciones.dias_maximos_consecutivos",
        "vacaciones.dias_anticipacion",
      ],
    },
    {
      titulo: "Reglas de Acumulación",
      descripcion: "Control sobre medio día y acumulación de saldo",
      icon: Calendar,
      claves: [
        "vacaciones.permitir_medio_dia",
        "vacaciones.acumulacion_habilitada",
        "vacaciones.max_acumulacion",
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
        "departamentos.porcentaje_max_ausentes",
      ],
    },
    {
      titulo: "Reglas de Flujo",
      descripcion: "Validaciones y permisos de gestión departamental",
      icon: Building2,
      claves: [
        "departamentos.validar_conflictos",
        "departamentos.mostrar_calendario_equipo",
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

const CONFIG_FALLBACKS: ConfigItem[] = [
  { id: -1, clave: "notificaciones.smtp_host", valor: "smtp.office365.com", descripcion: "Servidor SMTP para el envio de notificaciones", categoria: "notificaciones", tipoDato: "string", esPublico: false },
  { id: -2, clave: "notificaciones.smtp_port", valor: "587", descripcion: "Puerto del servidor SMTP", categoria: "notificaciones", tipoDato: "number", esPublico: false },
  { id: -3, clave: "notificaciones.smtp_user", valor: "", descripcion: "Usuario o cuenta SMTP autenticada", categoria: "notificaciones", tipoDato: "string", esPublico: false },
  { id: -4, clave: "notificaciones.smtp_password", valor: "", descripcion: "Contrasena de la cuenta SMTP", categoria: "notificaciones", tipoDato: "password", esPublico: false },
  { id: -5, clave: "notificaciones.smtp_secure", valor: "false", descripcion: "Usar SSL/TLS directo. Normalmente false para STARTTLS en puerto 587", categoria: "notificaciones", tipoDato: "boolean", esPublico: false },
  { id: -6, clave: "notificaciones.smtp_require_tls", valor: "true", descripcion: "Exigir STARTTLS cuando el servidor lo soporte", categoria: "notificaciones", tipoDato: "boolean", esPublico: false },
  { id: -7, clave: "notificaciones.smtp_reject_unauthorized", valor: "true", descripcion: "Validar el certificado TLS del servidor SMTP", categoria: "notificaciones", tipoDato: "boolean", esPublico: false },
];

function mergeConfigFallbacks(configs: ConfigItem[]) {
  const existingKeys = new Set(configs.map((c) => c.clave));
  return [
    ...configs,
    ...CONFIG_FALLBACKS.filter((fallback) => !existingKeys.has(fallback.clave)),
  ];
}

const SMTP_CLAVES =
  GRUPOS.notificaciones.find((g) => g.titulo === "Servidor SMTP")?.claves ?? [];

// ─── Componente Principal ─────────────────────────────
export default function ConfiguracionClient({ session }: ConfiguracionClientProps) {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaId>("general");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [testingSmtp, setTestingSmtp] = useState(false);

  // ── Cargar configuraciones ──
  const cargarConfiguraciones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/configuracion");
      const data = await res.json();

      if (data.success) {
        const configsConFallbacks = mergeConfigFallbacks(data.data);
        setConfigs(configsConFallbacks);
        // Inicializar valores editados
        const valores: Record<string, string> = {};
        for (const c of configsConFallbacks) {
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

  // ── Contar cambios pendientes en la categoría activa ──
  const cambiosPendientes = GRUPOS[categoriaActiva]
    .flatMap((g) => g.claves)
    .filter((clave) => dirtyKeys.has(clave)).length;

  const categoriaInfo = CATEGORIAS.find((c) => c.id === categoriaActiva)!;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
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
                <div className="flex flex-col gap-1">
                  {CATEGORIAS.map((cat) => {
                    const Icon = cat.icon;
                    const count = configs.filter((c) => c.categoria === cat.id).length;
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
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                            {count}
                          </Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
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
  configs: ConfigItem[];
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
            const config = configs.find((c) => c.clave === clave);
            if (!config) return null;

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
                descripcion={config.descripcion}
                esBool={esBool}
                esNumero={esNumero}
                esPassword={esPassword}
                isDirty={isDirty}
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

// ─── Componente de Campo Individual ───────────────────
interface ConfigFieldProps {
  clave: string;
  valor: string;
  descripcion?: string;
  esBool: boolean;
  esNumero: boolean;
  esPassword: boolean;
  isDirty: boolean;
  onChange: (valor: string) => void;
}

function ConfigField({ clave, valor, descripcion, esBool, esNumero, esPassword, isDirty, onChange }: ConfigFieldProps) {
  const label = LABELS[clave] || clave;

  if (esBool) {
    return (
      <div className="flex items-start justify-between gap-3 py-1 group">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <Label className="text-[13px] font-medium text-foreground cursor-pointer">
              {label}
            </Label>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          {descripcion && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{descripcion}</p>
          )}
        </div>
        <Switch
          checked={valor === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={`config-${clave}`} className="text-[13px] font-medium text-foreground">
          {label}
        </Label>
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        )}
      </div>
      {descripcion && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{descripcion}</p>
      )}
      <Input
        id={`config-${clave}`}
        type={esPassword ? "password" : esNumero ? "number" : "text"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full sm:max-w-sm h-9 text-[13px] transition-all duration-200 ${
          isDirty
            ? "border-amber-400 ring-1 ring-amber-200 focus:ring-amber-300"
            : ""
        }`}
        min={esNumero ? 0 : undefined}
      />
    </div>
  );
}
