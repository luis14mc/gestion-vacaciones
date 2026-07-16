import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAsignar = vi.fn();

vi.mock('@/services/asignacion-vacaciones.service', () => ({
  asignarVacacionesMensuales: (...args: unknown[]) => mockAsignar(...args),
}));

describe('POST /api/cron/asignacion-mensual — BLOQUE 4', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret-min-16-chars';
    mockAsignar.mockResolvedValue({
      anio: 2026,
      mes: 7,
      usuariosProcesados: 10,
      asignacionesCreadas: 8,
      usuariosOmitidos: 2,
      totalDiasAsignados: 12.5,
    });
  });

  it('devuelve 401 sin Bearer correcto', async () => {
    const mod = await import('@/app/api/cron/asignacion-mensual/route');
    const res = await mod.POST(
      new NextRequest('http://localhost/api/cron/asignacion-mensual', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });

  it('ejecuta asignación con origen sistema y ejecutadoPor null', async () => {
    const mod = await import('@/app/api/cron/asignacion-mensual/route');
    const res = await mod.POST(
      new NextRequest('http://localhost/api/cron/asignacion-mensual', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-cron-secret-min-16-chars',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ anio: 2026, mes: 7 }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockAsignar).toHaveBeenCalledWith(
      expect.objectContaining({
        anio: 2026,
        mes: 7,
        origen: 'sistema',
        ejecutadoPor: null,
      })
    );
  });
});
