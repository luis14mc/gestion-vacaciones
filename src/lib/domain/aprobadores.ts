/**
 * Resolución de aprobadores institucionales (Fase 2).
 *
 * Reglas CNI:
 *   - Empleado normal:
 *       pendiente_jefe -> pendiente_director (o pendiente_secretario_general)
 *       -> pendiente_rrhh -> aprobada_rrhh.
 *   - Jefe (no Director):
 *       pendiente_director (o pendiente_secretario_general) -> pendiente_rrhh.
 *   - Director: requiere VoBo Ministro; pasa directo a pendiente_rrhh.
 *   - Secretario General: requiere VoBo Ministro; pasa directo a
 *     pendiente_rrhh (no se autoaprueba).
 *
 * "Director disponible" (versión inicial):
 *   - existe
 *   - activo = true
 *   - deletedAt IS NULL
 *
 * Cuando se requiera cubrir la disponibilidad por vacaciones del Director,
 * el helper `estaUsuarioDisponible(usuarioId, fechaInicio, fechaFin)` se
 * puede extender para revisar solicitudes aprobadas_rrhh/finalizadas que
 * cubran el período. En esta primera versión solo se verifica
 * activo/deletedAt, suficiente para la regla institucional actual.
 */
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { SessionUser } from '@/types';

export type TipoAprobadorSegundoNivel = 'director' | 'secretario_general';

export type MotivoAprobadorSegundoNivel =
  | 'director_asignado'
  | 'sin_director'
  | 'director_no_disponible';

export interface AprobadorSegundoNivel {
  tipoAprobador: TipoAprobadorSegundoNivel;
  usuarioId: number;
  motivo: MotivoAprobadorSegundoNivel;
  /** Nombre humano (para mostrar en UI). Best-effort. */
  nombre?: string;
}

/**
 * Busca al Director de Área asociado al departamento del solicitante.
 * Usa el flag `esDirector` y la asignación `departamentos.jefeId`.
 * Devuelve null si no hay director activo disponible.
 */
export async function obtenerDirectorDeDepartamento(
  departamentoId: number | null | undefined
): Promise<{ id: number; nombre: string } | null> {
  if (!departamentoId) return null;

  // 1) Director del depto via departamentos.jefeId (preferente).
  const [depto] = await db
    .select({ jefeId: departamentos.jefeId })
    .from(departamentos)
    .where(and(eq(departamentos.id, departamentoId), isNull(departamentos.deletedAt)))
    .limit(1);

  if (depto?.jefeId) {
    const dir = await buscarUsuarioDirectorActivo(depto.jefeId);
    if (dir) return dir;
  }

  // 2) Fallback: cualquier usuario con esDirector=true en ese departamento
  //    y activo (cubre desalineamientos histórico ↔ depto.jefeId).
  const [fallback] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, apellido: usuarios.apellido })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.departamentoId, departamentoId),
        eq(usuarios.esDirector, true),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      )
    )
    .limit(1);

  if (!fallback) return null;
  return { id: fallback.id, nombre: `${fallback.nombre} ${fallback.apellido}`.trim() };
}

async function buscarUsuarioDirectorActivo(
  usuarioId: number
): Promise<{ id: number; nombre: string } | null> {
  const [row] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      esDirector: usuarios.esDirector,
      activo: usuarios.activo,
      deletedAt: usuarios.deletedAt,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!row || !row.esDirector || !row.activo || row.deletedAt) return null;
  return { id: row.id, nombre: `${row.nombre} ${row.apellido}`.trim() };
}

/**
 * Busca al Secretario General activo (debe existir máximo uno).
 * Lanza error controlado si hay más de uno activo para forzar limpieza
 * administrativa, en lugar de elegir uno arbitrariamente.
 */
export async function obtenerSecretarioGeneral(): Promise<{
  id: number;
  nombre: string;
} | null> {
  const rows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
    })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.esSecretarioGeneral, true),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      )
    );

  if (rows.length === 0) return null;

  if (rows.length > 1) {
    // Política CNI: solo puede haber un Secretario General activo.
    // Lanzar evita selección arbitraria; el llamador decide cómo
    // manejarlo (error al crear solicitud + auditoría).
    throw new Error(
      `Hay ${rows.length} Secretarios Generales activos. Debe existir máximo uno.`
    );
  }

  const r = rows[0];
  if (!r) return null;
  return { id: r.id, nombre: `${r.nombre} ${r.apellido}`.trim() };
}

/**
 * Determina si un usuario está disponible para aprobar en una fecha dada.
 * Versión inicial: solo verifica activo/deletedAt.
 * Punto de extensión: cruzar con solicitudes aprobadas que cubran el rango.
 */
export async function estaUsuarioDisponible(
  usuarioId: number,
  _fechaInicio?: string | null,
  _fechaFin?: string | null
): Promise<boolean> {
  const [u] = await db
    .select({ activo: usuarios.activo, deletedAt: usuarios.deletedAt })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!u) return false;
  if (!u.activo) return false;
  if (u.deletedAt) return false;
  return true;
}

/**
 * Resuelve quién es el aprobador de segundo nivel para una solicitud nueva
 * del empleado solicitante. Devuelve el tipo y usuarioId concreto.
 *
 * Reglas:
 *   1. Si hay Director activo en el departamento del solicitante →
 *      tipo='director', motivo='director_asignado'.
 *   2. Si no hay Director activo → busca Secretario General →
 *      tipo='secretario_general', motivo='sin_director'.
 *      Si tampoco hay SG configurado → lanza error con mensaje claro.
 *
 * Si el solicitante es el propio Director, su aprobador de segundo nivel
 * sigue siendo RRHH (no entra a esta lógica): ver
 * `resolverFlujoSolicitante()` en solicitud-flujo-aprobacion.ts.
 */
export async function resolverAprobadorSegundoNivel(input: {
  departamentoId: number | null | undefined;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}): Promise<AprobadorSegundoNivel> {
  const director = await obtenerDirectorDeDepartamento(input.departamentoId);

  if (director) {
    const disponible = await estaUsuarioDisponible(director.id, input.fechaInicio, input.fechaFin);
    if (disponible) {
      return {
        tipoAprobador: 'director',
        usuarioId: director.id,
        motivo: 'director_asignado',
        nombre: director.nombre,
      };
    }

    // Director existe pero no disponible; cae a Secretario General.
    const sg = await obtenerSecretarioGeneral();
    if (!sg) {
      throw new Error(
        'El Director del departamento no está disponible y no hay Secretario General configurado para aprobación sustituta.'
      );
    }
    return {
      tipoAprobador: 'secretario_general',
      usuarioId: sg.id,
      motivo: 'director_no_disponible',
      nombre: sg.nombre,
    };
  }

  // Sin Director: cae a Secretario General.
  const sg = await obtenerSecretarioGeneral();
  if (!sg) {
    throw new Error(
      'No hay Director de Área asignado al departamento ni Secretario General configurado para aprobación sustituta.'
    );
  }
  return {
    tipoAprobador: 'secretario_general',
    usuarioId: sg.id,
    motivo: 'sin_director',
    nombre: sg.nombre,
  };
}

/**
 * Helper para cargar Secretario General desde sesión (modo cache de proceso).
 * Si la sesión es del propio Secretario General, devuelve sus datos.
 */
export function esSecretarioGeneral(user: SessionUser | null | undefined): boolean {
  return Boolean(user?.esSecretarioGeneral);
}

/**
 * Para uso en bandejas: ¿el usuario es aprobador sustituto (Secretario General)?
 */
export function usuarioEsSecretarioGeneralActivo(user: SessionUser | null | undefined): boolean {
  return esSecretarioGeneral(user);
}