import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSession = vi.fn();
const mockAutorizar = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/solicitudes/autorizar-contenido-adjunto', () => ({
  autorizarContenidoAdjunto: (...args: unknown[]) => mockAutorizar(...args),
}));

function crearGet(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const pdfBytes = Buffer.from('%PDF-1.4 test');
const autorizadoOk = {
  autorizado: true,
  solicitud: { id: 1, usuarioId: 10 },
  adjunto: { tipo: 'vobo_jefe', nombre: 'vobo.pdf' },
  mimeType: 'application/pdf',
  nombreArchivo: 'vobo.pdf',
  bytes: pdfBytes,
  acceso: {
    visualizadorEsSolicitante: false,
    visualizadorEsUploader: false,
    visualizadorEsAprobador: true,
  },
};

describe('GET /api/solicitudes/[id]/adjuntos/[idx]/contenido', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('devuelve 401 sin sesión', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    mockAutorizar.mockResolvedValueOnce({
      autorizado: false,
      status: 401,
      error: 'No autenticado',
    });
    const mod = await import(
      '@/app/api/solicitudes/[id]/adjuntos/[idx]/contenido/route'
    );
    const res = await mod.GET(crearGet('http://localhost/api/solicitudes/1/adjuntos/0/contenido'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(401);
  });

  it('sirve PDF inline con Content-Type application/pdf', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 1, esAdmin: true });
    mockAutorizar.mockResolvedValueOnce(autorizadoOk);
    const mod = await import(
      '@/app/api/solicitudes/[id]/adjuntos/[idx]/contenido/route'
    );
    const res = await mod.GET(crearGet('http://localhost/api/solicitudes/1/adjuntos/0/contenido'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('inline');
  });
});

describe('GET /api/solicitudes/[id]/adjuntos/[idx]/descargar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('sirve PDF como attachment', async () => {
    mockGetSession.mockResolvedValueOnce({ id: 1, esAdmin: true });
    mockAutorizar.mockResolvedValueOnce(autorizadoOk);
    const mod = await import(
      '@/app/api/solicitudes/[id]/adjuntos/[idx]/descargar/route'
    );
    const res = await mod.GET(crearGet('http://localhost/api/solicitudes/1/adjuntos/0/descargar'), {
      params: Promise.resolve({ id: '1', idx: '0' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });
});
