import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

function crearRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/exportar — RBAC Fase 1 (solo Admin/RRHH)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(401);
  });

  it('jefe NO puede consumir /api/exportar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
    });

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('director NO puede consumir /api/exportar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: true,
    });

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(403);
  });

  it('empleado NO puede consumir /api/exportar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(403);
  });

  it('RRHH SÍ puede consumir /api/exportar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
    });

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(200);
  });

  it('Admin SÍ puede consumir /api/exportar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });

    const dbMock = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })) })) })),
    };
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/exportar/route');
    const res = await mod.GET(crearRequest('http://localhost/api/exportar?tipo=usuarios'));
    expect(res.status).toBe(200);
  });
});