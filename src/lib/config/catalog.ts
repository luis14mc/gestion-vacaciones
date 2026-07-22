/**
 * ============================================================
 * CATÁLOGO DE CONFIGURACIÓN (fuente única de verdad)
 * ============================================================
 * Define las claves de configuración VÁLIDAS del sistema, su categoría,
 * tipo de dato, visibilidad (esPublico) y el validador Zod de su valor.
 *
 * Antes:
 *  - El PATCH de /api/configuracion no validaba nada (los schemas Zod
 *    de configuracion.schema.ts eran código muerto): un admin podía
 *    escribir cualquier clave con cualquier valor.
 *  - Solo las claves SMTP tenían metadata correcta; el resto se guardaba
 *    como categoria 'general' / esPublico false, rompiendo el filtrado
 *    por visibilidad y el render del cliente.
 *
 * Ahora este catálogo es la autoridad: claves desconocidas se rechazan,
 * los valores se validan con los schemas Zod existentes y la metadata
 * (categoria/tipoDato/esPublico) se deriva de forma consistente.
 * ============================================================
 */

import {
  generalConfigSchema,
  vacacionesConfigSchema,
  notificacionesConfigSchema,
  departamentosConfigSchema,
  seguridadConfigSchema,
} from '@/lib/schemas/configuracion.schema';
import type { ZodTypeAny } from 'zod';

// Validadores por clave, reutilizando los schemas Zod ya definidos.
export const CONFIG_FIELD_SCHEMAS: Record<string, ZodTypeAny> = {
  ...(generalConfigSchema.shape as Record<string, ZodTypeAny>),
  ...(vacacionesConfigSchema.shape as Record<string, ZodTypeAny>),
  ...(notificacionesConfigSchema.shape as Record<string, ZodTypeAny>),
  ...(departamentosConfigSchema.shape as Record<string, ZodTypeAny>),
  ...(seguridadConfigSchema.shape as Record<string, ZodTypeAny>),
};

// Conjunto de claves válidas del sistema.
export const CONFIG_KEYS = new Set(Object.keys(CONFIG_FIELD_SCHEMAS));

/** Claves legacy retiradas del catálogo (solo para limpieza idempotente en seed/SQL). */
export const LEGACY_CONFIG_KEYS = [
  'departamentos.jefe_auto_aprobar',
  'departamentos.jefe_puede_auto_aprobar',
  'flujo.jefe_auto_aprobar',
  'jefe_auto_aprobar',
  'jefe_puede_auto_aprobar',
  'vacaciones.acumulacion_habilitada',
  'vacaciones.max_acumulacion',
] as const;

/** Excluye claves desconocidas o legacy del payload hacia el cliente. */
export function filtrarConfigCatalogo<T extends { clave: string }>(items: T[]): T[] {
  return items.filter((item) => CONFIG_KEYS.has(item.clave));
}

// Clasificación de tipos de dato (para metadata y render del cliente).
const BOOLEAN_KEYS = new Set([
  'app.mantenimiento',
  'vacaciones.permitir_medio_dia',
  'notificaciones.email_habilitado',
  'notificaciones.smtp_secure',
  'notificaciones.smtp_require_tls',
  'notificaciones.smtp_reject_unauthorized',
  'notificaciones.notificar_jefe_nueva_solicitud',
  'notificaciones.notificar_empleado_aprobacion',
  'notificaciones.notificar_empleado_rechazo',
  'notificaciones.notificar_rrhh_aprobacion_jefe',
  'departamentos.validar_conflictos',
  'departamentos.mostrar_calendario_equipo',
  'seguridad.password_requiere_mayuscula',
  'seguridad.password_requiere_numero',
  'seguridad.password_requiere_especial',
]);

const NUMBER_KEYS = new Set([
  'vacaciones.dias_anuales_default',
  'vacaciones.dias_minimos_solicitud',
  'vacaciones.dias_maximos_consecutivos',
  'vacaciones.dias_anticipacion',
  'notificaciones.smtp_port',
  'notificaciones.recordatorio_dias_antes',
  'departamentos.max_ausencias_simultaneas',
  'departamentos.porcentaje_max_ausentes',
  'seguridad.sesion_duracion_horas',
  'seguridad.password_min_length',
  'seguridad.intentos_login_max',
  'seguridad.bloqueo_duracion_minutos',
  'seguridad.forzar_cambio_password_dias',
]);

function inferirTipoDato(clave: string): string {
  if (clave.endsWith('password')) return 'password';
  if (clave === 'notificaciones.email_remitente') return 'email';
  if (BOOLEAN_KEYS.has(clave)) return 'boolean';
  if (NUMBER_KEYS.has(clave)) return 'number';
  return 'string';
}

// Visibilidad: las claves de identidad de la app y las reglas de
// vacaciones son públicas (empleados pueden necesitarlas); notificaciones
// (incluye secretos SMTP), seguridad y reglas de departamento son privadas.
function inferirEsPublico(categoria: string): boolean {
  return categoria === 'general' || categoria === 'vacaciones';
}

/**
 * Valores por defecto cuando la clave no existe en BD.
 * Debe incluir todas las claves válidas de CONFIG_KEYS.
 */
export const CONFIG_DEFAULT_VALUES: Record<string, string> = {
  // General
  'app.nombre': 'Sistema de Vacaciones CNI',
  'app.version': '1.0.0',
  'app.empresa': 'Consejo Nacional de Inversiones',
  'app.siglas': 'CNI',
  'app.pais': 'Honduras',
  'app.timezone': 'America/Tegucigalpa',
  'app.idioma': 'es',
  'app.mantenimiento': 'false',

  // Vacaciones
  'vacaciones.dias_anuales_default': '10',
  'vacaciones.dias_minimos_solicitud': '1',
  'vacaciones.dias_maximos_consecutivos': '30',
  'vacaciones.dias_anticipacion': '2',
  'vacaciones.permitir_medio_dia': 'true',

  // Notificaciones (sin secretos reales)
  'notificaciones.email_habilitado': 'false',
  'notificaciones.email_remitente': 'noreply@cni.hn',
  'notificaciones.smtp_host': 'smtp.office365.com',
  'notificaciones.smtp_port': '587',
  'notificaciones.smtp_user': '',
  'notificaciones.smtp_password': '',
  'notificaciones.smtp_secure': 'false',
  'notificaciones.smtp_require_tls': 'true',
  'notificaciones.smtp_reject_unauthorized': 'true',
  'notificaciones.notificar_jefe_nueva_solicitud': 'true',
  'notificaciones.notificar_empleado_aprobacion': 'true',
  'notificaciones.notificar_empleado_rechazo': 'true',
  'notificaciones.notificar_rrhh_aprobacion_jefe': 'true',
  'notificaciones.recordatorio_dias_antes': '2',

  // Departamentos
  'departamentos.max_ausencias_simultaneas': '3',
  'departamentos.porcentaje_max_ausentes': '30',
  'departamentos.validar_conflictos': 'true',
  'departamentos.mostrar_calendario_equipo': 'true',

  // Seguridad
  'seguridad.sesion_duracion_horas': '24',
  'seguridad.password_min_length': '8',
  'seguridad.password_requiere_mayuscula': 'false',
  'seguridad.password_requiere_numero': 'false',
  'seguridad.password_requiere_especial': 'false',
  'seguridad.intentos_login_max': '5',
  'seguridad.bloqueo_duracion_minutos': '15',
  'seguridad.forzar_cambio_password_dias': '0',
};

/** Verifica que el catálogo tenga default para cada clave válida. */
export function clavesSinDefaultEnCatalogo(): string[] {
  return [...CONFIG_KEYS].filter((clave) => CONFIG_DEFAULT_VALUES[clave] === undefined);
}

export interface ConfigMeta {
  categoria: string;
  tipoDato: string;
  esPublico: boolean;
}

export function getConfigMeta(clave: string): ConfigMeta {
  // El prefijo 'app' pertenece a la categoría 'general'.
  const prefijo = clave.split('.')[0] ?? 'general';
  const categoria = prefijo === 'app' ? 'general' : prefijo;
  return {
    categoria,
    tipoDato: inferirTipoDato(clave),
    esPublico: inferirEsPublico(categoria),
  };
}

/**
 * Valida una clave y su valor contra el catálogo.
 * @returns null si es válido; un mensaje de error si no.
 */
export function validarConfig(clave: string, valor: unknown): string | null {
  const fieldSchema = CONFIG_FIELD_SCHEMAS[clave];
  if (!fieldSchema) {
    return `Clave de configuración desconocida: ${clave}`;
  }
  const result = fieldSchema.safeParse(valor);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'valor inválido';
    return `Valor inválido para ${clave}: ${msg}`;
  }
  return null;
}
