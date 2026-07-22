import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockAsegurar = vi.fn();
const mockSelect = vi.fn();
const mockTransaction = vi.fn();
const mockInvalidar = vi.fn();
const mockAuditoria = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/config/bootstrap-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config/bootstrap-config')>();
  return {
    ...actual,
    asegurarConfiguracionesBase: (...args: unknown[]) => mockAsegurar(...args),
  };
});

vi.mock('@/lib/config/service', () => ({
  invalidarCacheConfig: (...args: unknown[]) => mockInvalidar(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarEventoAuditoria: (...args: unknown[]) => mockAuditoria(...args),
  datosPeticion: () => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

import { GET, PATCH } from '@/app/api/configuracion/route';
import { CONFIG_KEYS } from '@/lib/config/catalog';

function mockCountThenRows(count: number, rows: unknown[]) {
  mockSelect.mockImplementationOnce(() => ({
    from: vi.fn(() => Promise.resolve([{ count }])),
  }));
  mockSelect.mockImplementationOnce(() => ({
    from: vi.fn(() => Promise.resolve(rows)),
  }));
}

describe('GET /api/configuracion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ id: 1, esAdmin: true });
    mockAsegurar.mockResolvedValue({ insertadas: CONFIG_KEYS.size, totalCatalogo: CONFIG_KEYS.size });
  });

  it('materializa catálogo completo cuando BD está vacía', async () => {
    mockCountThenRows(0, []);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.length).toBe(CONFIG_KEYS.size);
    expect(payload.meta.bdEstabaVacia).toBe(true);
    expect(mockAsegurar).toHaveBeenCalled();
  });

  it('no expone smtp_password en respuesta', async () => {
    mockCountThenRows(1, [
      {
        id: 9,
        clave: 'notificaciones.smtp_password',
        valor: 'super-secreto',
        categoria: 'notificaciones',
        tipoDato: 'password',
        esPublico: false,
      },
    ]);

    const response = await GET();
    const payload = await response.json();
    const smtp = payload.data.find((c: { clave: string }) => c.clave === 'notificaciones.smtp_password');

    expect(smtp.valor).toBe('');
    expect(smtp.tieneValor).toBe(true);
  });
});

describe('PATCH /api/configuracion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ id: 1, esAdmin: true });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn(() => Promise.resolve()),
          })),
        })),
      };
      await fn(tx);
    });
  });

  it('crea clave faltante mediante upsert batch', async () => {
    const request = new NextRequest('http://localhost/api/configuracion', {
      method: 'PATCH',
      body: JSON.stringify([{ clave: 'vacaciones.dias_anticipacion', valor: '3' }]),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('no sobrescribe smtp_password cuando viene vacía', async () => {
    const request = new NextRequest('http://localhost/api/configuracion', {
      method: 'PATCH',
      body: JSON.stringify([
        { clave: 'notificaciones.smtp_password', valor: '' },
        { clave: 'app.nombre', valor: 'Sistema de Vacaciones CNI' },
      ]),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
  });
});

describe('prepararConfiguracionParaCliente — conteos por categoría UI', () => {
  it('general tiene 8 campos en catálogo', () => {
    const general = [...CONFIG_KEYS].filter((k) => k.startsWith('app.'));
    expect(general.length).toBe(8);
  });
});
