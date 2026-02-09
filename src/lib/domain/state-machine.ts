/**
 * ============================================================
 * STATE MACHINE - Solicitudes CNI
 * ============================================================
 * @description Máquina de estados pura (sin dependencias de BD)
 *   Define transiciones válidas, guards y side-effect descriptors.
 *   Principio: Domain Logic ≠ Infrastructure
 * @version 1.0
 * ============================================================
 */

import type { EstadoSolicitud } from '@/types';

// =====================================================
// TIPOS DEL DOMINIO
// =====================================================

/** Acciones que disparan transiciones */
export type AccionSolicitud =
  | 'enviar'
  | 'aprobar_jefe'
  | 'rechazar_jefe'
  | 'aprobar_rrhh'
  | 'rechazar_rrhh'
  | 'aprobar_ejecutiva'
  | 'rechazar_ejecutiva'
  | 'cancelar'
  | 'iniciar_uso'
  | 'finalizar';

/** Contexto mínimo para evaluar guards */
export interface TransicionContexto {
  usuarioId: number;
  solicitanteId: number;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  tipo: string;
}

/** Side-effect que el servicio debe ejecutar tras transición */
export type EfectoLateral =
  | { tipo: 'RESERVAR_BALANCE'; dias: number }
  | { tipo: 'CONFIRMAR_BALANCE'; dias: number }
  | { tipo: 'LIBERAR_BALANCE'; dias: number }
  | { tipo: 'REGISTRAR_HISTORIAL'; movimiento: string }
  | { tipo: 'NOTIFICAR'; destinatario: 'solicitante' | 'jefe' | 'rrhh'; mensaje: string };

/** Definición de una transición */
interface Transicion {
  desde: EstadoSolicitud;
  hacia: EstadoSolicitud;
  accion: AccionSolicitud;
  guard?: (ctx: TransicionContexto) => string | null; // null = OK, string = error
  efectos: (ctx: TransicionContexto, dias: number) => EfectoLateral[];
}

/** Resultado de intentar una transición */
export interface ResultadoTransicion {
  exito: boolean;
  estadoAnterior: EstadoSolicitud;
  estadoNuevo: EstadoSolicitud;
  efectos: EfectoLateral[];
  error?: string;
}

// =====================================================
// GUARDS (pure functions)
// =====================================================

const guardEsJefe = (ctx: TransicionContexto): string | null =>
  ctx.esJefe || ctx.esAdmin ? null : 'Solo el jefe de departamento puede realizar esta acción';

const guardEsRrhh = (ctx: TransicionContexto): string | null =>
  ctx.esRrhh || ctx.esAdmin ? null : 'Solo RRHH puede realizar esta acción';

const guardEsAdmin = (ctx: TransicionContexto): string | null =>
  ctx.esAdmin ? null : 'Solo administradores pueden realizar esta acción';

const guardEsSolicitante = (ctx: TransicionContexto): string | null =>
  ctx.usuarioId === ctx.solicitanteId || ctx.esAdmin
    ? null
    : 'Solo el solicitante puede cancelar su solicitud';

const guardPuedeCancelar = (ctx: TransicionContexto): string | null => {
  if (ctx.usuarioId === ctx.solicitanteId || ctx.esAdmin || ctx.esRrhh) return null;
  return 'No tiene permisos para cancelar esta solicitud';
};

// =====================================================
// TABLA DE TRANSICIONES
// =====================================================

const TRANSICIONES: Transicion[] = [
  // ── Envío ──
  {
    desde: 'borrador',
    hacia: 'pendiente_jefe',
    accion: 'enviar',
    guard: guardEsSolicitante,
    efectos: (_ctx, dias) => [
      { tipo: 'RESERVAR_BALANCE', dias },
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'debito_solicitud' },
      { tipo: 'NOTIFICAR', destinatario: 'jefe', mensaje: 'Nueva solicitud pendiente de aprobación' },
    ],
  },

  // ── Aprobación Jefe ──
  {
    desde: 'pendiente_jefe',
    hacia: 'aprobada_jefe',
    accion: 'aprobar_jefe',
    guard: guardEsJefe,
    efectos: () => [
      { tipo: 'NOTIFICAR', destinatario: 'rrhh', mensaje: 'Solicitud aprobada por jefe, pendiente revisión RRHH' },
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue aprobada por tu jefe' },
    ],
  },

  // ── Rechazo Jefe ──
  {
    desde: 'pendiente_jefe',
    hacia: 'rechazada_jefe',
    accion: 'rechazar_jefe',
    guard: guardEsJefe,
    efectos: (_ctx, dias) => [
      { tipo: 'LIBERAR_BALANCE', dias },
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'credito_devolucion' },
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue rechazada por tu jefe' },
    ],
  },

  // ── Aprobación RRHH ──
  {
    desde: 'aprobada_jefe',
    hacia: 'aprobada_rrhh',
    accion: 'aprobar_rrhh',
    guard: guardEsRrhh,
    efectos: (_ctx, dias) => [
      { tipo: 'CONFIRMAR_BALANCE', dias },
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'debito_solicitud' },
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue aprobada por RRHH' },
    ],
  },

  // ── Rechazo RRHH ──
  {
    desde: 'aprobada_jefe',
    hacia: 'rechazada_rrhh',
    accion: 'rechazar_rrhh',
    guard: guardEsRrhh,
    efectos: (_ctx, dias) => [
      { tipo: 'LIBERAR_BALANCE', dias },
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'credito_devolucion' },
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue rechazada por RRHH' },
    ],
  },

  // ── Aprobación Ejecutiva (opcional, para montos grandes) ──
  {
    desde: 'aprobada_rrhh',
    hacia: 'aprobada_ejecutiva',
    accion: 'aprobar_ejecutiva',
    guard: guardEsAdmin,
    efectos: () => [
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud recibió autorización ejecutiva' },
    ],
  },

  // ── Rechazo Ejecutiva ──
  {
    desde: 'aprobada_rrhh',
    hacia: 'rechazada_ejecutiva',
    accion: 'rechazar_ejecutiva',
    guard: guardEsAdmin,
    efectos: (_ctx, dias) => [
      { tipo: 'LIBERAR_BALANCE', dias },
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'credito_devolucion' },
      { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue rechazada por la dirección ejecutiva' },
    ],
  },

  // ── Cancelación (desde estados pendientes o aprobados) ──
  ...[
    'pendiente_jefe',
    'aprobada_jefe',
    'aprobada_rrhh',
    'aprobada_ejecutiva',
  ].map(
    (estado): Transicion => ({
      desde: estado as EstadoSolicitud,
      hacia: 'cancelada',
      accion: 'cancelar',
      guard: guardPuedeCancelar,
      efectos: (_ctx, dias) => {
        const efectos: EfectoLateral[] = [
          { tipo: 'LIBERAR_BALANCE', dias },
          { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'credito_devolucion' },
          { tipo: 'NOTIFICAR', destinatario: 'solicitante', mensaje: 'Tu solicitud fue cancelada' },
        ];
        // Si ya estaba aprobada por RRHH, notificar a RRHH
        if (['aprobada_rrhh', 'aprobada_ejecutiva'].includes(estado)) {
          efectos.push({
            tipo: 'NOTIFICAR',
            destinatario: 'rrhh',
            mensaje: 'Una solicitud aprobada fue cancelada',
          });
        }
        return efectos;
      },
    })
  ),

  // ── Transiciones automáticas (cron) ──
  {
    desde: 'aprobada_rrhh',
    hacia: 'finalizada',
    accion: 'iniciar_uso',
    efectos: () => [
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'debito_solicitud' },
    ],
  },
  {
    desde: 'aprobada_ejecutiva',
    hacia: 'finalizada',
    accion: 'iniciar_uso',
    efectos: () => [
      { tipo: 'REGISTRAR_HISTORIAL', movimiento: 'debito_solicitud' },
    ],
  },
];

// =====================================================
// API PÚBLICA
// =====================================================

/**
 * Obtener transiciones válidas desde un estado
 */
export function obtenerAccionesDisponibles(estado: EstadoSolicitud): AccionSolicitud[] {
  return [
    ...new Set(
      TRANSICIONES.filter((t) => t.desde === estado).map((t) => t.accion)
    ),
  ];
}

/**
 * Intentar una transición de estado.
 * Pure function: no toca BD, solo valida y retorna resultado.
 */
export function transicionar(
  estadoActual: EstadoSolicitud,
  accion: AccionSolicitud,
  contexto: TransicionContexto,
  diasSolicitados: number = 0
): ResultadoTransicion {
  const transicion = TRANSICIONES.find(
    (t) => t.desde === estadoActual && t.accion === accion
  );

  if (!transicion) {
    return {
      exito: false,
      estadoAnterior: estadoActual,
      estadoNuevo: estadoActual,
      efectos: [],
      error: `Transición inválida: no se puede ejecutar "${accion}" desde estado "${estadoActual}"`,
    };
  }

  // Evaluar guard
  if (transicion.guard) {
    const error = transicion.guard(contexto);
    if (error) {
      return {
        exito: false,
        estadoAnterior: estadoActual,
        estadoNuevo: estadoActual,
        efectos: [],
        error,
      };
    }
  }

  // Calcular efectos laterales
  const efectos = transicion.efectos(contexto, diasSolicitados);

  return {
    exito: true,
    estadoAnterior: estadoActual,
    estadoNuevo: transicion.hacia,
    efectos,
  };
}

/**
 * Verificar si una transición es válida sin ejecutarla
 */
export function puedeTransicionar(
  estadoActual: EstadoSolicitud,
  accion: AccionSolicitud,
  contexto: TransicionContexto
): { valido: boolean; error?: string } {
  const transicion = TRANSICIONES.find(
    (t) => t.desde === estadoActual && t.accion === accion
  );

  if (!transicion) {
    return { valido: false, error: `Transición "${accion}" no disponible desde "${estadoActual}"` };
  }

  if (transicion.guard) {
    const error = transicion.guard(contexto);
    if (error) return { valido: false, error };
  }

  return { valido: true };
}

/**
 * Obtener mapa visual de transiciones (para documentación / UI)
 */
export function obtenerMapaTransiciones(): Array<{
  desde: EstadoSolicitud;
  hacia: EstadoSolicitud;
  accion: AccionSolicitud;
}> {
  return TRANSICIONES.map(({ desde, hacia, accion }) => ({ desde, hacia, accion }));
}

// =====================================================
// CONFIGURACIÓN DE ESTADOS
// =====================================================

export const ESTADOS_CONFIG: Record<
  EstadoSolicitud,
  {
    label: string;
    color: string;       // Tailwind color class
    bgColor: string;     // Badge background
    textColor: string;   // Badge text
    icon: string;        // Emoji for quick display
    esFinal: boolean;
  }
> = {
  borrador:             { label: 'Borrador',              color: 'gray',    bgColor: 'bg-gray-100',    textColor: 'text-gray-700',    icon: '📝', esFinal: false },
  pendiente_jefe:       { label: 'Pendiente Jefe',        color: 'yellow',  bgColor: 'bg-yellow-100',  textColor: 'text-yellow-800',  icon: '⏳', esFinal: false },
  aprobada_jefe:        { label: 'Aprobada por Jefe',     color: 'blue',    bgColor: 'bg-blue-100',    textColor: 'text-blue-800',    icon: '✅', esFinal: false },
  rechazada_jefe:       { label: 'Rechazada por Jefe',    color: 'red',     bgColor: 'bg-red-100',     textColor: 'text-red-700',     icon: '❌', esFinal: true },
  pendiente_rrhh:       { label: 'Pendiente RRHH',        color: 'orange',  bgColor: 'bg-orange-100',  textColor: 'text-orange-800',  icon: '⏳', esFinal: false },
  aprobada_rrhh:        { label: 'Aprobada por RRHH',     color: 'green',   bgColor: 'bg-green-100',   textColor: 'text-green-800',   icon: '✅', esFinal: false },
  rechazada_rrhh:       { label: 'Rechazada por RRHH',    color: 'red',     bgColor: 'bg-red-100',     textColor: 'text-red-700',     icon: '❌', esFinal: true },
  pendiente_ejecutiva:  { label: 'Pendiente Ejecutiva',   color: 'purple',  bgColor: 'bg-purple-100',  textColor: 'text-purple-800',  icon: '⏳', esFinal: false },
  aprobada_ejecutiva:   { label: 'Autorizada',            color: 'emerald', bgColor: 'bg-emerald-100', textColor: 'text-emerald-800', icon: '✅', esFinal: false },
  rechazada_ejecutiva:  { label: 'Rechazada Ejecutiva',   color: 'red',     bgColor: 'bg-red-100',     textColor: 'text-red-700',     icon: '❌', esFinal: true },
  cancelada:            { label: 'Cancelada',             color: 'gray',    bgColor: 'bg-gray-100',    textColor: 'text-gray-600',    icon: '🚫', esFinal: true },
  finalizada:           { label: 'Finalizada',            color: 'teal',    bgColor: 'bg-teal-100',    textColor: 'text-teal-800',    icon: '✔️', esFinal: true },
};
