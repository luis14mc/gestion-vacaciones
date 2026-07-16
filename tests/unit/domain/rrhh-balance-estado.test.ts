import { describe, it, expect } from 'vitest';
import {
  resolverEstadoAsignacionMesActual,
  validarConsistenciaBalance,
} from '@/lib/domain/rrhh-balance-estado';

describe('validarConsistenciaBalance', () => {
  it('retorna consistente true cuando la ecuación institucional cuadra', () => {
    const result = validarConsistenciaBalance({
      cantidadInicial: '10',
      cantidadAcumulada: '5',
      cantidadUsada: '3',
      cantidadPendiente: '2',
      cantidadDisponible: '10',
    });
    expect(result.consistente).toBe(true);
    expect(result.diferencia).toBe(0);
    expect(result.mensaje).toBeNull();
  });

  it('retorna consistente false cuando disponible no coincide', () => {
    const result = validarConsistenciaBalance({
      cantidadInicial: '10',
      cantidadAcumulada: '5',
      cantidadUsada: '3',
      cantidadPendiente: '2',
      cantidadDisponible: '9',
    });
    expect(result.consistente).toBe(false);
    expect(result.diferencia).not.toBe(0);
    expect(result.mensaje).toBe('El balance no coincide con la regla institucional.');
  });
});

describe('resolverEstadoAsignacionMesActual', () => {
  const ref = new Date('2026-07-15T12:00:00Z');

  it('usuario con menos de 1 año aparece como no_aplica', () => {
    expect(
      resolverEstadoAsignacionMesActual({
        activo: true,
        eliminado: false,
        fechaIngreso: '2025-08-01',
        tieneAsignacionMesActual: false,
        balanceConsistente: true,
        fechaReferencia: ref,
      })
    ).toBe('no_aplica');
  });

  it('usuario activo con antigüedad >= 1 año sin asignación del mes aparece pendiente', () => {
    expect(
      resolverEstadoAsignacionMesActual({
        activo: true,
        eliminado: false,
        fechaIngreso: '2024-01-01',
        tieneAsignacionMesActual: false,
        balanceConsistente: true,
        fechaReferencia: ref,
      })
    ).toBe('pendiente');
  });

  it('usuario con asignación del mes aparece asignado', () => {
    expect(
      resolverEstadoAsignacionMesActual({
        activo: true,
        eliminado: false,
        fechaIngreso: '2024-01-01',
        tieneAsignacionMesActual: true,
        balanceConsistente: true,
        fechaReferencia: ref,
      })
    ).toBe('asignado');
  });

  it('balance inconsistente fuerza estado inconsistente', () => {
    expect(
      resolverEstadoAsignacionMesActual({
        activo: true,
        eliminado: false,
        fechaIngreso: '2024-01-01',
        tieneAsignacionMesActual: true,
        balanceConsistente: false,
        fechaReferencia: ref,
      })
    ).toBe('inconsistente');
  });

  it('usuario inactivo aparece como no_aplica', () => {
    expect(
      resolverEstadoAsignacionMesActual({
        activo: false,
        eliminado: false,
        fechaIngreso: '2020-01-01',
        tieneAsignacionMesActual: false,
        balanceConsistente: true,
        fechaReferencia: ref,
      })
    ).toBe('no_aplica');
  });
});
