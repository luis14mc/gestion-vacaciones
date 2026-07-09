/**
 * Acceso al dashboard operativo de jefe/director y a balances de empleados.
 *
 * Política CNI (Fase 1 — Seguridad de jefes):
 *   - Jefe/Director solo ven sus empleados y aprueban/rechazan solicitudes.
 *   - NO deben ver balances (días disponibles, usados, vencidos, proporcionales,
 *     asignados, pendientes) ni acumulación de vacaciones de sus empleados.
 *   - Sí pueden ver su propio balance personal.
 *   - RRHH/Admin conservan visibilidad completa.
 */
import type { SessionUser } from '@/types';
import { resolverIdsEquipo } from '@/lib/domain/equipo-jefe';

/**
 * Roles habilitados para el dashboard operativo de jefe.
 * Admin y RRHH también pueden entrar (visibilidad organizacional).
 */
export function puedeAccederMetricasJefe(user: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(user.esAdmin || user.esRrhh || user.esDirector || user.esJefe);
}

/**
 * Devuelve true si el usuario puede consultar el balance del empleado objetivo.
 *
 * Reglas:
 *   - RRHH/Admin: siempre.
 *   - Propio empleado: siempre.
 *   - Jefe/Director: solo si el objetivo pertenece a su equipo (jefeSuperiorId)
 *     o, como Director, a su mismo departamento (excluyéndose a sí mismo).
 *   - Cualquier otro caso: false.
 */
export async function puedeVerBalanceEmpleado(
  user: SessionUser | null,
  targetUsuarioId: number
): Promise<boolean> {
  if (!user) return false;
  if (user.esAdmin || user.esRrhh) return true;
  if (user.id === targetUsuarioId) return true;
  if (!user.esJefe && !user.esDirector) return false;

  const equipoIds = await resolverIdsEquipo({
    jefeId: user.id,
    esDirector: user.esDirector,
    departamentoId: user.departamentoId,
  });
  return equipoIds.includes(targetUsuarioId);
}

/**
 * Devuelve true si el usuario es jefe/director (NO admin/rrhh) y por lo tanto
 * el frontend/API deben ocultar balances y métricas de días del equipo.
 */
export function esJefeSinVisibilidadCompleta(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.esAdmin || user.esRrhh) return false;
  return Boolean(user.esJefe || user.esDirector);
}