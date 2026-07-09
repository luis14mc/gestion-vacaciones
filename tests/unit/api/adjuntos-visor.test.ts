import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockRegistrarAuditoria = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  registrarEventoAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  datosPeticion: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' })),
}));

function crearDbMock(opts: {
  solicitud?: any;
}) {
  return {
    query: {
      solicitudes: { findFirst: vi.fn(async () => opts.solicitud ?? null) },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(opts.solicitud ? [opts.solicitud] : [])),
        })),
      })),
    })),
  };
}

function crearRequest(url: string) {
  return new NextRequest(url, { method: 'POST' });
}

describe('POST /api/solicitudes/[id]/adjuntos/[idx]/ver — visor de adjuntos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const dbMock = crearDbMock({});
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({
        where: { sql: 'true' },
        vacio: false,
      })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/0/ver'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(401);
  });

  it('devuelve 404 si la solicitud no existe', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 10, esAdmin: false, esJefe: false });
    const dbMock = crearDbMock({}); // sin solicitud
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/0/ver'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el índice de adjunto está fuera de rango', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 10, esAdmin: false });
    const dbMock = crearDbMock({
      solicitud: {
        id: 1,
        usuarioId: 99,
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      },
    });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/99/ver'), {
      params: Promise.resolve({ id: '1', idx: '99' }),
    });
    expect(res.status).toBe(404);
  });

  it('devuelve 403 si el usuario no es dueño ni aprobador', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 50,
      esAdmin: false,
      esJefe: false,
      esDirector: false,
      esRrhh: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({
      solicitud: {
        id: 1,
        usuarioId: 99,
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      },
    });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    // El inbox devuelve vacío (no tiene acceso)
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/0/ver'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(403);
  });

  it('permite al dueño ver su propio adjunto', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 99,
      esAdmin: false,
      esJefe: false,
      esDirector: false,
      esRrhh: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({
      solicitud: {
        id: 1,
        usuarioId: 99,
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      },
    });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));
    mockRegistrarAuditoria.mockResolvedValueOnce(undefined);

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/0/ver'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(200);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'adjunto_visualizado',
        detalles: expect.objectContaining({
          tipoAdjunto: 'vobo_jefe',
          indice: 0,
        }),
      })
    );
  });

  it('permite a RRHH ver adjunto (inbox contiene la solicitud)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 50,
      esAdmin: false,
      esJefe: false,
      esDirector: false,
      esRrhh: true,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({
      solicitud: {
        id: 1,
        usuarioId: 99,
        documentosAdjuntos: [{ tipo: 'vobo_ministro', data: 'data:...' }],
      },
    });
    // El inbox devuelve una condición real (cualquier sql válido)
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({
        where: { sql: 'true' },
        vacio: false,
      })),
    }));
    mockRegistrarAuditoria.mockResolvedValueOnce(undefined);

    const mod = await import('@/app/api/solicitudes/[id]/adjuntos/[idx]/ver/route');
    const res = await mod.POST(crearRequest('http://localhost/api/solicitudes/1/adjuntos/0/ver'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(200);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'adjunto_visualizado',
        detalles: expect.objectContaining({
          tipoAdjunto: 'vobo_ministro',
          solicitanteEsAprobador: true,
        }),
      })
    );
  });
});