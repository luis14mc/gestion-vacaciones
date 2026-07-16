import { describe, it, expect } from 'vitest';
import { getNavGroups } from '@/components/layout/AppShell';
import type { Session } from 'next-auth';

function session(overrides: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 1,
      email: 'u@cni.hn',
      name: 'User',
      nombre: 'Test',
      apellido: 'User',
      departamentoId: 1,
      esAdmin: false,
      esRrhh: false,
      esDirector: false,
      esJefe: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as unknown as Session;
}

function hrefs(navGroups: ReturnType<typeof getNavGroups>): string[] {
  return navGroups.flatMap((g) => g.items.map((i) => i.href));
}

describe('Sidebar nav — Fase 1 seguridad (jefe sin reportes)', () => {
  it('jefe NO ve Reportes, Exportar, Auditoría, Configuración ni Asignación de días', () => {
    const links = hrefs(getNavGroups(session({ esJefe: true })));
    expect(links).not.toContain('/reportes');
    expect(links).not.toContain('/reportes-departamento');
    expect(links).not.toContain('/exportar');
    expect(links).not.toContain('/auditoria');
    expect(links).not.toContain('/configuracion');
    expect(links).not.toContain('/asignacion-dias');
    expect(links).not.toContain('/rrhh/balances');
    // Sí ve su flujo operativo
    expect(links).toContain('/mi-equipo');
    expect(links).toContain('/aprobar-solicitudes');
    expect(links).toContain('/dashboard');
    expect(links).toContain('/mi-balance');
  });

  it('director NO ve Reportes, Exportar, Auditoría, Configuración ni Asignación de días', () => {
    const links = hrefs(getNavGroups(session({ esDirector: true })));
    expect(links).not.toContain('/reportes');
    expect(links).not.toContain('/reportes-departamento');
    expect(links).not.toContain('/exportar');
    expect(links).not.toContain('/auditoria');
    expect(links).not.toContain('/configuracion');
    expect(links).not.toContain('/asignacion-dias');
    expect(links).not.toContain('/rrhh/balances');
    // Sí ve su flujo operativo
    expect(links).toContain('/mi-equipo');
    expect(links).toContain('/aprobar-solicitudes');
  });

  it('RRHH SÍ ve Reportes, Exportar, Asignación de días (grupo Administración)', () => {
    const links = hrefs(getNavGroups(session({ esRrhh: true })));
    expect(links).toContain('/reportes');
    expect(links).toContain('/exportar');
    expect(links).toContain('/asignacion-dias');
    expect(links).toContain('/rrhh/balances');
    // NO ve auditoría (Admin-only)
    expect(links).not.toContain('/auditoria');
    expect(links).not.toContain('/configuracion');
  });

  it('Admin SÍ ve Reportes, Exportar, Auditoría, Configuración y Asignación de días', () => {
    const links = hrefs(getNavGroups(session({ esAdmin: true })));
    expect(links).toContain('/reportes');
    expect(links).toContain('/exportar');
    expect(links).toContain('/auditoria');
    expect(links).toContain('/configuracion');
    expect(links).toContain('/asignacion-dias');
    expect(links).toContain('/rrhh/balances');
  });

  it('empleado regular solo ve Dashboard, Solicitudes, Balance y Perfil', () => {
    const links = hrefs(getNavGroups(session({})));
    expect(links).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/solicitudes',
        '/solicitudes/nueva',
        '/mi-balance',
        '/mi-perfil',
      ])
    );
    expect(links).not.toContain('/reportes');
    expect(links).not.toContain('/reportes-departamento');
    expect(links).not.toContain('/exportar');
    expect(links).not.toContain('/auditoria');
    expect(links).not.toContain('/configuracion');
    expect(links).not.toContain('/asignacion-dias');
    expect(links).not.toContain('/rrhh/balances');
    expect(links).not.toContain('/aprobar-solicitudes');
    expect(links).not.toContain('/mi-equipo');
  });
});