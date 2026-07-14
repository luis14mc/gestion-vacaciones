import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registrarVisualizacionAdjunto } from '@/lib/solicitudes/registrar-visualizacion-adjunto';

describe('registrarVisualizacionAdjunto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('llama POST /api/solicitudes/[id]/adjuntos/[idx]/ver', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await registrarVisualizacionAdjunto(42, 1);

    expect(fetchMock).toHaveBeenCalledWith('/api/solicitudes/42/adjuntos/1/ver', {
      method: 'POST',
    });
  });

  it('no lanza si fetch falla', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(registrarVisualizacionAdjunto(1, 0)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
