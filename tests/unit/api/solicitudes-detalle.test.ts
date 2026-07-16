import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockTienePermiso = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: (...args: unknown[]) => mockTienePermiso(...args),
}));

vi.mock('@/lib/domain/solicitud-adjuntos-display', () => ({
  enriquecerAdjuntosSolicitudes: vi.fn(async (rows: unknown[]) => rows),
}));

const ESTADOS_FINALES = [
  'aprobada_rrhh',
  'rechazada_jefe',
  'rechazada_director',
  'rechazada_secretario_general',
  'rechazada_rrhh',
  'cancelada',
] as const;

const PDF_ADJUNTO = {
  tipo: 'vobo_jefe',
  nombre: 'vobo.pdf',
  data: 'data:application/pdf;base64,JVBERi0xLjQK',
  uploadedBy: 5,
};

function crearSolicitudMock(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 42,
    codigo: 'SOL-2026-042',
    usuarioId: 10,
    tipo: 'vacaciones',
    fechaInicio: '2026-07-01',
    fechaFin: '2026-07-05',
    diasSolicitados: '5',
    duracionPermiso: null,
    motivo: 'Descanso',
    comentarioEmpleado: null,
    estado: 'aprobada_rrhh',
    documentosAdjuntos: [PDF_ADJUNTO],
    metadata: {},
    createdAt: new Date('2026-06-01'),
    aprobadaJefePor: 5,
    aprobadaDirectorPor: null,
    aprobadaSecretarioPor: null,
    aprobadaRrhhPor: 20,
    aprobadaJefeFecha: new Date('2026-06-02'),
    aprobadaRrhhFecha: new Date('2026-06-03'),
    ...overrides,
  };
}

function crearDbMock(opts: {
  solicitud?: ReturnType<typeof crearSolicitudMock> | null;
  inboxMatch?: boolean;
}) {
  const solicitud = opts.solicitud ?? null;
  const inboxMatch = opts.inboxMatch ?? false;

  let selectCall = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            selectCall += 1;
            if (selectCall === 1) {
              return solicitud ? [solicitud] : [];
            }
            return inboxMatch ? [{ id: solicitud?.id ?? 0 }] : [];
          }),
        })),
      })),
    })),
  };
}

function crearRequest(id: string) {
  return new NextRequest(`http://localhost/api/solicitudes/${id}`, { method: 'GET' });
}

describe('GET /api/solicitudes/[id] — detalle institucional con adjuntos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockTienePermiso.mockReturnValue(false);
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const dbMock = crearDbMock({});
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('1'), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });

  it('devuelve 404 si la solicitud no existe', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 10, esAdmin: false, esRrhh: false, esJefe: false });
    const dbMock = crearDbMock({ solicitud: null });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('999'), { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });

  it('permite al solicitante ver adjuntos en estado final aprobada_rrhh', async () => {
    const solicitud = crearSolicitudMock({ estado: 'aprobada_rrhh', usuarioId: 10 });
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ solicitud });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('42'), { params: Promise.resolve({ id: '42' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.documentosAdjuntos).toHaveLength(1);
    expect(json.data.puedeVerAdjuntos).toBe(true);
  });

  it.each(ESTADOS_FINALES.filter((e) => e !== 'aprobada_rrhh'))(
    'expone adjuntos al solicitante en estado final %s',
    async (estado) => {
      const solicitud = crearSolicitudMock({
        estado,
        usuarioId: 10,
        documentosAdjuntos: [PDF_ADJUNTO],
      });
      mockGetSession.mockResolvedValueOnce({
        id: 10,
        esAdmin: false,
        esRrhh: false,
        esJefe: false,
        esDirector: false,
        esSecretarioGeneral: false,
      });
      const dbMock = crearDbMock({ solicitud });
      vi.doMock('@/lib/db', () => ({ db: dbMock }));
      vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
        construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
      }));

      const mod = await import('@/app/api/solicitudes/[id]/route');
      const res = await mod.GET(crearRequest('42'), { params: Promise.resolve({ id: '42' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.estado).toBe(estado);
      expect(json.data.documentosAdjuntos).toHaveLength(1);
    }
  );

  it('permite a RRHH ver solicitud ajena con adjuntos', async () => {
    const solicitud = crearSolicitudMock({ usuarioId: 99, estado: 'rechazada_director' });
    mockGetSession.mockResolvedValueOnce({
      id: 20,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ solicitud });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('42'), { params: Promise.resolve({ id: '42' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.puedeVerAdjuntos).toBe(true);
  });

  it('devuelve 403 a usuario sin relación con la solicitud', async () => {
    const solicitud = crearSolicitudMock({ usuarioId: 99, estado: 'aprobada_rrhh' });
    mockGetSession.mockResolvedValueOnce({
      id: 77,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ solicitud, inboxMatch: false });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({
        where: { sql: 'inbox' },
        vacio: false,
      })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('42'), { params: Promise.resolve({ id: '42' }) });
    expect(res.status).toBe(403);
  });

  it('incluye solicitud sin adjuntos para histórico antiguo', async () => {
    const solicitud = crearSolicitudMock({
      estado: 'aprobada_rrhh',
      documentosAdjuntos: null,
      usuarioId: 10,
    });
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
      esSecretarioGeneral: false,
    });
    const dbMock = crearDbMock({ solicitud });
    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/domain/aprobacion-inbox-queries', () => ({
      construirCondicionesBandejaAprobacion: vi.fn(async () => ({ where: null, vacio: true })),
    }));

    const mod = await import('@/app/api/solicitudes/[id]/route');
    const res = await mod.GET(crearRequest('42'), { params: Promise.resolve({ id: '42' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.documentosAdjuntos).toBeNull();
  });
});
