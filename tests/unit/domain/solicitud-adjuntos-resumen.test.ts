import { describe, it, expect } from 'vitest';
import {
  obtenerResumenAdjuntos,
  adjuntosIncluyenContenido,
} from '@/lib/domain/solicitud-adjuntos-resumen';

describe('solicitud-adjuntos-resumen', () => {
  it('devuelve metadata vacía sin adjuntos', () => {
    expect(obtenerResumenAdjuntos(null)).toEqual({
      tieneAdjuntos: false,
      cantidadAdjuntos: 0,
      tiposAdjuntos: [],
      nombresAdjuntos: [],
    });
  });

  it('extrae tipos y nombres sin incluir data', () => {
    const resumen = obtenerResumenAdjuntos([
      { tipo: 'vobo_ministro', nombre: 'vobo.pdf', data: 'data:application/pdf;base64,ABC' },
      { nombre: 'constancia_medica', data: 'data:image/png;base64,XYZ' },
    ]);

    expect(resumen).toEqual({
      tieneAdjuntos: true,
      cantidadAdjuntos: 2,
      tiposAdjuntos: ['vobo_ministro', 'constancia_medica'],
      nombresAdjuntos: ['vobo.pdf', 'constancia_medica'],
    });
    expect(JSON.stringify(resumen)).not.toContain('base64');
  });

  it('detecta contenido embebido en adjuntos', () => {
    expect(adjuntosIncluyenContenido([{ data: 'data:...' }])).toBe(true);
    expect(adjuntosIncluyenContenido([{ nombre: 'vobo.pdf' }])).toBe(false);
    expect(adjuntosIncluyenContenido([])).toBe(false);
  });
});
