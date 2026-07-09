import { describe, it, expect, vi } from 'vitest';
import type { SessionUser } from '@/types';

const mockResolverIdsEquipo = vi.fn();

vi.mock('@/lib/domain/equipo-jefe', () => ({
  resolverIdsEquipo: (...args: unknown[]) => mockResolverIdsEquipo(...args),
}));

function session(partial: Partial<SessionUser>): SessionUser {
  return {
    id: 1,
    email: 'user@cni.hn',
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

describe('dashboard-jefe access — Fase 1 seguridad', () => {
  it('puedeAccederMetricasJefe: solo Admin, RRHH, Jefe o Director', async () => {
    const { puedeAccederMetricasJefe } = await import('@/lib/domain/dashboard-jefe/access');
    expect(puedeAccederMetricasJefe(null)).toBe(false);
    expect(puedeAccederMetricasJefe(session({ esAdmin: true }))).toBe(true);
    expect(puedeAccederMetricasJefe(session({ esRrhh: true }))).toBe(true);
    expect(puedeAccederMetricasJefe(session({ esJefe: true }))).toBe(true);
    expect(puedeAccederMetricasJefe(session({ esDirector: true }))).toBe(true);
    expect(puedeAccederMetricasJefe(session({}))).toBe(false);
  });

  it('puedeVerBalanceEmpleado: Admin/RRHH ven cualquier balance', async () => {
    const { puedeVerBalanceEmpleado } = await import('@/lib/domain/dashboard-jefe/access');

    expect(await puedeVerBalanceEmpleado(session({ esAdmin: true }), 999)).toBe(true);
    expect(await puedeVerBalanceEmpleado(session({ esRrhh: true }), 999)).toBe(true);
    expect(mockResolverIdsEquipo).not.toHaveBeenCalled();
  });

  it('puedeVerBalanceEmpleado: usuario puede ver su propio balance', async () => {
    const { puedeVerBalanceEmpleado } = await import('@/lib/domain/dashboard-jefe/access');

    expect(await puedeVerBalanceEmpleado(session({ id: 42, esJefe: true }), 42)).toBe(true);
  });

  it('puedeVerBalanceEmpleado: jefe solo ve balances de su equipo', async () => {
    const { puedeVerBalanceEmpleado } = await import('@/lib/domain/dashboard-jefe/access');

    mockResolverIdsEquipo.mockResolvedValueOnce([100, 101, 102]);
    expect(
      await puedeVerBalanceEmpleado(session({ id: 10, esJefe: true, departamentoId: 1 }), 101)
    ).toBe(true);
    expect(mockResolverIdsEquipo).toHaveBeenCalledWith({
      jefeId: 10,
      esDirector: false,
      departamentoId: 1,
    });

    mockResolverIdsEquipo.mockResolvedValueOnce([100, 101, 102]);
    expect(
      await puedeVerBalanceEmpleado(session({ id: 10, esJefe: true, departamentoId: 1 }), 999)
    ).toBe(false);
  });

  it('puedeVerBalanceEmpleado: director usa fallback de departamento (resolverIdsEquipo lo aplica)', async () => {
    const { puedeVerBalanceEmpleado } = await import('@/lib/domain/dashboard-jefe/access');

    mockResolverIdsEquipo.mockResolvedValueOnce([200, 201, 202]);
    expect(
      await puedeVerBalanceEmpleado(
        session({ id: 10, esDirector: true, departamentoId: 5 }),
        200
      )
    ).toBe(true);

    mockResolverIdsEquipo.mockResolvedValueOnce([]);
    expect(
      await puedeVerBalanceEmpleado(
        session({ id: 10, esDirector: true, departamentoId: 5 }),
        300
      )
    ).toBe(false);
  });

  it('puedeVerBalanceEmpleado: empleado regular NO ve balances ajenos', async () => {
    const { puedeVerBalanceEmpleado } = await import('@/lib/domain/dashboard-jefe/access');

    expect(
      await puedeVerBalanceEmpleado(session({ id: 10 }), 99)
    ).toBe(false);
  });

  it('esJefeSinVisibilidadCompleta: true para jefe/director sin admin/rrhh', async () => {
    const { esJefeSinVisibilidadCompleta } = await import('@/lib/domain/dashboard-jefe/access');
    expect(esJefeSinVisibilidadCompleta(null)).toBe(false);
    expect(esJefeSinVisibilidadCompleta(session({}))).toBe(false);
    expect(esJefeSinVisibilidadCompleta(session({ esAdmin: true, esJefe: true }))).toBe(false);
    expect(esJefeSinVisibilidadCompleta(session({ esRrhh: true, esJefe: true }))).toBe(false);
    expect(esJefeSinVisibilidadCompleta(session({ esJefe: true }))).toBe(true);
    expect(esJefeSinVisibilidadCompleta(session({ esDirector: true }))).toBe(true);
  });
});