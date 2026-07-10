import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockObtenerHistorial = vi.fn();
const mockObtenerResumen = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/services/asignacion-vacaciones.service', () => ({
  obtenerHistorialAsignacionesUsuario: (...args: unknown[]) =>
    mockObtenerHistorial(...args),
  obtenerResumenAsignacionesMensuales: (...args: unknown[]) =>
    mockObtenerResumen(...args),
}));

function crearGet(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/vacaciones/asignaciones-mensuales — Fase 5', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=10'));
    expect(res.status).toBe(401);
  });

  it('empleado solo ve su propio historial', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockObtenerHistorial.mockResolvedValueOnce([]);
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=10')
    );
    expect(res.status).toBe(200);
    expect(mockObtenerHistorial).toHaveBeenCalledWith(10, { anio: undefined, limite: 36 });
  });

  it('empleado NO puede ver historial de otro', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=99')
    );
    expect(res.status).toBe(403);
  });

  it('Jefe NO tiene acceso al historial', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=99')
    );
    expect(res.status).toBe(403);
  });

  it('RRHH puede ver historial de cualquiera', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockObtenerHistorial.mockResolvedValueOnce([
      { id: 1, anio: 2026, mes: 7, diasAsignados: 0.8333 },
    ]);
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=99&anio=2026')
    );
    expect(res.status).toBe(200);
    expect(mockObtenerHistorial).toHaveBeenCalledWith(99, { anio: 2026, limite: 36 });
  });

  it('Admin puede ver historial de cualquiera', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockObtenerHistorial.mockResolvedValueOnce([]);
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?usuarioId=99')
    );
    expect(res.status).toBe(200);
  });

  it('RRHH con anio+mes devuelve resumen batch (sin usuarioId)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    mockObtenerResumen.mockResolvedValueOnce({
      anio: 2026,
      mes: 7,
      asignaciones: 5,
      totalDiasAsignados: 4.1665,
    });
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales?anio=2026&mes=7')
    );
    expect(res.status).toBe(200);
    expect(mockObtenerResumen).toHaveBeenCalledWith({ anio: 2026, mes: 7 });
  });

  it('falla con 400 si no se pasa usuarioId ni anio+mes', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const mod = await import('@/app/api/vacaciones/asignaciones-mensuales/route');
    const res = await mod.GET(
      crearGet('http://localhost/api/vacaciones/asignaciones-mensuales')
    );
    expect(res.status).toBe(400);
  });
});