import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockConstruirCondicionesBandeja = vi.fn();
const mockCalcularStatsBandeja = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

vi.mock('@/lib/domain/aprobacion-inbox-queries', () => ({
  construirCondicionesBandejaAprobacion: (...args: unknown[]) =>
    mockConstruirCondicionesBandeja(...args),
  calcularStatsBandejaAprobacion: (...args: unknown[]) =>
    mockCalcularStatsBandeja(...args),
}));

const PDF_PESADO = 'data:application/pdf;base64,' + 'A'.repeat(5000);

const mockSolicitudDb = {
  id: 42,
  codigo: 'CNI-SOL-2026-0042',
  usuarioId: 10,
  tipo: 'vacaciones',
  fechaInicio: '2026-08-01',
  fechaFin: '2026-08-05',
  diasSolicitados: '5',
  motivo: 'Descanso',
  estado: 'pendiente_jefe',
  comentarioJefe: null,
  comentarioRrhh: null,
  aprobadaJefePor: null,
  aprobadaRrhhPor: null,
  aprobadaDirectorPor: null,
  aprobadaSecretarioPor: null,
  aprobadaJefeFecha: null,
  aprobadaRrhhFecha: null,
  createdAt: '2026-07-01T00:00:00Z',
  motivoRechazo: null,
  rechazadaPor: null,
  rechazadaFecha: null,
  documentosAdjuntos: [
    { tipo: 'vobo_ministro', nombre: 'vobo.pdf', data: PDF_PESADO },
  ],
  metadata: {},
  usuario: {
    id: 10,
    nombre: 'Ana',
    apellido: 'López',
    email: 'ana@cni.hn',
  },
};

function crearDbMock() {
  const resultSet = [mockSolicitudDb];
  let selectCall = 0;

  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resultSet)),
    offset: vi.fn(() => Promise.resolve(resultSet)),
  };

  const countChain: any = {
    from: vi.fn(() => countChain),
    where: vi.fn(() => countChain),
  };
  countChain.then = (resolve: any) => Promise.resolve([{ count: 1 }]).then(resolve);

  const statsChain: any = {
    from: vi.fn(() => statsChain),
    where: vi.fn(() => statsChain),
  };
  statsChain.then = (resolve: any) =>
    Promise.resolve([{ pendientes: 1, aprobadas: 0, rechazadas: 0 }]).then(resolve);

  return {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall === 1) return statsChain;
      return countChain;
    }),
    query: {
      solicitudes: {
        findMany: vi.fn(async () => resultSet),
      },
    },
  };
}

function crearRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/solicitudes — listado liviano sin adjuntos embebidos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockGetSession.mockResolvedValue({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: false,
    });
    mockConstruirCondicionesBandeja.mockResolvedValue({ where: {}, vacio: false });
    mockCalcularStatsBandeja.mockResolvedValue({
      pendientes: 1,
      aprobadas_hoy: 0,
      rechazadas_hoy: 0,
    });
  });

  it('listado normal no devuelve documentosAdjuntos ni data embebida', async () => {
    const db = crearDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/solicitudes/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/solicitudes?pagina=1&limite=20')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.solicitudes).toHaveLength(1);
    expect(body.data).toHaveLength(1);

    const item = body.solicitudes[0];
    expect(item).not.toHaveProperty('documentosAdjuntos');
    expect(item.tieneAdjuntos).toBe(true);
    expect(item.cantidadAdjuntos).toBe(1);
    expect(item.tiposAdjuntos).toContain('vobo_ministro');

    const payload = JSON.stringify(body);
    expect(payload).not.toContain('documentosAdjuntos');
    expect(payload).not.toContain(PDF_PESADO);
    expect(payload.length).toBeLessThan(20_000);
  });

  it('paraAprobar devuelve metadata de adjuntos sin contenido', async () => {
    mockGetSession.mockResolvedValue({
      id: 5,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
    });

    const db = crearDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/solicitudes/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/solicitudes?paraAprobar=true&page=1&pageSize=20')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0]).not.toHaveProperty('documentosAdjuntos');
    expect(body.data[0].tieneAdjuntos).toBe(true);
    expect(JSON.stringify(body)).not.toContain(PDF_PESADO);
  });

  it('solicitudes y data comparten el mismo conteo sin duplicar adjuntos pesados', async () => {
    const db = crearDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/solicitudes/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/solicitudes?pagina=1&limite=20')
    );
    const body = await res.json();

    expect(body.solicitudes.length).toBe(body.data.length);
    const idsListado = body.solicitudes.map((s: { id: number }) => s.id);
    const idsData = body.data.map((s: { id: number }) => s.id);
    expect(idsListado).toEqual(idsData);
  });
});
