import { describe, it, expect } from 'vitest';
import { formatDias, formatFechaIngreso, mapBalanceToFila } from '@/lib/domain/balance-display';

describe('balance-display', () => {
  it('formatea fecha de ingreso como DD/MM/YY', () => {
    expect(formatFechaIngreso('2024-03-04T00:00:00.000Z')).toMatch(/^04\/03\/24$/);
  });

  it('formatea días con dos decimales', () => {
    expect(formatDias(10.5)).toBe('10.50');
    expect(formatDias(4.166666)).toBe('4.17');
  });

  it('mapea campos de BD a columnas de la vista empleado', () => {
    const fila = mapBalanceToFila({
      nombre: 'Luis',
      apellido: 'Martínez',
      fechaIngreso: '2024-03-04T00:00:00.000Z',
      cantidadInicial: '8',
      cantidadAcumulada: '3.75',
      cantidadDisponible: '10.5',
    });

    expect(fila.colaborador).toBe('LUIS MARTÍNEZ');
    expect(fila.diasVencidos).toBe(8);
    expect(fila.diasProporcionales).toBe(3.75);
    expect(fila.diasDisponibles).toBe(10.5);
  });
});
