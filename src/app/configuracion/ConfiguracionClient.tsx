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
  "vacaciones.umbral_aprobacion_ejecutiva": "Umbral para Aprobación Ejecutiva",
  "vacaciones.permitir_medio_dia": "Permitir Medio Día",
  "vacaciones.acumulacion_habilitada": "Acumulación Habilitada",
  "vacaciones.max_acumulacion": "Máximo de Días Acumulables",
  "vacaciones.incluir_fines_semana": "Incluir Fines de Semana",
  "vacaciones.incluir_feriados": "Incluir Feriados",

  "notificaciones.email_habilitado": "Correo Electrónico Habilitado",
  "notificaciones.email_remitente": "Correo Remitente",
  "notificaciones.notificar_jefe_nueva_solicitud": "Notificar al Jefe (Nueva Solicitud)",
  "notificaciones.notificar_empleado_aprobacion": "Notificar al Empleado (Aprobación)",
  "notificaciones.notificar_empleado_rechazo": "Notificar al Empleado (Rechazo)",
  "notificaciones.notificar_rrhh_aprobacion_jefe": "Notificar a RRHH (Aprobación del Jefe)",
  "notificaciones.recordatorio_dias_antes": "Recordatorio (Días Antes)",

  "departamentos.max_ausencias_simultaneas": "Máximo Ausencias Simultáneas",
  "departamentos.porcentaje_max_ausentes": "Porcentaje Máximo de Ausentes (%)",
  "departamentos.validar_conflictos": "Validar Conflictos de Fechas",
  "departamentos.jefe_puede_auto_aprobar": "Jefe Puede Auto-Aprobar",
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
        "vacaciones.umbral_aprobacion_ejecutiva",
      ],
    },
    {
      titulo: "Reglas de Acumulación",
      descripcion: "Control sobre medio día, acumulación y conteo de días",
      icon: Calendar,
      claves: [
        "vacaciones.permitir_medio_dia",
        "vacaciones.acumulacion_habilitada",
        "vacaciones.max_acumulacion",
        "vacaciones.incluir_fines_semana",
        "vacaciones.incluir_feriados",
      ],
    },
  ],
  notificaciones: [
    {
      titulo: "Correo Electrónico",
      descripcion: "Configuración general del sistema de notificaciones",
      icon: Mail,
      claves: [
        "notificaciones.email_habilitado",
        "notificaciones.email_remitente",
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
        "departamentos.jefe_puede_auto_aprobar",
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

// ─── Componente Principal ─────────────────────────────
export default function ConfiguracionClient({ session }: ConfiguracionClientProps) {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaId>("general");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  // ── Cargar configuraciones ──
  const cargarConfiguraciones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/configuracion");
      const data = await res.json();

      if (data.success) {
        setConfigs(data.data);
        // Inicializar valores editados
        const valores: Record<string, string> = {};
        for (const c of data.data) {
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

  // ── Contar cambios pendientes en la categoría activa ──
  const cambiosPendientes = GRUPOS[categoriaActiva]
    .flatMap((g) => g.claves)
    .filter((clave) => dirtyKeys.has(clave)).length;

  const categoriaInfo = CATEGORIAS.find((c) => c.id === categoriaActiva)!;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${categoriaActiva === 'seguridad' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                  <categoriaInfo.icon className={`w-4 h-4 ${categoriaActiva === 'seguridad' ? 'text-red-500' : 'text-primary'}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{categoriaInfo.nombre}</h2>
                  <p className="text-[12px] text-muted-foreground">{categoriaInfo.descripcion}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {cambiosPendientes > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                    {cambiosPendientes} {cambiosPendientes === 1 ? "cambio" : "cambios"} pendiente{cambiosPendientes === 1 ? "" : "s"}
                  </Badge>
                )}
                <Button
                  onClick={guardarCambios}
                  disabled={saving || cambiosPendientes === 0}
                  size="sm"
                  className="gap-2"
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
}

function GrupoCard({ grupo, values, configs, dirtyKeys, onValueChange }: GrupoCardProps) {
  const Icon = grupo.icon;

  return (
    <Card className="bg-card text-card-foreground border shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
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
            const isDirty = dirtyKeys.has(clave);

            return (
              <ConfigField
                key={clave}
                clave={clave}
                valor={valor}
                descripcion={config.descripcion}
                esBool={esBool}
                esNumero={esNumero}
                isDirty={isDirty}
                onChange={(v) => onValueChange(clave, v)}
              />
            );
          })}
        </div>
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
  isDirty: boolean;
  onChange: (valor: string) => void;
}

function ConfigField({ clave, valor, descripcion, esBool, esNumero, isDirty, onChange }: ConfigFieldProps) {
  const label = LABELS[clave] || clave;

  if (esBool) {
    return (
      <div className="flex items-center justify-between py-1 group">
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
        type={esNumero ? "number" : "text"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-sm h-9 text-[13px] transition-all duration-200 ${
          isDirty
            ? "border-amber-400 ring-1 ring-amber-200 focus:ring-amber-300"
            : ""
        }`}
        min={esNumero ? 0 : undefined}
      />
    </div>
  );
}
