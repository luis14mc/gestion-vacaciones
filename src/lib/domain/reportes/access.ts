import type { SessionUser } from '@/types';

function tienePermisoLocal(user: SessionUser, permiso: string): boolean {
  if (user.esAdmin) return true;
  return user.permisos.includes(permiso);
}

export function puedeVerReportes(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.esAdmin || user.esRrhh) return true;
  if (user.esJefe || user.esDirector) {
    return tienePermisoLocal(user, 'reportes.departamento');
  }
  return tienePermisoLocal(user, 'reportes.exportar');
}

export function puedeExportarReportes(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.esAdmin) return true;
  if (user.esRrhh) return tienePermisoLocal(user, 'reportes.exportar');
  if (user.esJefe || user.esDirector) {
    return tienePermisoLocal(user, 'reportes.departamento');
  }
  return false;
}

export function esAlcanceOrganizacional(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.esAdmin || user.esRrhh;
}
