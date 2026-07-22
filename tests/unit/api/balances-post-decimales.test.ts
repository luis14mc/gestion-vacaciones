import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockTienePermiso = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockInsertValues = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: (...args: unknown[]) => mockTienePermiso(...args),
}));

function crearPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/balances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/balances — días decimales', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({
      id: 1,
      esAdmin: true,
      esRrhh: true,
    });
    mockTienePermiso.mockReturnValue(true);
    mockFindFirst.mockResolvedValue(null);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  });

  async function importRoute(balanceExistente: unknown = null) {
    mockFindFirst.mockResolvedValue(balanceExistente);

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 99 }])),
          })),
        })),
      })),
      query: {
        balances: { findFirst: mockFindFirst },
      },
      update: vi.fn(() => ({ set: mockUpdateSet })),
      insert: vi.fn(() => ({ values: mockInsertValues })),
    };

    vi.doMock('@/lib/db', () => ({ db }));
    return import('@/app/api/balances/route');
  }

  it('persiste 23.70 con 4 decimales al crear balance', async () => {
    const mod = await importRoute(null);
    const res = await mod.POST(
      crearPostRequest({
        usuarioId: 10,
        tipoAusencia: 'vacaciones',
        cantidadInicial: '23.70',
        anio: 2026,
      })
    );

    expect(res.status).toBe(200);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ cantidadInicial: '23.7000' })
    );
  });

  it('actualiza balance existente conservando decimales', async () => {
    const mod = await importRoute({
      id: 5,
      version: 2,
      cantidadInicial: '10.0000',
    });

    const res = await mod.POST(
      crearPostRequest({
        usuarioId: 10,
        tipoAusencia: 'vacaciones',
        cantidadInicial: 12.6667,
        anoLaboralId: 99,
      })
    );

    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ cantidadInicial: '12.6667' })
    );
  });

  it('rechaza más de 4 decimales', async () => {
    const mod = await importRoute(null);
    const res = await mod.POST(
      crearPostRequest({
        usuarioId: 10,
        tipoAusencia: 'vacaciones',
        cantidadInicial: 12.66678,
        anio: 2026,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/4 decimales/i);
  });

  it('rechaza valores negativos', async () => {
    const mod = await importRoute(null);
    const res = await mod.POST(
      crearPostRequest({
        usuarioId: 10,
        tipoAusencia: 'vacaciones',
        cantidadInicial: -0.5,
        anio: 2026,
      })
    );

    expect(res.status).toBe(400);
  });
});
