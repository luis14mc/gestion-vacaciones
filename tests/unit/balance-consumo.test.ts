import { describe, expect, it } from 'vitest';
import {
  calcularConsumoBalance,
  calcularDisponibleBalance,
  solicitudConsumeBalance,
} from '@/lib/domain/balance-consumo';

describe('balance-consumo', () => {
  it('identifica solicitudes que consumen balance', () => {
    expect(solicitudConsumeBalance({ tipo: 'vacaciones' })).toBe(true);
    expect(
      solicitudConsumeBalance({ tipo: 'permiso_salida', duracionPermiso: 'dia_completo' })
    ).toBe(true);
    expect(
      solicitudConsumeBalance({ tipo: 'permiso_salida', duracionPermiso: 'medio_dia' })
    ).toBe(false);
  });

  it('suma días usados y pendientes por estado', () => {
    const result = calcularConsumoBalance([
      { tipo: 'vacaciones', estado: 'aprobada_rrhh', diasSolicitados: 1 },
      { tipo: 'vacaciones', estado: 'finalizada', diasSolicitados: 2 },
      { tipo: 'vacaciones', estado: 'aprobada_jefe', diasSolicitados: 3 },
      { tipo: 'vacaciones', estado: 'pendiente_jefe', diasSolicitados: 0.5 },
      { tipo: 'permiso_salida', duracionPermiso: 'medio_dia', estado: 'aprobada_rrhh', diasSolicitados: 1 },
    ]);

    expect(result.usada).toBe(3);
    expect(result.pendiente).toBe(3.5);
  });

  it('calcula disponible neto sin negativos', () => {
    expect(calcularDisponibleBalance(12, 1, 0)).toBe(11);
    expect(calcularDisponibleBalance(12, 8, 6)).toBe(0);
  });
});
