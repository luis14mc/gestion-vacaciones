import { describe, it, expect } from 'vitest';
import {
  enriquecerAdjuntosConNombresSubidor,
  extraerIdsUploadersDeSolicitudes,
} from '@/lib/domain/solicitud-adjuntos-display';

describe('solicitud-adjuntos-display', () => {
  it('extrae IDs de uploadedBy de varias solicitudes', () => {
    const ids = extraerIdsUploadersDeSolicitudes([
      {
        documentosAdjuntos: [{ uploadedBy: 3, data: 'x' }, { uploadedBy: 7 }],
      },
      {
        documentosAdjuntos: [{ uploadedBy: 7, data: 'y' }],
      },
    ]);
    expect(ids.sort()).toEqual([3, 7]);
  });

  it('enriquece adjuntos con uploadedByNombre', () => {
    const map = new Map<number, string>([[5, 'Carlos Pérez']]);
    const out = enriquecerAdjuntosConNombresSubidor(
      [{ tipo: 'vobo_jefe', uploadedBy: 5, data: 'data:...' }],
      map
    ) as Array<{ uploadedByNombre?: string }>;

    expect(out[0].uploadedByNombre).toBe('Carlos Pérez');
  });
});
