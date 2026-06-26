import { describe, expect, it } from 'vitest';
import { puedeVerReportes, puedeExportarReportes } from '@/lib/domain/reportes/access';
import type { SessionUser } from '@/types';

function session(partial: Partial<SessionUser>): SessionUser {
  return {
    id: 1,
    email: 'test@cni.hn',
    nombre: 'Test',
    apellido: 'User',
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

describe('reportes access', () => {
  it('admin y RRHH pueden ver y exportar', () => {
    expect(puedeVerReportes(session({ esAdmin: true }))).toBe(true);
    expect(puedeExportarReportes(session({ esAdmin: true }))).toBe(true);
    expect(puedeVerReportes(session({ esRrhh: true, permisos: ['reportes.exportar'] }))).toBe(true);
  });

  it('jefe/director requieren reportes.departamento', () => {
    const jefeSinPermiso = session({ esJefe: true });
    expect(puedeVerReportes(jefeSinPermiso)).toBe(false);

    const jefe = session({ esJefe: true, permisos: ['reportes.departamento'] });
    expect(puedeVerReportes(jefe)).toBe(true);
    expect(puedeExportarReportes(jefe)).toBe(true);
  });

  it('empleado no accede a reportes generales', () => {
    expect(puedeVerReportes(session({ permisos: ['balances.ver_propio'] }))).toBe(false);
  });
});
