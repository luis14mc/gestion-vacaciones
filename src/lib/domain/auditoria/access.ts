/** Acceso a auditoría: solo ADMIN (RRHH no tiene bitácora global por política CNI). */

import type { SessionUser } from '@/types';

export function puedeVerAuditoria(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.esAdmin;
}

export function puedeExportarAuditoria(user: SessionUser | null): boolean {
  return puedeVerAuditoria(user);
}
