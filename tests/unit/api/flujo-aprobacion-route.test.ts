import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockCargarDatosFlujoSolicitante = vi.fn();
const mockResolverFlujoSolicitante = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/domain/solicitud-flujo-solicitante', () => ({
  cargarDatosFlujoSolicitante: (...args: unknown[]) =>
    mockCargarDatosFlujoSolicitante(...args),
  resolverFlujoSolicitante: (...args: unknown[]) => mockResolverFlujoSolicitante(...args),
}));

describe('GET /api/solicitudes/flujo-aprobacion', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/solicitudes/flujo-aprobacion/route');
    const res = await GET(new NextRequest('http://localhost/api/solicitudes/flujo-aprobacion'));
    expect(res.status).toBe(401);
  });

  it('empleado con jefe en depto sin Director → flujo pendiente_jefe', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 30 });
    mockCargarDatosFlujoSolicitante.mockResolvedValueOnce({
      id: 30,
      esDirector: false,
      esJefe: false,
      departamentoId: 5,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: 20,
    });
    mockResolverFlujoSolicitante.mockResolvedValueOnce({
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereVoBoMinistro: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
      mensajeFlujo: 'Jefe luego RRHH',
      pasosProceso: ['Jefe', 'RRHH'],
      aprobadorInicialTipo: 'jefe',
      aprobadorSegundoNivelTipo: null,
    });

    const { GET } = await import('@/app/api/solicitudes/flujo-aprobacion/route');
    const res = await GET(
      new NextRequest('http://localhost/api/solicitudes/flujo-aprobacion?tipo=vacaciones')
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.requiereAprobacionJefe).toBe(true);
    expect(json.data.requiereAprobacionDirector).toBe(false);
    expect(json.data.tipoVoBoRequerido).toBe('vobo_jefe');
  });

  it('jefe sin Director ni Dir. SG → 400 controlado', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 20 });
    mockCargarDatosFlujoSolicitante.mockResolvedValueOnce({
      id: 20,
      esDirector: false,
      esJefe: true,
      departamentoId: 2,
      departamentoNombre: 'TI',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValueOnce({
      errorFlujo: true,
      mensajeFlujo:
        'No hay Director asignado al departamento Secretaría General para aprobación sustituta.',
      requiereAprobacionSecretariaGeneral: true,
    });

    const { GET } = await import('@/app/api/solicitudes/flujo-aprobacion/route');
    const res = await GET(
      new NextRequest('http://localhost/api/solicitudes/flujo-aprobacion?tipo=vacaciones')
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Secretaría General');
  });
});
