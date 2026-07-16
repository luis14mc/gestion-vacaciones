import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockObtenerBalances = vi.fn();
const mockExportarCsv = vi.fn();
const mockObtenerDetalle = vi.fn();
const mockAuditoria = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/services/rrhh-balances.service', () => ({
  obtenerBalancesVacacionesRRHH: (...args: unknown[]) => mockObtenerBalances(...args),
  exportarBalancesVacacionesCSV: (...args: unknown[]) => mockExportarCsv(...args),
  obtenerDetalleBalanceColaboradorRRHH: (...args: unknown[]) =>
    mockObtenerDetalle(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarEventoAuditoria: (...args: unknown[]) => mockAuditoria(...args),
  datosPeticion: () => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' }),
}));

const filaMock = {
  usuarioId: 10,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@cni.hn',
  departamento: 'RRHH',
  cargo: 'Analista',
  fechaIngreso: '2020-01-01',
  activo: true,
  antiguedad: { anios: 6, meses: 6, dias: 14, texto: '6 años' },
  reglaVacaciones: { diasAnualesAplicables: 20, diasMensualesAplicables: 1.6667 },
  balance: {
    diasVencidos: 10,
    diasProporcionales: 5,
    diasAsignados: 15,
    diasUsados: 3,
    diasPendientes: 2,
    diasDisponibles: 10,
  },
  asignacionMensual: {
    ultimoMesAsignado: 7,
    ultimoAnioAsignado: 2026,
    diasUltimaAsignacion: 1.6667,
    fechaUltimaAsignacion: '2026-07-01T07:00:00Z',
    estadoMesActual: 'asignado' as const,
  },
  validacion: { consistente: true, diferencia: 0, mensaje: null },
};

function crearGet(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/rrhh/balances-vacaciones — RBAC', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockObtenerBalances.mockResolvedValue({
      data: [filaMock],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      resumen: {
        totalColaboradores: 1,
        totalActivos: 1,
        totalConAsignacionMesActual: 1,
        totalPendientesAsignacionMesActual: 0,
        totalConInconsistencias: 0,
      },
    });
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const mod = await import('@/app/api/rrhh/balances-vacaciones/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones'));
    expect(res.status).toBe(401);
  });

  it('RRHH puede consultar balances', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
      esJefe: false,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.resumen.totalColaboradores).toBe(1);
  });

  it('Admin puede consultar balances', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 1,
      esAdmin: true,
      esRrhh: false,
      esJefe: false,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones'));
    expect(res.status).toBe(200);
  });

  it('Jefe recibe 403', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones'));
    expect(res.status).toBe(403);
  });

  it('Empleado recibe 403', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: false,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones'));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/rrhh/balances-vacaciones/[usuarioId] — detalle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockObtenerDetalle.mockResolvedValue({
      colaborador: filaMock,
      historialAsignaciones: [],
      solicitudesRecientes: [],
    });
  });

  it('RRHH puede abrir detalle de colaborador', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 70,
      esAdmin: false,
      esRrhh: true,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/[usuarioId]/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones/10'), {
      params: Promise.resolve({ usuarioId: '10' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.colaborador.usuarioId).toBe(10);
  });

  it('Jefe recibe 403 en detalle', async () => {
    mockGetSession.mockResolvedValueOnce({
      id: 10,
      esAdmin: false,
      esRrhh: false,
      esJefe: true,
    });
    const mod = await import('@/app/api/rrhh/balances-vacaciones/[usuarioId]/route');
    const res = await mod.GET(crearGet('http://localhost/api/rrhh/balances-vacaciones/10'), {
      params: Promise.resolve({ usuarioId: '10' }),
    });
    expect(res.status).toBe(403);
  });
});
