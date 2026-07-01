import { describe, expect, it } from 'vitest';
import { normalizarFechaNacimiento } from '@/lib/domain/fecha-nacimiento';

describe('fecha de nacimiento', () => {
  const referencia = new Date('2026-06-15T12:00:00');

  it('acepta YYYY-MM-DD y DD/MM/YYYY como fecha pura', () => {
    expect(normalizarFechaNacimiento('1990-06-15', referencia).fecha).toBe('1990-06-15');
    expect(normalizarFechaNacimiento('15/06/1990', referencia).fecha).toBe('1990-06-15');
  });

  it('acepta valor vacío como null', () => {
    expect(normalizarFechaNacimiento('', referencia)).toEqual({ fecha: null });
  });

  it('rechaza fechas futuras, absurdas o inexistentes', () => {
    expect(normalizarFechaNacimiento('2027-01-01', referencia).error).toContain('futuro');
    expect(normalizarFechaNacimiento('1899-12-31', referencia).error).toContain('1900');
    expect(normalizarFechaNacimiento('2026-02-30', referencia).error).toContain('inválida');
  });
});
