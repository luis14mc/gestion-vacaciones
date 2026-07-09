import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

function crearRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/reportes/departamento — RBAC Fase 1 (solo Admin/RRHH)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(401);
  });

  it('jefe NO puede consumir /api/reportes/departamento', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      roles: [],
      permisos: ['reportes.departamento'],
    });

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('No autorizado');
  });

  it('director NO puede consumir /api/reportes/departamento', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: true,
      roles: [],
      permisos: ['reportes.departamento'],
    });

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(403);
  });

  it('empleado NO puede consumir /api/reportes/departamento', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      roles: [],
      permisos: [],
    });

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(403);
  });

  it('RRHH SÍ puede consumir /api/reportes/departamento', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      roles: [],
      permisos: [],
    });

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(200);
  });

  it('Admin SÍ puede consumir /api/reportes/departamento', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      roles: [],
      permisos: [],
    });

    const dbMock = {
      query: {
        usuarios: { findMany: vi.fn(async () => []) },
        anosLaborales: { findFirst: vi.fn(async () => null) },
        balances: { findMany: vi.fn(async () => []) },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/reportes/departamento/route');
    const res = await mod.GET(crearRequest('http://localhost/api/reportes/departamento'));
    expect(res.status).toBe(200);
  });
});