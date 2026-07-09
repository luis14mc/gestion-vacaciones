import type { SessionUser } from '@/types';

function tienePermisoLocal(user: SessionUser, permiso: string): boolean {
  if (user.esAdmin) return true;
  return user.permisos.includes(permiso);
}

/**
 * Política CNI (Fase 1 — Seguridad de jefes):
 *   - Los jefes solo pueden ver qué empleados tienen bajo su cargo y
 *     aprobar/rechazar solicitudes.
 *   - NO deben ver balances de días de sus empleados ni reportes
 *     institucionales / departamentales.
 *
 * Por lo tanto:
 *   - Reportes institucionales (`/reportes`, `/api/reportes`, `/api/reportes/*`)
 *     quedan restringidos a Admin (siempre) y RRHH (con permiso).
 *   - Jefe / Director NO tienen acceso a reportes.
 */
export function puedeVerReportes(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  if (user.esRrhh) return tienePermisoLocal(user, 'reportes.exportar');
  // Jefe/Director y Empleado NO ven reportes institucionales.
  return false;
}

/**
 * Exportar reportes (`/api/reportes/exportar`, `/exportar`):
 *   - Admin: siempre.
 *   - RRHH: requiere permiso `reportes.exportar`.
 *   - Jefe / Director: NO exportan reportes institucionales.
 */
export function puedeExportarReportes(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  if (user.esRrhh) return tienePermisoLocal(user, 'reportes.exportar');
  return false;
}

/**
 * Reportes departamentales (`/reportes-departamento`, `/api/reportes/departamento`):
 *   - Admin: siempre.
 *   - RRHH: siempre (gestión organizacional).
 *   - Jefe / Director: NO. La vista operativa del equipo ya está cubierta
 *     por el Dashboard de jefe y la bandeja de aprobación de solicitudes.
 */
export function puedeVerReporteDepartamento(user: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(user.esAdmin || user.esRrhh);
}

export function esAlcanceOrganizacional(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.esAdmin || user.esRrhh;
}