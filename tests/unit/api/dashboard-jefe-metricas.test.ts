import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

interface DbMockOpts {
  usuarioBd: {
    id: number;
    activo: boolean;
    deletedAt: string | null;
    esAdmin: boolean;
    esRrhh: boolean;
    esDirector: boolean;
    esJefe: boolean;
    departamentoId: number | null;
  } | null;
  counts: Record<string, number>;
}

function createDbMock(opts: DbMockOpts) {
  let solicitudCountCall = 0;

  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(opts.usuarioBd ? [opts.usuarioBd] : [])),
  };

  // Make `then` resolve based on which count has been called in order.
  chain.then = (resolve: any) => {
    const order = [
      'countEmpleados',
      'countPendientes',
      'countAprobadas',
      'countRechazadas',
    ];
    const key = order[solicitudCountCall] ?? 'countEmpleados';
    solicitudCountCall++;
    return Promise.resolve([{ count: opts.counts[key] ?? 0 }]).then(resolve);
  };

  const db: any = {
    select: vi.fn(() => chain),
  };

  return db;
}

const validUsuarioBd = {
  id: 10,
  activo: true,
  deletedAt: null,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: true,
  departamentoId: 1,
};

describe('GET /api/dashboard/jefe/metricas — Fase 1 seguridad', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 cuando no hay sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const db = createDbMock({ usuarioBd: null, counts: {} });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('devuelve 401 cuando la sesión no tiene id válido', async () => {
    mockGetSession.mockResolvedValueOnce({ id: null, esAdmin: true });

    const db = createDbMock({ usuarioBd: null, counts: {} });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(401);
  });

  it('devuelve 403 cuando el usuario de BD está eliminado', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: true, esDirector: false, esRrhh: false,
    });

    const db = createDbMock({
      usuarioBd: { ...validUsuarioBd, deletedAt: '2026-01-01T00:00:00Z' },
      counts: {},
    });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(403);
  });

  it('devuelve 403 cuando el usuario de BD está inactivo', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: true, esDirector: false, esRrhh: false,
    });

    const db = createDbMock({
      usuarioBd: { ...validUsuarioBd, activo: false },
      counts: {},
    });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(403);
  });

  it('devuelve 403 cuando el usuario no es jefe/director/admin/rrhh', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: false, esDirector: false, esRrhh: false,
    });

    const db = createDbMock({
      usuarioBd: { ...validUsuarioBd, esJefe: false, esDirector: false },
      counts: {},
    });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(403);
  });

  it('devuelve success true y métricas en cero cuando el equipo está vacío', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: true, esDirector: false, esRrhh: false,
    });

    const db = createDbMock({ usuarioBd: validUsuarioBd, counts: {} });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      empleados_bajo_cargo: 0,
      solicitudes_pendientes_aprobacion: 0,
      solicitudes_aprobadas_hoy: 0,
      solicitudes_rechazadas_hoy: 0,
    });
  });

  it('devuelve métricas operativas para jefe con equipo asignado (sin balances)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: true, esDirector: false, esRrhh: false,
    });

    // Override resolverIdsEquipo to return equipo. Use counts for the 4 expected
    // count calls in order: empleados, pendientes, aprobadas, rechazadas.
    const db = createDbMock({
      usuarioBd: validUsuarioBd,
      counts: {
        countEmpleados: 3,
        countPendientes: 2,
        countAprobadas: 1,
        countRechazadas: 0,
      },
    });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => [100, 101, 102]),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      empleados_bajo_cargo: 3,
      solicitudes_pendientes_aprobacion: 2,
      solicitudes_aprobadas_hoy: 1,
      solicitudes_rechazadas_hoy: 0,
    });
    // Garantizar que NO expone días/balances del equipo
    expect(body.data).not.toHaveProperty('diasDisponibles');
    expect(body.data).not.toHaveProperty('diasAsignados');
    expect(body.data).not.toHaveProperty('diasUsados');
    expect(body.data).not.toHaveProperty('diasPendientes');
    expect(body.data).not.toHaveProperty('diasVencidos');
    expect(body.data).not.toHaveProperty('diasProporcionales');
    expect(body.data).not.toHaveProperty('balance');
    expect(body.data).not.toHaveProperty('solicitudes_pendientes');
    expect(body.data).not.toHaveProperty('usuarios_activos');
    expect(body.data).not.toHaveProperty('usuarios_totales');
    expect(body.data).not.toHaveProperty('en_vacaciones');
  });

  it('devuelve métricas operativas para director con equipo (fallback departamento)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: false, esDirector: true, esRrhh: false,
    });

    const db = createDbMock({
      usuarioBd: { ...validUsuarioBd, esJefe: false, esDirector: true, departamentoId: 5 },
      counts: {
        countEmpleados: 2,
        countPendientes: 1,
        countAprobadas: 0,
        countRechazadas: 1,
      },
    });
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => [200, 201]),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.empleados_bajo_cargo).toBe(2);
    expect(body.data.solicitudes_pendientes_aprobacion).toBe(1);
    expect(body.data.solicitudes_aprobadas_hoy).toBe(0);
    expect(body.data.solicitudes_rechazadas_hoy).toBe(1);
  });

  it('responde 500 con log cuando BD lanza excepción (no silent 500)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetSession.mockResolvedValueOnce({
      id: 10, esAdmin: false, esJefe: true, esDirector: false, esRrhh: false,
    });

    const db = {
      select: vi.fn(() => {
        throw new Error('BD caída');
      }),
    };
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/domain/equipo-jefe', () => ({
      resolverIdsEquipo: vi.fn(async () => []),
    }));

    const mod = await import('@/app/api/dashboard/jefe/metricas/route');
    const res = await mod.GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('[dashboard/jefe/metricas]'))
    )).toBe(true);
    errorSpy.mockRestore();
  });
});