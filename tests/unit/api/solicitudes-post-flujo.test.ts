import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { FLUJO_ESPECIAL_JEFE_DIR_ADMIN } from '@/lib/domain/solicitud-flujo-inicial';

const mockGetSession = vi.fn();
const mockCrearSolicitud = vi.fn();
const mockRegistrarAuditoria = vi.fn();
const mockCargarDatosFlujoSolicitante = vi.fn();

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
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      solicitudes: {
        findFirst: vi.fn(async () => ({
          id: 99,
          codigo: 'CNI-SOL-2026-0001',
          tipo: 'vacaciones',
          estado: 'aprobada_jefe',
          diasSolicitados: '5',
          usuario: { id: 10, nombre: 'Laura', apellido: 'Mendez', jefeSuperiorId: null },
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
  },
}));

import { POST } from '@/app/api/solicitudes/route';

const PDF_VOBO = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).toString('base64');

const sessionBase = {
  id: 10,
  esAdmin: false,
  esRrhh: false,
  esDirector: true,
  esJefe: true,
  departamentoId: 1,
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

describe('POST /api/solicitudes — flujo de aprobación y VoBo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(sessionBase);
    mockRegistrarAuditoria.mockResolvedValue(undefined);
    mockCrearSolicitud.mockResolvedValue({
      id: 99,
      codigo: 'CNI-SOL-2026-0001',
      estado: 'aprobada_jefe',
    });
  });

  it('Jefe Dirección Administrativa sin VoBo crea solicitud exitosamente', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Dirección Administrativa',
    });

    const response = await POST(crearRequest(payloadVacaciones));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockCrearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({
        esDirector: false,
        documentosAdjuntos: undefined,
      })
    );
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'crear',
        detalles: expect.objectContaining({
          flujoEspecial: FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
          derivadoDirectoRrhh: true,
        }),
      })
    );
  });

  it('Director normal sin VoBo falla 400', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
    });

    const response = await POST(crearRequest(payloadVacaciones));
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/VoBo del Ministro/i);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'validacion_rechazada' })
    );
  });

  it('Director normal con VoBo crea solicitud', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
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

  it('Licencia médica sin constancia sigue fallando', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Dirección Administrativa',
    });

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'licencia_medica',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-03',
        diasSolicitados: 2,
        motivo: 'Reposo médico',
      })
    );
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/constancia médica/i);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Director + permiso_salida 1-2h sin VoBo crea solicitud', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
    });

    const response = await POST(
      crearRequest({
        ...payloadPermisoBase,
        duracionPermiso: '1-2h',
        horaSalida: '09:00',
        horaRegreso: '10:30',
      })
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockCrearSolicitud).toHaveBeenCalled();
  });

  it('Director + permiso_salida medio día (2-4h) sin VoBo crea solicitud', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
    });

    const response = await POST(
      crearRequest({
        ...payloadPermisoBase,
        duracionPermiso: '2-4h',
      })
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  it('Director + permiso_salida dia_completo sin VoBo falla 400', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
    });

    const response = await POST(
      crearRequest({
        ...payloadPermisoBase,
        duracionPermiso: 'dia_completo',
        diasSolicitados: 1,
      })
    );
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/VoBo del Ministro/i);
    expect(mockCrearSolicitud).not.toHaveBeenCalled();
  });

  it('Director + permiso_salida dia_completo con VoBo crea solicitud', async () => {
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
    });

    const response = await POST(
      crearRequest({
        ...payloadPermisoBase,
        duracionPermiso: 'dia_completo',
        diasSolicitados: 1,
        documentosAdjuntos: [{ nombre: 'vobo_ministro', data: PDF_VOBO }],
      })
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  it('no exige VoBo cuando sesión tiene esDirector pero BD del solicitante no', async () => {
    mockGetSession.mockResolvedValue({
      ...sessionBase,
      esDirector: true,
    });
    mockCargarDatosFlujoSolicitante.mockResolvedValue({
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Dirección Administrativa',
    });

    const response = await POST(crearRequest(payloadVacaciones));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockCrearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({ esDirector: false })
    );
  });
});
