import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockAsignar = vi.fn();

vi.mock('@/services/asignacion-vacaciones.service', () => ({
  asignarVacacionesMensuales: (...args: unknown[]) => mockAsignar(...args),
  obtenerHistorialAsignacionesUsuario: vi.fn(),
  obtenerResumenAsignacionesMensuales: vi.fn(),
}));

function crearRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/ejecutar-asignacion-mensual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/ejecutar-asignacion-mensual — Fase 5', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({}));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 para Jefe', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({}));
    expect(res.status).toBe(403);
  });

  it('devuelve 403 para Empleado', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({}));
    expect(res.status).toBe(403);
  });

  it('RRHH puede ejecutar y devuelve el resumen', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockAsignar.mockResolvedValueOnce({
      anio: 2026,
      mes: 7,
      usuariosProcesados: 5,
      asignacionesCreadas: 4,
      usuariosOmitidos: 1,
      totalDiasAsignados: 6.6668,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({ anio: 2026, mes: 7, modo: 'manual' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      anio: 2026,
      mes: 7,
      usuariosProcesados: 5,
      asignacionesCreadas: 4,
      usuariosOmitidos: 1,
      totalDiasAsignados: 6.6668,
    });
  });

  it('Admin puede ejecutar', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockAsignar.mockResolvedValueOnce({
      anio: 2026,
      mes: 7,
      usuariosProcesados: 0,
      asignacionesCreadas: 0,
      usuariosOmitidos: 0,
      totalDiasAsignados: 0,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({ anio: 2026, mes: 7 }));
    expect(res.status).toBe(200);
  });

  it('rechaza mes inválido', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({ anio: 2026, mes: 13 }));
    expect(res.status).toBe(400);
  });

  it('rechaza año fuera de rango', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/admin/ejecutar-asignacion-mensual/route');
    const res = await mod.POST(crearRequest({ anio: 1900, mes: 1 }));
    expect(res.status).toBe(400);
  });
});