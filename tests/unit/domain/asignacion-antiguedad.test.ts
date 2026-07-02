import { describe, it, expect } from "vitest";
import {
  REGLAS_ASIGNACION_ANTIGUEDAD,
  calcularAnosCompletados,
  calcularDiasSegunAntiguedad,
} from "@/lib/domain/asignacion-antiguedad";

describe("asignacion-antiguedad", () => {
  it("expone las cinco reglas esperadas", () => {
    expect(REGLAS_ASIGNACION_ANTIGUEDAD).toHaveLength(5);
    expect(REGLAS_ASIGNACION_ANTIGUEDAD.map((r) => r.dias)).toEqual([0, 10, 12, 15, 20]);
  });

  it("asigna 0 días con menos de un año cumplido", () => {
    const hoy = new Date("2026-06-19");
    expect(calcularDiasSegunAntiguedad("2025-12-01", hoy)).toBe(0);
    expect(calcularAnosCompletados("2025-12-01", hoy)).toBe(0);
  });

  it("asigna días según años cumplidos", () => {
    const hoy = new Date("2026-06-19");

    expect(calcularDiasSegunAntiguedad("2025-06-19", hoy)).toBe(10);
    expect(calcularDiasSegunAntiguedad("2024-06-19", hoy)).toBe(12);
    expect(calcularDiasSegunAntiguedad("2023-06-19", hoy)).toBe(15);
    expect(calcularDiasSegunAntiguedad("2020-01-01", hoy)).toBe(20);
  });
});
