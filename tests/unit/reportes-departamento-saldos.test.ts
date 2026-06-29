import { describe, it, expect } from 'vitest';
import {
  buildHistorialDesdeBalances,
  mapSaldosAResumenDepartamento,
  sumarSaldos,
  validarEcuacionBalance,
} from '@/lib/domain/balance-display';

describe('reporte departamento — saldos', () => {
  const balancesEquipo = [
    {
      usuarioId: 101,
      cantidadInicial: '10',
      cantidadAcumulada: '2.5',
      cantidadUsada: '4',
      cantidadPendiente: '1',
      cantidadDisponible: '7.5',
    },
    {
      usuarioId: 102,
      cantidadInicial: '8',
      cantidadAcumulada: '1.5',
      cantidadUsada: '3',
      cantidadPendiente: '0.5',
      cantidadDisponible: '6',
    },
    {
      usuarioId: 103,
      cantidadInicial: '0',
      cantidadAcumulada: '0',
      cantidadUsada: '0',
      cantidadPendiente: '0',
      cantidadDisponible: '0',
    },
  ];

  it('calcula resumen departamental con todos los totales institucionales', () => {
    const totales = sumarSaldos(balancesEquipo);
    const resumen = mapSaldosAResumenDepartamento(totales);

    expect(resumen.diasTotalesVencidos).toBe(18);
    expect(resumen.diasTotalesProporcionales).toBe(4);
    expect(resumen.diasTotalesAsignados).toBe(22);
    expect(resumen.diasTotalesUsados).toBe(7);
    expect(resumen.diasTotalesPendientes).toBe(1.5);
    expect(resumen.diasTotalesDisponibles).toBe(13.5);
    expect(validarEcuacionBalance(resumen)).toBe(true);
  });

  it('valida ecuación en cada fila de historialDias / topUsuarios', () => {
    const usuariosMap = new Map<number, string>([
      [101, 'Colaborador A'],
      [102, 'Colaborador B'],
      [103, 'Colaborador C'],
    ]);

    const historial = buildHistorialDesdeBalances(balancesEquipo, usuariosMap);

    expect(historial).toHaveLength(2);
    for (const fila of historial) {
      expect(fila.diasDisponibles).toBe(
        fila.diasVencidos + fila.diasProporcionales - fila.diasUsados - fila.diasPendientes
      );
      expect(validarEcuacionBalance(fila)).toBe(true);
    }
  });

  it('excluye registros sin actividad del historial', () => {
    const usuariosMap = new Map<number, string>([[103, 'Sin saldo']]);
    const historial = buildHistorialDesdeBalances(
      [balancesEquipo[2]],
      usuariosMap
    );

    expect(historial).toHaveLength(0);
  });
});
