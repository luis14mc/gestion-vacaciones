import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockResolverAlcance = vi.fn();
const mockGenerarReporte = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/domain/reportes/scope', () => ({
  resolverAlcanceReportes: (...args: unknown[]) => mockResolverAlcance(...args),
}));

vi.mock('@/lib/domain/reportes/queries', () => ({
  generarReporte: (...args: unknown[]) => mockGenerarReporte(...args),
}));

function crearRequest(url = 'http://localhost/api/reportes?tipo=solicitudes') {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/reportes — RBAC Fase 1 (solo Admin/RRHH)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockResolverAlcance.mockResolvedValue({
      usuarioIds: null,
      departamentoId: null,
      vacio: false,
    });
    mockGenerarReporte.mockResolvedValue({ data: [], totalRegistros: 0 });
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('jefe NO puede consumir /api/reportes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      permisos: ['reportes.departamento', 'reportes.exportar'],
    });

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/No tienes permiso/i);
    // No debe invocar generarReporte ni resolverAlcance si está bloqueado.
    expect(mockGenerarReporte).not.toHaveBeenCalled();
    expect(mockResolverAlcance).not.toHaveBeenCalled();
  });

  it('director NO puede consumir /api/reportes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: true,
      permisos: ['reportes.departamento'],
    });

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('empleado regular NO puede consumir /api/reportes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(403);
  });

  it('RRHH SÍ puede consumir /api/reportes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      permisos: ['reportes.exportar'],
    });

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.meta.alcance.organizacional).toBe(true);
  });

  it('Admin SÍ puede consumir /api/reportes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });

    const mod = await import('@/app/api/reportes/route');
    const res = await mod.GET(crearRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.meta.alcance.organizacional).toBe(true);
  });
});