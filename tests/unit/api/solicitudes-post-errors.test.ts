import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockCrearSolicitud = vi.fn();
const mockRegistrarAuditoria = vi.fn();

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

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      solicitudes: { findFirst: vi.fn() },
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

vi.mock('@/lib/domain/solicitud-flujo-solicitante', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/domain/solicitud-flujo-solicitante')>();
  return {
    ...actual,
    cargarDatosFlujoSolicitante: vi.fn(async () => ({
      id: 10,
      esDirector: false,
      esJefe: false,
      departamentoId: 1,
      departamentoNombre: 'Tecnología',
      jefeSuperiorId: 20,
    })),
    resolverFlujoSolicitante: vi.fn(async () => ({
      requiereVoBoMinistro: false,
      requiereAprobacionJefe: true,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereAprobacionSecretarioGeneral: false,
      pasaDirectoRrhh: false,
      errorFlujo: false,
      mensajeFlujo: 'OK',
      pasosProceso: ['Jefe', 'RRHH'],
      aprobadorInicialTipo: 'jefe',
      siguienteDespuesDeAprobacion: 'rrhh',
      aprobadorSegundoNivelTipo: null,
      aprobadorSegundoNivelNombre: null,
    })),
  };
});

import { POST } from '@/app/api/solicitudes/route';

const sessionEmpleado = {
  id: 10,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: false,
  esSecretarioGeneral: false,
  departamentoId: 1,
};

// PDF válido (firma %PDF-1.4) en base64 para satisfacer la validación
// de VoBo institucional obligatoria (Fase 3).
const PDF_B64 = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).toString('base64');
const adjuntoVoBoJefe = { tipo: 'vobo_jefe', nombre: 'vobo_jefe.pdf', data: PDF_B64 };

function crearRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/solicitudes — errores de negocio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(sessionEmpleado);
    mockRegistrarAuditoria.mockResolvedValue(undefined);
  });

  it('devuelve 400 cuando faltan días de anticipación (no 500)', async () => {
    mockCrearSolicitud.mockRejectedValue(
      new Error(
        'Debe solicitar con al menos 5 día(s) de anticipación. Fecha mínima permitida: 22/07/2026.'
      )
    );

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'vacaciones',
        fechaInicio: '2026-07-10',
        fechaFin: '2026-07-14',
        diasSolicitados: 5,
        motivo: 'Vacaciones',
        documentosAdjuntos: [adjuntoVoBoJefe],
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/anticipación/);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'validacion_rechazada' })
    );
  });

  it('devuelve 400 cuando hay superposición de fechas (no 500)', async () => {
    mockCrearSolicitud.mockRejectedValue(
      new Error(
        'Ya tiene una solicitud activa que se superpone con las fechas seleccionadas.'
      )
    );

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'vacaciones',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-05',
        diasSolicitados: 5,
        motivo: 'Vacaciones',
        documentosAdjuntos: [adjuntoVoBoJefe],
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/superpone/);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'validacion_rechazada' })
    );
  });

  it('devuelve 400 para cumpleaños inválido (no 500)', async () => {
    // El flujo de cumpleaños también requiere VoBo en Fase 3.
    mockCrearSolicitud.mockRejectedValue(
      new Error('Ya utilizó su día libre por cumpleaños este año.')
    );

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'dia_cumpleanos',
        fechaInicio: '2026-07-15',
        fechaFin: '2026-07-15',
        diasSolicitados: 1,
        documentosAdjuntos: [adjuntoVoBoJefe],
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/cumpleaños/);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'validacion_rechazada',
        detalles: expect.objectContaining({ tipo: 'dia_cumpleanos' }),
      })
    );
  });

  it('devuelve 500 para errores técnicos no clasificados como negocio', async () => {
    mockCrearSolicitud.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
      })
    );

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'vacaciones',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-05',
        diasSolicitados: 5,
        motivo: 'Vacaciones',
        documentosAdjuntos: [adjuntoVoBoJefe],
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).not.toMatch(/duplicate key/);
    expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
  });
});
