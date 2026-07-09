import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockEjecutarAccion = vi.fn();
const mockRegistrarAuditoria = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

vi.mock('@/services/workflow.service', () => ({
  ejecutarAccion: (...args: unknown[]) => mockEjecutarAccion(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  registrarEventoAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  datosPeticion: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' })),
}));

function crearDbMock(opts: { estado?: string; usuarioId?: number } = {}) {
  return {
    query: {
      solicitudes: {
        findFirst: vi.fn(async () => ({
          id: 1,
          estado: opts.estado ?? 'pendiente_rrhh',
          usuarioId: opts.usuarioId ?? 99,
          deletedAt: null,
        })),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
}

function crearRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/solicitudes/1/accion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/solicitudes/[id]/accion — Fase 4 bloqueo RRHH sobre rechazos previos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('bloquea aprobar_rrhh sobre rechazada_jefe con 409 y mensaje claro', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'rechazada_jefe' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'aprobar_rrhh' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/rechazada antes de llegar a Recursos Humanos/i);
    expect(mockEjecutarAccion).not.toHaveBeenCalled();
  });

  it('bloquea aprobar_rrhh sobre rechazada_director con 409', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'rechazada_director' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'aprobar_rrhh' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/rechazada antes de llegar a Recursos Humanos/i);
  });

  it('bloquea aprobar_rrhh sobre rechazada_secretario_general con 409', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'rechazada_secretario_general' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'aprobar_rrhh' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(409);
  });

  it('bloquea rechazar_rrhh sobre rechazada_jefe con 409', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'rechazada_jefe' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'rechazar_rrhh' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/rechazada antes de llegar a Recursos Humanos/i);
  });

  it('permite aprobar_rrhh sobre pendiente_rrhh (caso normal)', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'pendiente_rrhh' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    mockEjecutarAccion.mockResolvedValueOnce({
      exito: true,
      solicitud: { id: 1, estado: 'aprobada_rrhh' },
      transicion: { estadoAnterior: 'pendiente_rrhh', estadoNuevo: 'aprobada_rrhh' },
    });

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'aprobar_rrhh' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(200);
  });

  it('bloquea cualquier acción de un aprobador sobre estados finales', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 50,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ estado: 'rechazada_director' });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const mod = await import('@/app/api/solicitudes/[id]/accion/route');
    const res = await mod.POST(
      crearRequest({ accion: 'aprobar_director' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    expect(res.status).toBe(409);
  });
});