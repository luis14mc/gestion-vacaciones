import { describe, it, expect } from 'vitest';
import { contarDiasHabiles } from '@/lib/domain/labor-days';

describe('contarDiasHabiles', () => {
  it('cuenta un solo día hábil (lunes)', () => {
    expect(contarDiasHabiles('2026-06-15', '2026-06-15')).toBe(1); // lunes
  });

  it('excluye fin de semana en una semana completa', () => {
    // lunes 15 a domingo 21 de junio 2026 -> 5 días hábiles
    expect(contarDiasHabiles('2026-06-15', '2026-06-21')).toBe(5);
  });

  it('un sábado solo cuenta 0 días hábiles', () => {
    expect(contarDiasHabiles('2026-06-20', '2026-06-20')).toBe(0); // sábado
  });

  it('incluye fines de semana cuando se solicita', () => {
    expect(contarDiasHabiles('2026-06-15', '2026-06-21', true)).toBe(7);
  });

  it('devuelve 0 si fin es anterior a inicio', () => {
    expect(contarDiasHabiles('2026-06-21', '2026-06-15')).toBe(0);
  });

  it('acepta fechas ISO con hora', () => {
    expect(contarDiasHabiles('2026-06-15T10:00:00Z', '2026-06-19T18:00:00Z')).toBe(5);
  });
});
