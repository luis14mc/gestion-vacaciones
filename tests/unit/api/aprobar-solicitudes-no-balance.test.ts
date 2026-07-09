import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockResolverIdsEquipo = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

vi.mock('@/lib/domain/equipo-jefe', () => ({
  resolverIdsEquipo: (...args: unknown[]) => mockResolverIdsEquipo(...args),
}));

interface MockSolicitud {
  id: number;
  codigo: string;
  usuarioId: number;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: string;
  motivo: string | null;
  estado: string;
  createdAt: string;
  metadata: any;
  usuario: { id: number; nombre: string; apellido: string; email: string };
}

const mockSolicitudes: MockSolicitud[] = [
  {
    id: 100,
    codigo: 'CNI-SOL-2026-0001',
    usuarioId: 50,
    tipo: 'vacaciones',
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-05',
    diasSolicitados: '5',
    motivo: 'Vacaciones',
    estado: 'pendiente_jefe',
    createdAt: '2026-07-01T00:00:00Z',
    metadata: {},
    usuario: { id: 50, nombre: 'Juan', apellido: 'Pérez', email: 'juan@cni.hn' },
  },
];

function crearDbMock() {
  const resultSet = mockSolicitudes;
  let countCall = 0;
  let statsCall = 0;
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
  countChain.then = (resolve: any) => {
    countCall++;
    return Promise.resolve([{ count: 1 }]).then(resolve);
  };

  const statsChain: any = {
    from: vi.fn(() => statsChain),
    where: vi.fn(() => statsChain),
  };
  statsChain.then = (resolve: any) => {
    statsCall++;
    return Promise.resolve([{ pendientes: 1, aprobadas: 0, rechazadas: 0, total: 1 }]).then(resolve);
  };

  return {
    select: vi.fn((fields: any) => {
      const firstKey = fields && typeof fields === 'object' ? Object.keys(fields)[0] : undefined;
      if (firstKey === 'count' || firstKey === 'total' || firstKey === 'pendientes') {
        return statsCall === 0 ? statsChain : countChain;
      }
      return chain;
    }),
    query: {
      solicitudes: {
        findMany: vi.fn(async () => resultSet),
      },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
  };
}

function crearRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/solicitudes?paraAprobar=true — no expone balances al jefe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('jefe recibe datos de solicitud SIN campos de balance del solicitante', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
      esDirector: false,
      departamentoId: 1,
      roles: [],
      permisos: [],
    });
    mockResolverIdsEquipo.mockResolvedValue([50, 51, 52]);

    const db = crearDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/solicitudes/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/solicitudes?paraAprobar=true&page=1&pageSize=20')
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);

    const item = body.data[0];

    // Datos esperados (lo que el jefe SÍ debe ver):
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('codigo');
    expect(item).toHaveProperty('usuarioId');
    expect(item).toHaveProperty('tipo');
    expect(item).toHaveProperty('fechaInicio');
    expect(item).toHaveProperty('fechaFin');
    expect(item).toHaveProperty('motivo');
    expect(item).toHaveProperty('estado');
    expect(item.usuario).toMatchObject({
      id: 50,
      nombre: 'Juan',
      apellido: 'Pérez',
    });

    // Datos que el jefe NO debe ver:
    const itemStr = JSON.stringify(item);
    expect(itemStr).not.toMatch(/diasDisponibles/i);
    expect(itemStr).not.toMatch(/diasAsignados/i);
    expect(itemStr).not.toMatch(/diasUsados/i);
    expect(itemStr).not.toMatch(/diasPendientes/i);
    expect(itemStr).not.toMatch(/diasVencidos/i);
    expect(itemStr).not.toMatch(/diasProporcionales/i);
    expect(itemStr).not.toMatch(/cantidadDisponible/i);
    expect(itemStr).not.toMatch(/cantidadInicial/i);
    expect(itemStr).not.toMatch(/cantidadAcumulada/i);
    expect(itemStr).not.toMatch(/balance/i);
    expect(itemStr).not.toMatch(/saldo/i);
  });

  it('director también recibe solicitud SIN balance del solicitante', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
      esDirector: true,
      departamentoId: 5,
      roles: [],
      permisos: [],
    });
    mockResolverIdsEquipo.mockResolvedValue([50]);

    const db = crearDbMock();
    vi.doMock('@/lib/db', () => ({ db }));

    const mod = await import('@/app/api/solicitudes/route');
    const res = await mod.GET(
      crearRequest('http://localhost/api/solicitudes?paraAprobar=true&page=1&pageSize=20')
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    const itemStr = JSON.stringify(body.data?.[0] ?? {});
    expect(itemStr).not.toMatch(/diasDisponibles/i);
    expect(itemStr).not.toMatch(/balance/i);
  });
});