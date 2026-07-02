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

import { POST } from '@/app/api/solicitudes/route';

const sessionEmpleado = {
  id: 10,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: false,
  departamentoId: 1,
};

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
        'Las vacaciones deben solicitarse con al menos 5 día(s) de anticipación.'
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
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).not.toMatch(/duplicate key/);
    expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
  });
});
