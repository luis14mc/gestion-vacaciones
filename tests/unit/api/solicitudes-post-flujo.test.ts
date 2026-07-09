import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockCrearSolicitud = vi.fn();
const mockRegistrarAuditoria = vi.fn();
const mockCargarDatosFlujoSolicitante = vi.fn();
const mockResolverFlujoSolicitante = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

vi.mock('@/services/solicitudes.service', () => ({
  crearSolicitud: (...args: unknown[]) => mockCrearSolicitud(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  datosPeticion: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' })),
}));

vi.mock('@/services/email.service', () => ({
  notificarNuevaSolicitudAJefe: vi.fn(),
}));

vi.mock('@/lib/config/service', () => ({
  obtenerConfigs: vi.fn(async () => ({
    'notificaciones.notificar_jefe_nueva_solicitud': 'false',
  })),
  asBool: vi.fn(() => false),
}));

vi.mock('@/lib/domain/solicitud-flujo-solicitante', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/domain/solicitud-flujo-solicitante')>();
  return {
    ...actual,
    cargarDatosFlujoSolicitante: (...args: unknown[]) =>
      mockCargarDatosFlujoSolicitante(...args),
    resolverFlujoSolicitante: (...args: unknown[]) =>
      mockResolverFlujoSolicitante(...args),
  };
});

vi.mock('@/lib/domain/aprobadores', () => ({
  resolverAprobadorSegundoNivel: vi.fn(async () => ({
    tipoAprobador: 'director',
    usuarioId: 50,
    motivo: 'director_asignado',
    nombre: 'Director de Área',
  })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      solicitudes: {
        findFirst: vi.fn(async () => ({
          id: 99,
          codigo: 'CNI-SOL-2026-0001',
          tipo: 'vacaciones',
          estado: 'pendiente_jefe',
          diasSolicitados: '5',
          usuario: { id: 10, nombre: 'Laura', apellido: 'Mendez', jefeSuperiorId: null },
        })),
      },
      usuarios: { findFirst: vi.fn(async () => null) },
      departamentos: { findFirst: vi.fn(async () => null) },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

import { POST } from '@/app/api/solicitudes/route';

const PDF_VOBO = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).toString('base64');

const sessionDirector = {
  id: 10,
  esAdmin: false,
  esRrhh: false,
  esDirector: true,
  esJefe: true,
  esSecretarioGeneral: false,
  departamentoId: 1,
};

const sessionJefe = {
  id: 20,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: true,
  esSecretarioGeneral: false,
  departamentoId: 2,
};

const sessionEmpleado = {
  id: 30,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: false,
  esSecretarioGeneral: false,
  departamentoId: 3,
};

const payloadVacaciones = {
  usuarioId: 10,
  tipo: 'vacaciones' as const,
  fechaInicio: '2026-08-01',
  fechaFin: '2026-08-05',
  diasSolicitados: 5,
  motivo: 'Vacaciones',
};

const payloadPermisoBase = {
  usuarioId: 10,
  tipo: 'permiso_salida' as const,
  fechaInicio: '2026-08-01',
  fechaFin: '2026-08-01',
  motivo: 'Trámite personal',
};

function crearRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/solicitudes — Fase 2 (flujo Director/Secretario General)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRegistrarAuditoria.mockResolvedValue(undefined);
    mockCrearSolicitud.mockResolvedValue({
      id: 99,
      codigo: 'CNI-SOL-2026-0001',
      estado: 'pendiente_jefe',
    });
  });

  it('Director con VoBo → pendiente_rrhh (pasa directo)', async () => {
    mockGetSession.mockResolvedValue(sessionDirector);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: true,
      esSecretarioGeneral: false,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      mensajeFlujo: 'VoBo Ministro',
      pasosProceso: ['VoBo', 'RRHH'],
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        documentosAdjuntos: [{ nombre: 'vobo_ministro', data: PDF_VOBO }],
      })
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockCrearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({ esDirector: true })
    );
  });

  it('Director sin VoBo → 400', async () => {
    mockGetSession.mockResolvedValue(sessionDirector);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      esSecretarioGeneral: false,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      mensajeFlujo: 'VoBo Ministro',
      pasosProceso: ['VoBo', 'RRHH'],
    });

    const response = await POST(crearRequest(payloadVacaciones));
    expect(response.status).toBe(400);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Jefe con Director disponible → pendiente_director', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      esSecretarioGeneral: false,
      departamentoId: 2,
      departamentoNombre: 'TI',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: 'Su solicitud será enviada al Director de Área',
      pasosProceso: ['Aprobación Director', 'RRHH'],
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: 'Director TI',
    });

    // sessionJefe.id = 20 → ajustamos payload para que coincida.
    const response = await POST(
      crearRequest({ ...payloadVacaciones, usuarioId: sessionJefe.id })
    );
    expect(response.status).toBe(200);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          aprobadorSegundoNivelTipo: 'director',
          aprobadorSegundoNivelNombre: 'Director TI',
        }),
      })
    );
  });

  it('Jefe sin Director → pendiente_secretario_general', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      esSecretarioGeneral: false,
      departamentoId: 2,
      departamentoNombre: 'TI',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: true,
      pasaDirectoRrhh: false,
      mensajeFlujo: 'Esta Dirección no tiene Director. La solicitud pasará al Secretario General.',
      pasosProceso: ['Aprobación Sec. General', 'RRHH'],
      aprobadorSegundoNivelTipo: 'secretario_general',
      aprobadorSegundoNivelNombre: 'Sec. General',
    });

    const response = await POST(
      crearRequest({ ...payloadVacaciones, usuarioId: sessionJefe.id })
    );
    expect(response.status).toBe(200);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          aprobadorSegundoNivelTipo: 'secretario_general',
        }),
      })
    );
  });

  it('Empleado normal → pendiente_jefe', async () => {
    mockGetSession.mockResolvedValue(sessionEmpleado);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: false,
      esSecretarioGeneral: false,
      departamentoId: 3,
      departamentoNombre: 'Operaciones',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: 'Su solicitud será enviada a su jefe inmediato',
      pasosProceso: ['Jefe', 'Director', 'RRHH'],
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: 'Dir. OPS',
    });

    const response = await POST(
      crearRequest({ ...payloadVacaciones, usuarioId: sessionEmpleado.id })
    );
    expect(response.status).toBe(200);
  });

  it('Jefe sin Director Y sin Secretario General → 422 con error claro', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      esSecretarioGeneral: false,
      departamentoId: 99,
      departamentoNombre: 'Sin director',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo:
        'No hay Director de Área asignado al departamento ni Secretario General configurado para aprobación sustituta.',
      pasosProceso: ['No se puede crear la solicitud'],
      aprobadorSegundoNivelTipo: null,
      aprobadorSegundoNivelNombre: null,
    });

    const response = await POST(
      crearRequest({ ...payloadVacaciones, usuarioId: sessionJefe.id })
    );
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Secretario General');
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Licencia médica sin constancia sigue fallando', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      esSecretarioGeneral: false,
      departamentoId: 2,
      departamentoNombre: 'TI',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      mensajeFlujo: 'OK',
      pasosProceso: ['Director', 'RRHH'],
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: 'Director',
    });

    const response = await POST(
      crearRequest({
        usuarioId: sessionJefe.id,
        tipo: 'licencia_medica',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-03',
        diasSolicitados: 2,
        motivo: 'Reposo médico',
      })
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toMatch(/constancia médica/i);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Director + permiso_salida 1-2h sin VoBo crea solicitud', async () => {
    mockGetSession.mockResolvedValue(sessionDirector);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      esSecretarioGeneral: false,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      mensajeFlujo: 'VoBo Ministro',
      pasosProceso: ['VoBo', 'RRHH'],
    });

    const response = await POST(
      crearRequest({
        ...payloadPermisoBase,
        usuarioId: sessionDirector.id,
        duracionPermiso: '1-2h',
        horaSalida: '09:00',
        horaRegreso: '10:30',
      })
    );
    expect(response.status).toBe(200);
  });
});