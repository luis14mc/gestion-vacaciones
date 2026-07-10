import { describe, it, expect } from 'vitest';
import {
  calcularDiasAnualesPorAntiguedad,
  calcularDiasMensualesPorAntiguedad,
  calcularAntiguedadLaboral,
  resolverMesAsignacion,
  REGLAS_ASIGNACION_MENSUAL_VACACIONES,
} from '@/lib/domain/vacaciones-asignacion';

function fechaIngreso(anio: number, mes: number, dia = 15): string {
  // Construye una fecha de ingreso en formato ISO a una hora neutra.
  const m = String(mes).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${anio}-${m}-${d}T00:00:00.000Z`;
}

describe('vacaciones-asignacion — Fase 5', () => {
  describe('calcularAntiguedadLaboral', () => {
    it('0 años cumplidos al inicio', () => {
      const ref = new Date(2026, 6, 30); // fin de julio 2026
      expect(calcularAntiguedadLaboral(fechaIngreso(2026, 6, 20), ref)).toBe(0);
    });

    it('1 año cumplido exacto', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularAntiguedadLaboral(fechaIngreso(2025, 7, 15), ref)).toBe(1);
    });

    it('4 años cumplidos', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularAntiguedadLaboral(fechaIngreso(2022, 7, 15), ref)).toBe(4);
    });
  });

  describe('calcularDiasAnualesPorAntiguedad', () => {
    it('< 1 año → 0', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2026, 1, 1), ref)).toBe(0);
    });

    it('1 año → 10', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2025, 7, 15), ref)).toBe(10);
    });

    it('2 años → 12', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2024, 7, 15), ref)).toBe(12);
    });

    it('3 años → 15', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2023, 7, 15), ref)).toBe(15);
    });

    it('4 años → 20', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2022, 7, 15), ref)).toBe(20);
    });

    it('fechaIngreso null → 0', () => {
      expect(calcularDiasAnualesPorAntiguedad(null)).toBe(0);
    });
  });

  describe('calcularDiasMensualesPorAntiguedad', () => {
    const ref = new Date(2026, 6, 30);

    it('< 1 año → 0', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2026, 1, 1), ref)).toBe(0);
    });

    it('1 año → 0.8333', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2025, 7, 15), ref)).toBe(0.8333);
    });

    it('2 años → 1.0000', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2024, 7, 15), ref)).toBe(1);
    });

    it('3 años → 1.2500', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2023, 7, 15), ref)).toBe(1.25);
    });

    it('4 años → 1.6667', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2022, 7, 15), ref)).toBe(1.6667);
    });

    it('no asigna < 1 año aunque tenga fecha lejana', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2025, 12, 1), ref)).toBe(0);
    });
  });

  describe('resolverMesAsignacion', () => {
    it('caso 1 año con todos los campos', () => {
      const r = resolverMesAsignacion({
        fechaIngreso: fechaIngreso(2025, 7, 15),
        anio: 2026,
        mes: 7,
        fechaReferencia: new Date(2026, 6, 30),
      });
      expect(r.aniosCumplidos).toBe(1);
      expect(r.diasAnuales).toBe(10);
      expect(r.diasMensuales).toBe(0.8333);
      expect(r.mes).toBe(7);
      expect(r.anio).toBe(2026);
      expect(r.asignable).toBe(true);
    });

    it('caso 4 años: 1.6667', () => {
      const r = resolverMesAsignacion({
        fechaIngreso: fechaIngreso(2022, 7, 15),
        anio: 2026,
        mes: 7,
        fechaReferencia: new Date(2026, 6, 30),
      });
      expect(r.diasMensuales).toBe(1.6667);
      expect(r.asignable).toBe(true);
    });

    it('caso sin fecha de ingreso: no asignable', () => {
      const r = resolverMesAsignacion({
        fechaIngreso: null,
        anio: 2026,
        mes: 7,
      });
      expect(r.asignable).toBe(false);
      expect(r.diasMensuales).toBe(0);
    });
  });

  describe('REGLAS_ASIGNACION_MENSUAL_VACACIONES (catálogo UI)', () => {
    it('expone las 5 reglas de antigüedad', () => {
      expect(REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas).toHaveLength(5);
      const r1 = REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas[0];
      expect(r1).toMatchObject({ aniosCumplidos: 0, diasAnuales: 0 });
      const r4 = REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas[3];
      expect(r4).toMatchObject({ aniosCumplidos: 3, diasAnuales: 15 });
    });
  });
});