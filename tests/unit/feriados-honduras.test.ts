import { describe, it, expect } from 'vitest';
import {
  calcularDomingoPascua,
  esFeriadoHonduras,
  obtenerFeriadosHonduras,
} from '@/lib/domain/feriados-honduras';

describe('feriados-honduras', () => {
  it('incluye feriados fijos del calendario hondureño', () => {
    const feriados = obtenerFeriadosHonduras(2026);
    expect(feriados.has('2026-01-01')).toBe(true);
    expect(feriados.has('2026-09-15')).toBe(true);
    expect(feriados.has('2026-12-25')).toBe(true);
  });

  it('incluye Jueves y Viernes Santo del año', () => {
    const feriados = obtenerFeriadosHonduras(2026);
    // Pascua 2026: 5 de abril → Jueves Santo 2 abr, Viernes Santo 3 abr
    expect(feriados.has('2026-04-02')).toBe(true);
    expect(feriados.has('2026-04-03')).toBe(true);
  });

  it('calcula domingo de Pascua correctamente', () => {
    const pascua = calcularDomingoPascua(2026);
    expect(pascua.getFullYear()).toBe(2026);
    expect(pascua.getMonth()).toBe(3); // abril (0-indexed)
    expect(pascua.getDate()).toBe(5);
  });

  it('detecta un feriado en una fecha concreta', () => {
    expect(esFeriadoHonduras('2026-09-15')).toBe(true);
    expect(esFeriadoHonduras('2026-09-16')).toBe(false);
  });

  it('incluye feriados puente (lunes anterior o siguiente)', () => {
    const feriados = obtenerFeriadosHonduras(2026);
    // 15 sep 2026 es martes → lunes 14 sep
    expect(feriados.has('2026-09-14')).toBe(true);
    // 25 dic 2026 es viernes → lunes 28 dic
    expect(feriados.has('2026-12-28')).toBe(true);
  });
});
