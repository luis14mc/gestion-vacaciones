import { describe, it, expect } from 'vitest';
import {
  esCantidadDiasValida,
  formatDiasAlmacenamiento,
  formatDiasVisualizacion,
  parseCantidadDias,
  tieneMaxCuatroDecimales,
  validarDecimalesEnTexto,
} from '@/lib/domain/dias-decimales';

describe('dias-decimales', () => {
  it('acepta valores decimales válidos', () => {
    for (const value of [23.7, 0.5, 1.25, 12.6667]) {
      expect(esCantidadDiasValida(value)).toBe(true);
      expect(tieneMaxCuatroDecimales(value)).toBe(true);
    }
  });

  it('rechaza más de 4 decimales', () => {
    expect(esCantidadDiasValida(12.66678)).toBe(false);
    expect(validarDecimalesEnTexto('12.66678')).toBe(false);
  });

  it('rechaza negativos y no numéricos', () => {
    expect(esCantidadDiasValida(-1)).toBe(false);
    expect(parseCantidadDias('abc')).toBeNull();
    expect(parseCantidadDias('')).toBeNull();
  });

  it('no trunca 23.70 al parsear', () => {
    expect(parseCantidadDias('23.70')).toBe(23.7);
    expect(formatDiasAlmacenamiento(23.7)).toBe('23.7000');
    expect(formatDiasVisualizacion(23.7)).toBe('23.70');
  });

  it('conserva precisión en almacenamiento', () => {
    expect(formatDiasAlmacenamiento(12.6667)).toBe('12.6667');
    expect(formatDiasAlmacenamiento(0.5)).toBe('0.5000');
  });
});
