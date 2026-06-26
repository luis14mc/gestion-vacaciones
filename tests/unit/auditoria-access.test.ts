import { describe, expect, it } from 'vitest';
import { puedeVerAuditoria, puedeExportarAuditoria } from '@/lib/domain/auditoria/access';
import type { SessionUser } from '@/types';

function session(partial: Partial<SessionUser>): SessionUser {
  return {
    id: 1,
    email: 'admin@cni.hn',
    nombre: 'Admin',
    apellido: 'CNI',
    roles: [],
    permisos: [],
    esAdmin: false,
    esRrhh: false,
    esDirector: false,
    esJefe: false,
    debeCambiarPassword: false,
    ...partial,
  };
}

describe('auditoria access', () => {
  it('solo ADMIN puede ver auditoría global', () => {
    expect(puedeVerAuditoria(session({ esAdmin: true }))).toBe(true);
    expect(puedeVerAuditoria(session({ esRrhh: true }))).toBe(false);
    expect(puedeVerAuditoria(session({ esJefe: true }))).toBe(false);
    expect(puedeVerAuditoria(null)).toBe(false);
  });

  it('exportación requiere mismo acceso que consulta', () => {
    expect(puedeExportarAuditoria(session({ esAdmin: true }))).toBe(true);
    expect(puedeExportarAuditoria(session({ esRrhh: true }))).toBe(false);
  });
});
