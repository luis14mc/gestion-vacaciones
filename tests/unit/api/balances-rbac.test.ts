import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockResolverIdsEquipo = vi.fn();
const mockTienePermiso = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: (...args: unknown[]) => mockTienePermiso(...args),
}));

vi.mock('@/lib/domain/equipo-jefe', () => ({
  resolverIdsEquipo: (...args: unknown[]) => mockResolverIdsEquipo(...args),
}));

const balancesData = [
  {
    id: 1,
    usuarioId: 10,
    anoLaboralId: 1,
    tipoAusencia: 'vacaciones',
    cantidadInicial: '20',
    cantidadAcumulada: '5',
    cantidadUsada: '10',
    cantidadPendiente: '0',
    cantidadDisponible: '15',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function createDbMock() {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
  };
  chain.then = (resolve: any) => Promise.resolve(balancesData).then(resolve);
  return {
    select: vi.fn(() => chain),
    query: { balances: { findFirst: vi.fn() } },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
  };
}

function crearRequest(url: string, body?: Record<string, unknown>, method = 'GET') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/balances — RBAC Fase 1 seguridad', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('jefe SÍ puede ver su propio balance', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
    });
    mockTienePermiso.mockReturnValue(false);
    mockResolverIdsEquipo.mockResolvedValue([100, 101]);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=10')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(balancesData);
    // Cuando es propio, NO se consulta equipo
    expect(mockResolverIdsEquipo).not.toHaveBeenCalled();
  });

  it('jefe NO puede ver balance de empleado que NO es su subordinado', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      departamentoId: 1,
    });
    mockTienePermiso.mockReturnValue(false);
    mockResolverIdsEquipo.mockResolvedValue([100, 101]); // 999 no está en el equipo

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=999')
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/No tienes permiso/i);
  });

  it('jefe SÍ puede ver balance de empleado subordinado (defense-in-depth)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      departamentoId: 1,
    });
    mockTienePermiso.mockReturnValue(false);
    mockResolverIdsEquipo.mockResolvedValue([100, 101, 102]);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=101')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockResolverIdsEquipo).toHaveBeenCalled();
  });

  it('director puede ver balance de empleado de su departamento (fallback director)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: true,
      departamentoId: 5,
    });
    mockTienePermiso.mockReturnValue(false);
    mockResolverIdsEquipo.mockResolvedValue([200, 201]);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=201')
    );
    expect(res.status).toBe(200);
  });

  it('RRHH puede ver cualquier balance', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
    });
    mockTienePermiso.mockReturnValue(true); // balances.ver_todos

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=999')
    );
    expect(res.status).toBe(200);
    expect(mockResolverIdsEquipo).not.toHaveBeenCalled();
  });

  it('Admin puede ver cualquier balance', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });
    mockTienePermiso.mockReturnValue(true);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=999')
    );
    expect(res.status).toBe(200);
  });

  it('empleado regular NO puede ver balances ajenos', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });
    mockTienePermiso.mockReturnValue(false);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/balances?usuarioId=999')
    );
    expect(res.status).toBe(403);
  });

  it('empleado regular NO puede listar balances sin usuarioId', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });
    mockTienePermiso.mockReturnValue(false);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(crearRequest('http://localhost/api/balances'));
    expect(res.status).toBe(403);
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const db = createDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/balances/route');
    const res = await mod.GET(crearRequest('http://localhost/api/balances'));
    expect(res.status).toBe(401);
  });
});