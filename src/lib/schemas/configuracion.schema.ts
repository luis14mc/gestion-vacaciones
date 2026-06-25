/**
 * ============================================================
 * SCHEMA: CONFIGURACIÓN DEL SISTEMA
 * ============================================================
 * @description Esquemas Zod para validación de formularios
 *              agrupados por categoría de configuración
 * @version 6.0 — Formularios estructurados por categoría
 * ============================================================
 */

import { z } from "zod";

// ─── General ──────────────────────────────────────────
export const generalConfigSchema = z.object({
  "app.nombre": z.string().min(1, "El nombre es requerido").max(100),
  "app.version": z.string().min(1, "La versión es requerida"),
  "app.empresa": z.string().min(1, "La empresa es requerida").max(200),
  "app.siglas": z.string().min(1, "Las siglas son requeridas").max(20),
  "app.pais": z.string().min(1, "El país es requerido").max(100),
  "app.timezone": z.string().min(1, "La zona horaria es requerida"),
  "app.idioma": z.string().min(1, "El idioma es requerido").max(10),
  "app.mantenimiento": z.string().regex(/^(true|false)$/, "Debe ser true o false"),
});

// ─── Vacaciones ───────────────────────────────────────
export const vacacionesConfigSchema = z.object({
  "vacaciones.dias_anuales_default": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 365; },
    "Debe ser un número entre 1 y 365"
  ),
  "vacaciones.dias_minimos_solicitud": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 30; },
    "Debe ser un número entre 1 y 30"
  ),
  "vacaciones.dias_maximos_consecutivos": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 365; },
    "Debe ser un número entre 1 y 365"
  ),
  "vacaciones.dias_anticipacion": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 90; },
    "Debe ser un número entre 0 y 90"
  ),
  "vacaciones.permitir_medio_dia": z.string().regex(/^(true|false)$/),
  "vacaciones.acumulacion_habilitada": z.string().regex(/^(true|false)$/),
  "vacaciones.max_acumulacion": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 365; },
    "Debe ser un número entre 0 y 365"
  ),
});

// ─── Notificaciones ───────────────────────────────────
export const notificacionesConfigSchema = z.object({
  "notificaciones.email_habilitado": z.string().regex(/^(true|false)$/),
  "notificaciones.email_remitente": z.string().email("Debe ser un correo electrónico válido"),
  "notificaciones.smtp_host": z.string().min(1, "El host SMTP es requerido").max(255),
  "notificaciones.smtp_port": z.string().refine(
    (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 65535; },
    "Debe ser un puerto entre 1 y 65535"
  ),
  "notificaciones.smtp_user": z.string().min(1, "El usuario SMTP es requerido").max(255),
  "notificaciones.smtp_password": z.string().optional(),
  "notificaciones.smtp_secure": z.string().regex(/^(true|false)$/),
  "notificaciones.smtp_require_tls": z.string().regex(/^(true|false)$/),
  "notificaciones.smtp_reject_unauthorized": z.string().regex(/^(true|false)$/),
  "notificaciones.notificar_jefe_nueva_solicitud": z.string().regex(/^(true|false)$/),
  "notificaciones.notificar_empleado_aprobacion": z.string().regex(/^(true|false)$/),
  "notificaciones.notificar_empleado_rechazo": z.string().regex(/^(true|false)$/),
  "notificaciones.notificar_rrhh_aprobacion_jefe": z.string().regex(/^(true|false)$/),
  "notificaciones.recordatorio_dias_antes": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 30; },
    "Debe ser un número entre 0 y 30"
  ),
});

// ─── Departamentos ────────────────────────────────────
export const departamentosConfigSchema = z.object({
  "departamentos.max_ausencias_simultaneas": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 100; },
    "Debe ser un número entre 1 y 100"
  ),
  "departamentos.porcentaje_max_ausentes": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 100; },
    "Debe ser un porcentaje entre 1 y 100"
  ),
  "departamentos.validar_conflictos": z.string().regex(/^(true|false)$/),
  "departamentos.mostrar_calendario_equipo": z.string().regex(/^(true|false)$/),
});

// ─── Seguridad ────────────────────────────────────────
export const seguridadConfigSchema = z.object({
  "seguridad.sesion_duracion_horas": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 720; },
    "Debe ser un número entre 1 y 720 horas"
  ),
  "seguridad.password_min_length": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 4 && n <= 32; },
    "Debe ser un número entre 4 y 32"
  ),
  "seguridad.password_requiere_mayuscula": z.string().regex(/^(true|false)$/),
  "seguridad.password_requiere_numero": z.string().regex(/^(true|false)$/),
  "seguridad.password_requiere_especial": z.string().regex(/^(true|false)$/),
  "seguridad.intentos_login_max": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 20; },
    "Debe ser un número entre 1 y 20"
  ),
  "seguridad.bloqueo_duracion_minutos": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 1440; },
    "Debe ser un número entre 1 y 1440 minutos"
  ),
  "seguridad.forzar_cambio_password_dias": z.string().refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 365; },
    "Debe ser un número entre 0 y 365 (0 = deshabilitado)"
  ),
});

// ─── Tipos derivados ─────────────────────────────────
export type GeneralConfigValues = z.infer<typeof generalConfigSchema>;
export type VacacionesConfigValues = z.infer<typeof vacacionesConfigSchema>;
export type NotificacionesConfigValues = z.infer<typeof notificacionesConfigSchema>;
export type DepartamentosConfigValues = z.infer<typeof departamentosConfigSchema>;
export type SeguridadConfigValues = z.infer<typeof seguridadConfigSchema>;

// ─── Legacy: mantener para compatibilidad con código existente ───
export const configuracionSchema = z.object({
  clave: z.string().min(1, "La clave es requerida"),
  valor: z.string().min(1, "El valor es requerido"),
  descripcion: z.string().optional(),
  categoria: z.string().min(1, "La categoría es requerida"),
  tipoDato: z.string().optional(),
  esPublico: z.boolean().optional(),
});

export type ConfiguracionFormValues = z.infer<typeof configuracionSchema>;
