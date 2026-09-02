import { describe, it, expect } from 'vitest';
import {
  calcularDiasAnualesPorAntiguedad,
  calcularDiasMensualesPorAntiguedad,
  calcularAntiguedadLaboral,
  resolverMesAsignacion,
  esDiaDeAsignacionMensual,
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
    it('primer año en curso (< 1 cumplido) → 10 en devengo', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2026, 1, 1), ref)).toBe(10);
    });

    it('antes de la fecha de ingreso → 0', () => {
      const ref = new Date(2025, 11, 31);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2026, 1, 1), ref)).toBe(0);
    });

    it('1 año cumplido → devenga tramo del 2.º año (12)', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2025, 7, 15), ref)).toBe(12);
    });

    it('2 años cumplidos → devenga tramo del 3.er año (15)', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2024, 7, 15), ref)).toBe(15);
    });

    it('3 años cumplidos → devenga tramo del 4.º año (20)', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2023, 7, 15), ref)).toBe(20);
    });

    it('4 años cumplidos → devenga tramo del 5.º año (20)', () => {
      const ref = new Date(2026, 6, 30);
      expect(calcularDiasAnualesPorAntiguedad(fechaIngreso(2022, 7, 15), ref)).toBe(20);
    });

    it('fechaIngreso null → 0', () => {
      expect(calcularDiasAnualesPorAntiguedad(null)).toBe(0);
    });
  });

  describe('calcularDiasMensualesPorAntiguedad', () => {
    const ref = new Date(2026, 6, 30);

    it('primer año en curso → 0.8333 mensual', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2026, 1, 1), ref)).toBe(0.8333);
    });

    it('1 año cumplido → 1.0000 (tramo 2.º año)', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2025, 7, 15), ref)).toBe(1);
    });

    it('2 años cumplidos → 1.2500 (tramo 3.er año)', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2024, 7, 15), ref)).toBe(1.25);
    });

    it('3 años cumplidos → 1.6667 (tramo 4.º año)', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2023, 7, 15), ref)).toBe(1.6667);
    });

    it('4 años cumplidos → 1.6667 (tramo 5.º año)', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2022, 7, 15), ref)).toBe(1.6667);
    });

    it('empleado en primer año devenga mensualmente', () => {
      expect(calcularDiasMensualesPorAntiguedad(fechaIngreso(2025, 12, 1), ref)).toBe(0.8333);
    });
  });

  describe('resolverMesAsignacion', () => {
    it('caso primer año en curso: asignable con 0.8333', () => {
      const r = resolverMesAsignacion({
        fechaIngreso: fechaIngreso(2026, 1, 15),
        anio: 2026,
        mes: 8,
        fechaReferencia: new Date(2026, 7, 15),
      });
      expect(r.aniosCumplidos).toBe(0);
      expect(r.diasAnuales).toBe(10);
      expect(r.diasMensuales).toBe(0.8333);
      expect(r.asignable).toBe(true);
    });

    it('caso 1 año cumplido: devenga tramo 2.º año (12 / 12)', () => {
      const r = resolverMesAsignacion({
        fechaIngreso: fechaIngreso(2025, 7, 15),
        anio: 2026,
        mes: 7,
        fechaReferencia: new Date(2026, 6, 30),
      });
      expect(r.aniosCumplidos).toBe(1);
      expect(r.diasAnuales).toBe(12);
      expect(r.diasMensuales).toBe(1);
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

  describe('esDiaDeAsignacionMensual (día de aniversario)', () => {
    it('acredita el mismo día del mes que el ingreso', () => {
      // Ingreso el 04; hoy es 04 → sí.
      expect(
        esDiaDeAsignacionMensual('2024-03-04', new Date(2026, 7, 4))
      ).toBe(true);
    });

    it('no acredita en días distintos al de ingreso', () => {
      expect(
        esDiaDeAsignacionMensual('2024-03-04', new Date(2026, 7, 3))
      ).toBe(false);
      expect(
        esDiaDeAsignacionMensual('2024-03-04', new Date(2026, 7, 5))
      ).toBe(false);
    });

    it('ingreso el 31: en un mes de 30 días acredita el 30', () => {
      // Ingreso el 31; abril tiene 30 días → acredita el 30, no antes.
      expect(
        esDiaDeAsignacionMensual('2023-01-31', new Date(2026, 3, 30))
      ).toBe(true);
      expect(
        esDiaDeAsignacionMensual('2023-01-31', new Date(2026, 3, 29))
      ).toBe(false);
    });

    it('ingreso el 31: en febrero (28 días) acredita el 28', () => {
      expect(
        esDiaDeAsignacionMensual('2023-01-31', new Date(2026, 1, 28))
      ).toBe(true);
    });

    it('sin fecha de ingreso: nunca acredita', () => {
      expect(esDiaDeAsignacionMensual(null, new Date(2026, 7, 4))).toBe(false);
      expect(esDiaDeAsignacionMensual(undefined, new Date(2026, 7, 4))).toBe(
        false
      );
    });
  });

  describe('REGLAS_ASIGNACION_MENSUAL_VACACIONES (catálogo UI)', () => {
    it('expone las 5 reglas de antigüedad', () => {
      expect(REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas).toHaveLength(5);
      const r0 = REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas[0];
      expect(r0).toMatchObject({ aniosCumplidos: 0, diasAnuales: 10, diasMensuales: 0.8333 });
      const r1 = REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas[1];
      expect(r1).toMatchObject({ aniosCumplidos: 1, diasAnuales: 12, diasMensuales: 1.0 });
      const r4 = REGLAS_ASIGNACION_MENSUAL_VACACIONES.reglas[4];
      expect(r4).toMatchObject({ aniosCumplidos: 4, diasAnuales: 20, diasMensuales: 1.6667 });
    });
  });
});