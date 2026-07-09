import { describe, expect, it } from 'vitest';
import {
  puedeVerReportes,
  puedeExportarReportes,
  puedeVerReporteDepartamento,
} from '@/lib/domain/reportes/access';
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

describe('reportes access — Fase 1 seguridad (solo Admin/RRHH)', () => {
  it('admin y RRHH pueden ver y exportar reportes', () => {
    expect(puedeVerReportes(session({ esAdmin: true }))).toBe(true);
    expect(puedeExportarReportes(session({ esAdmin: true }))).toBe(true);
    expect(puedeVerReporteDepartamento(session({ esAdmin: true }))).toBe(true);

    expect(puedeVerReportes(session({ esRrhh: true, permisos: ['reportes.exportar'] }))).toBe(true);
    expect(puedeExportarReportes(session({ esRrhh: true, permisos: ['reportes.exportar'] }))).toBe(true);
    expect(puedeVerReporteDepartamento(session({ esRrhh: true }))).toBe(true);
  });

  it('jefe y director NO pueden ver ni exportar reportes (incluso con permiso)', () => {
    const jefeConPermiso = session({
      esJefe: true,
      permisos: ['reportes.departamento', 'reportes.exportar'],
    });
    expect(puedeVerReportes(jefeConPermiso)).toBe(false);
    expect(puedeExportarReportes(jefeConPermiso)).toBe(false);
    expect(puedeVerReporteDepartamento(jefeConPermiso)).toBe(false);

    const directorConPermiso = session({
      esDirector: true,
      permisos: ['reportes.departamento', 'reportes.exportar'],
    });
    expect(puedeVerReportes(directorConPermiso)).toBe(false);
    expect(puedeExportarReportes(directorConPermiso)).toBe(false);
    expect(puedeVerReporteDepartamento(directorConPermiso)).toBe(false);
  });

  it('jefe sin permisos tampoco ve reportes', () => {
    const jefe = session({ esJefe: true });
    expect(puedeVerReportes(jefe)).toBe(false);
    expect(puedeExportarReportes(jefe)).toBe(false);
    expect(puedeVerReporteDepartamento(jefe)).toBe(false);
  });

  it('director sin permisos tampoco ve reportes', () => {
    const director = session({ esDirector: true });
    expect(puedeVerReportes(director)).toBe(false);
    expect(puedeExportarReportes(director)).toBe(false);
    expect(puedeVerReporteDepartamento(director)).toBe(false);
  });

  it('empleado regular NO accede a reportes', () => {
    expect(puedeVerReportes(session({ permisos: ['balances.ver_propio'] }))).toBe(false);
    expect(puedeExportarReportes(session({}))).toBe(false);
    expect(puedeVerReporteDepartamento(session({}))).toBe(false);
  });

  it('null nunca accede a reportes', () => {
    expect(puedeVerReportes(null)).toBe(false);
    expect(puedeExportarReportes(null)).toBe(false);
    expect(puedeVerReporteDepartamento(null)).toBe(false);
  });
});