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
  registrarEventoAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
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

// Adjuntos por rol (Fase 3 — VoBo obligatorio):
const adjuntoVoboDirector = {
  tipo: 'vobo_director',
  nombre: 'vobo_director.pdf',
  data: PDF_VOBO,
};
const adjuntoVoboSecretario = {
  tipo: 'vobo_secretario_general',
  nombre: 'vobo_sg.pdf',
  data: PDF_VOBO,
};
const adjuntoVoboMinistro = {
  tipo: 'vobo_ministro',
  nombre: 'vobo_ministro.pdf',
  data: PDF_VOBO,
};
const adjuntoVoboJefe = {
  tipo: 'vobo_jefe',
  nombre: 'vobo_jefe.pdf',
  data: PDF_VOBO,
};
const adjuntoConstancia = {
  tipo: 'constancia_medica',
  nombre: 'constancia.pdf',
  data: PDF_VOBO,
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
      id: sessionDirector.id,
      esDirector: true,
      esJefe: true,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      errorFlujo: false,
      mensajeFlujo: 'VoBo Ministro',
      pasosProceso: ['VoBo', 'RRHH'],
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        documentosAdjuntos: [adjuntoVoboMinistro],
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
      id: sessionDirector.id,
      esDirector: true,
      esJefe: false,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      errorFlujo: false,
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
      id: sessionJefe.id,
      esDirector: false,
      esJefe: true,
      departamentoId: 2,
      departamentoNombre: 'TI',
      jefeSuperiorId: 50,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
      mensajeFlujo: 'Su solicitud será revisada por su Director',
      pasosProceso: ['Aprobación Director', 'RRHH'],
      aprobadorInicialTipo: 'director',
      siguienteDespuesDeAprobacion: 'rrhh',
      aprobadorSegundoNivelTipo: 'director',
      aprobadorSegundoNivelNombre: 'Director TI',
    });

    // sessionJefe.id = 20 → ajustamos payload para que coincida.
    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        usuarioId: sessionJefe.id,
        documentosAdjuntos: [adjuntoVoboDirector],
      })
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

  it('Jefe sin Director → pendiente_secretario_general (Dir. SG)', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionJefe.id,
      esDirector: false,
      esJefe: true,
      departamentoId: 2,
      departamentoNombre: 'TI',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: true,
      requiereAprobacionSecretarioGeneral: true,
      pasaDirectoRrhh: false,
      errorFlujo: false,
      mensajeFlujo:
        'Su departamento no tiene Director asignado. Su solicitud será revisada por el Director de Secretaría General.',
      pasosProceso: ['Aprobación Dir. Sec. General', 'RRHH'],
      aprobadorInicialTipo: 'director_secretaria_general',
      siguienteDespuesDeAprobacion: 'rrhh',
      aprobadorSegundoNivelTipo: 'director_secretaria_general',
      aprobadorSegundoNivelNombre: 'Dir. SG',
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        usuarioId: sessionJefe.id,
        documentosAdjuntos: [adjuntoVoboSecretario],
      })
    );
    expect(response.status).toBe(200);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          aprobadorSegundoNivelTipo: 'director_secretaria_general',
        }),
      })
    );
  });

  it('Empleado normal con jefe → pendiente_jefe (sin buscar Director/SG)', async () => {
    mockGetSession.mockResolvedValue(sessionEmpleado);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionEmpleado.id,
      esDirector: false,
      esJefe: false,
      departamentoId: 3,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: 20,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
      mensajeFlujo: 'Su solicitud será revisada por su jefe superior',
      pasosProceso: ['Jefe', 'RRHH'],
      aprobadorInicialTipo: 'jefe',
      siguienteDespuesDeAprobacion: 'rrhh',
      aprobadorSegundoNivelTipo: null,
      aprobadorSegundoNivelNombre: null,
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        usuarioId: sessionEmpleado.id,
        documentosAdjuntos: [adjuntoVoboJefe],
      })
    );
    expect(response.status).toBe(200);
  });

  it('Empleado normal sin jefe → 400 controlado', async () => {
    mockGetSession.mockResolvedValue(sessionEmpleado);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionEmpleado.id,
      esDirector: false,
      esJefe: false,
      departamentoId: 3,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: true,
      mensajeFlujo:
        'El empleado no tiene jefe superior asignado. Contacte a RRHH/Admin.',
      pasosProceso: ['No se puede crear la solicitud'],
      aprobadorSegundoNivelTipo: null,
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        usuarioId: sessionEmpleado.id,
        documentosAdjuntos: [adjuntoVoboJefe],
      })
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain('jefe superior');
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Jefe sin Director Y sin Dir. SG → 400 controlado', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionJefe.id,
      esDirector: false,
      esJefe: true,
      departamentoId: 99,
      departamentoNombre: 'Sin director',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: true,
      requiereAprobacionSecretarioGeneral: true,
      pasaDirectoRrhh: false,
      errorFlujo: true,
      mensajeFlujo:
        'No hay Director asignado al departamento Secretaría General para aprobación sustituta.',
      pasosProceso: ['No se puede crear la solicitud'],
      aprobadorSegundoNivelTipo: null,
      aprobadorSegundoNivelNombre: null,
    });

    const response = await POST(
      crearRequest({
        ...payloadVacaciones,
        usuarioId: sessionJefe.id,
        documentosAdjuntos: [adjuntoVoboSecretario],
      })
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Secretaría General');
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Licencia médica sin constancia sigue fallando', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionJefe.id,
      esDirector: false,
      esJefe: true,
      departamentoId: 2,
      departamentoNombre: 'TI',
      jefeSuperiorId: 50,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
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
        // VoBo del director sí, pero falta constancia médica.
        documentosAdjuntos: [adjuntoVoboDirector],
      })
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toMatch(/constancia médica/i);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Licencia médica con VoBo + constancia crea solicitud', async () => {
    mockGetSession.mockResolvedValue(sessionJefe);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionJefe.id,
      esDirector: false,
      esJefe: true,
      departamentoId: 2,
      departamentoNombre: 'TI',
      jefeSuperiorId: 50,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: true,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
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
        documentosAdjuntos: [adjuntoVoboDirector, adjuntoConstancia],
      })
    );
    expect(response.status).toBe(200);
  });

  it('Director + permiso_salida 1-2h sin VoBo crea solicitud', async () => {
    mockGetSession.mockResolvedValue(sessionDirector);
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      id: sessionDirector.id,
      esDirector: true,
      esJefe: false,
      departamentoId: 1,
      departamentoNombre: 'Operaciones',
      jefeSuperiorId: null,
    });
    mockResolverFlujoSolicitante.mockResolvedValue({
      requiereVoBoMinistro: true,
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: true,
      errorFlujo: false,
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
        documentosAdjuntos: [adjuntoVoboMinistro],
      })
    );
    expect(response.status).toBe(200);
  });
});