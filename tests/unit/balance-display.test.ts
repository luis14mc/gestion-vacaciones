import { describe, it, expect } from 'vitest';
import {
  formatDias,
  formatFechaIngreso,
  mapBalanceRegistro,
  mapBalanceToFila,
  mapBalanceToHistorialUsuario,
  mapSaldosAResumenDepartamento,
  sumarSaldos,
  validarEcuacionBalance,
  buildHistorialDesdeBalances,
} from '@/lib/domain/balance-display';

describe('balance-display', () => {
  it('formatea fecha de ingreso como DD/MM/YYYY', () => {
    expect(formatFechaIngreso('2024-03-04T00:00:00.000Z')).toBe('04/03/2024');
    expect(formatFechaIngreso('2024-01-03 00:00:00+00')).toBe('03/01/2024');
  });

  it('formatea días con dos decimales', () => {
    expect(formatDias(10.5)).toBe('10.50');
    expect(formatDias(4.166666)).toBe('4.17');
  });

  it('mapea columnas de BD al saldo institucional', () => {
    const saldo = mapBalanceRegistro({
      cantidadInicial: '10',
      cantidadAcumulada: '2.5',
      cantidadUsada: '3',
      cantidadPendiente: '1.5',
      cantidadDisponible: '8',
    });

    expect(saldo.diasVencidos).toBe(10);
    expect(saldo.diasProporcionales).toBe(2.5);
    expect(saldo.diasAsignados).toBe(12.5);
    expect(saldo.diasUsados).toBe(3);
    expect(saldo.diasPendientes).toBe(1.5);
    expect(saldo.diasDisponibles).toBe(8);
    expect(validarEcuacionBalance(saldo)).toBe(true);
  });

  it('valida disponibles = vencidos + proporcionales - usados - pendientes', () => {
    const saldo = mapBalanceRegistro({
      cantidadInicial: '15',
      cantidadAcumulada: '4',
      cantidadUsada: '5',
      cantidadPendiente: '2',
      cantidadDisponible: '12',
    });

    expect(saldo.diasDisponibles).toBe(
      saldo.diasVencidos + saldo.diasProporcionales - saldo.diasUsados - saldo.diasPendientes
    );
    expect(validarEcuacionBalance(saldo)).toBe(true);
  });

  it('mapea fila completa para vista de colaborador', () => {
    const fila = mapBalanceToFila({
      nombre: 'Luis',
      apellido: 'Martínez',
      fechaIngreso: '2024-03-04T00:00:00.000Z',
      cantidadInicial: '8',
      cantidadAcumulada: '3.75',
      cantidadUsada: '2',
      cantidadPendiente: '1',
      cantidadDisponible: '8.75',
    });

    expect(fila.colaborador).toBe('LUIS MARTÍNEZ');
    expect(fila.diasVencidos).toBe(8);
    expect(fila.diasProporcionales).toBe(3.75);
    expect(fila.diasAsignados).toBe(11.75);
    expect(fila.diasUsados).toBe(2);
    expect(fila.diasPendientes).toBe(1);
    expect(fila.diasDisponibles).toBe(8.75);
    expect(validarEcuacionBalance(fila)).toBe(true);
  });

  it('suma saldos de varios registros', () => {
    const totales = sumarSaldos([
      {
        cantidadInicial: '10',
        cantidadAcumulada: '2',
        cantidadUsada: '3',
        cantidadPendiente: '1',
        cantidadDisponible: '8',
      },
      {
        cantidadInicial: '5',
        cantidadAcumulada: '1',
        cantidadUsada: '2',
        cantidadPendiente: '0.5',
        cantidadDisponible: '3.5',
      },
    ]);

    expect(totales.diasVencidos).toBe(15);
    expect(totales.diasProporcionales).toBe(3);
    expect(totales.diasAsignados).toBe(18);
    expect(totales.diasUsados).toBe(5);
    expect(totales.diasPendientes).toBe(1.5);
    expect(totales.diasDisponibles).toBe(11.5);
    expect(validarEcuacionBalance(totales)).toBe(true);
  });

  it('expone totales con nombres del reporte departamental', () => {
    const resumen = mapSaldosAResumenDepartamento(
      mapBalanceRegistro({
        cantidadInicial: '20',
        cantidadAcumulada: '5',
        cantidadUsada: '10',
        cantidadPendiente: '2',
        cantidadDisponible: '13',
      })
    );

    expect(resumen.diasTotalesVencidos).toBe(20);
    expect(resumen.diasTotalesProporcionales).toBe(5);
    expect(resumen.diasTotalesAsignados).toBe(25);
    expect(resumen.diasTotalesUsados).toBe(10);
    expect(resumen.diasTotalesPendientes).toBe(2);
    expect(resumen.diasTotalesDisponibles).toBe(13);
  });

  it('construye historial por usuario ordenado por uso', () => {
    const usuariosMap = new Map<number, string>([
      [1, 'Ana Pérez'],
      [2, 'Bob López'],
    ]);

    const historial = buildHistorialDesdeBalances(
      [
        {
          usuarioId: 1,
          cantidadInicial: '10',
          cantidadAcumulada: '0',
          cantidadUsada: '2',
          cantidadPendiente: '0',
          cantidadDisponible: '8',
        },
        {
          usuarioId: 2,
          cantidadInicial: '8',
          cantidadAcumulada: '2',
          cantidadUsada: '5',
          cantidadPendiente: '1',
          cantidadDisponible: '4',
        },
      ],
      usuariosMap
    );

    expect(historial).toHaveLength(2);
    expect(historial[0].usuario).toBe('Bob López');
    expect(historial[0].diasVencidos).toBe(8);
    expect(historial[0].diasProporcionales).toBe(2);
    expect(validarEcuacionBalance(historial[0])).toBe(true);
  });

  it('mapea historial individual con todos los campos', () => {
    const item = mapBalanceToHistorialUsuario('Carlos Ruiz', {
      cantidadInicial: '12',
      cantidadAcumulada: '3',
      cantidadUsada: '4',
      cantidadPendiente: '1',
      cantidadDisponible: '10',
    });

    expect(item.usuario).toBe('Carlos Ruiz');
    expect(item.diasAsignados).toBe(15);
    expect(validarEcuacionBalance(item)).toBe(true);
  });
});
