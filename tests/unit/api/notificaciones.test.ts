import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockSelect = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 1 }]),
        })),
      })),
    })),
  },
}));

describe('GET /api/notificaciones — BLOQUE 4', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const mod = await import('@/app/api/notificaciones/route');
    const res = await mod.GET(new NextRequest('http://localhost/api/notificaciones'));
    expect(res.status).toBe(401);
  });

  it('lista notificaciones del usuario', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 5 });
    mockSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: 1,
                tipo: 'asignacion_vacaciones',
                titulo: 'Asignación mensual',
                mensaje: 'Se le han asignado 1.25 días',
                referencia: 'asignacion:10',
                leida: false,
                createdAt: '2026-07-01T12:00:00.000Z',
              },
            ]),
          })),
        })),
      })),
    });

    const mod = await import('@/app/api/notificaciones/route');
    const res = await mod.GET(new NextRequest('http://localhost/api/notificaciones'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.noLeidas).toBe(1);
    expect(json.data.notificaciones).toHaveLength(1);
  });
});
