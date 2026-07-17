import { describe, it, expect } from 'vitest';
import { contarDiasHabiles } from '@/lib/domain/labor-days';

describe('contarDiasHabiles', () => {
  it('misma fecha laborable retorna 1 (inclusivo)', () => {
    // lunes 20 jul 2026
    expect(contarDiasHabiles('2026-07-20', '2026-07-20')).toBe(1);
  });

  it('dos fechas consecutivas laborables retorna 2', () => {
    // lunes 20 → martes 21 jul 2026
    expect(contarDiasHabiles('2026-07-20', '2026-07-21')).toBe(2);
  });

  it('cuenta un solo día hábil (lunes)', () => {
    expect(contarDiasHabiles('2026-06-15', '2026-06-15')).toBe(1); // lunes
  });

  it('excluye fin de semana en una semana completa', () => {
    // lunes 15 a domingo 21 de junio 2026 -> 5 días hábiles
    expect(contarDiasHabiles('2026-06-15', '2026-06-21')).toBe(5);
  });

  it('viernes a lunes excluye sábado y domingo', () => {
    // vie 17 → lun 20 jul 2026 = 2 días (vie + lun)
    expect(contarDiasHabiles('2026-07-17', '2026-07-20')).toBe(2);
  });

  it('un sábado solo cuenta 0 días hábiles', () => {
    expect(contarDiasHabiles('2026-06-20', '2026-06-20')).toBe(0); // sábado
  });

  it('devuelve 0 si fin es anterior a inicio', () => {
    expect(contarDiasHabiles('2026-06-21', '2026-06-15')).toBe(0);
  });

  it('acepta fechas ISO con hora sin cambiar el día local', () => {
    expect(contarDiasHabiles('2026-06-15T10:00:00Z', '2026-06-19T18:00:00Z')).toBe(5);
  });

  it('excluye feriados nacionales de Honduras (con puente)', () => {
    // 14 y 15 sep 2026: Independencia (mar) + puente lunes 14 → 0 días hábiles
    expect(contarDiasHabiles('2026-09-14', '2026-09-15')).toBe(0);
    // 16 sep 2026: miércoles hábil
    expect(contarDiasHabiles('2026-09-16', '2026-09-16')).toBe(1);
  });
});
