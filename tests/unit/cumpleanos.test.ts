import { describe, it, expect } from 'vitest';
import {
  calcularElegibilidadCumpleanos,
  esMesCumpleanos,
  nombreMes,
  obtenerLimitesMesCumpleanos,
  obtenerMesCumpleanos,
  validarEstructuraSolicitudCumpleanos,
  validarFechaSolicitudCumpleanos,
} from '@/lib/domain/cumpleanos';

describe('cumpleanos', () => {
  it('obtiene el mes de cumpleaños desde la fecha de nacimiento', () => {
    expect(obtenerMesCumpleanos('1990-06-15')).toBe(6);
    expect(nombreMes(6)).toBe('junio');
  });

  it('detecta si estamos en el mes de cumpleaños', () => {
    const referencia = new Date('2026-06-10T12:00:00');
    expect(esMesCumpleanos('1990-06-15', referencia)).toBe(true);
    expect(esMesCumpleanos('1990-03-15', referencia)).toBe(false);
  });

  it('rechaza solicitudes fuera del mes de cumpleaños', () => {
    const result = validarFechaSolicitudCumpleanos('1990-06-15', '2026-03-10');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('junio');
  });

  it('rechaza solicitudes de otro año', () => {
    const result = validarFechaSolicitudCumpleanos(
      '1990-06-15',
      '2025-06-10',
      new Date('2026-06-10T12:00:00')
    );
    expect(result.valido).toBe(false);
    expect(result.error).toContain('año en curso');
  });

  it('acepta solicitudes en el mes y año en curso', () => {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const mesStr = String(mes).padStart(2, '0');
    const result = validarFechaSolicitudCumpleanos(
      `1990-${mesStr}-15`,
      `${anio}-${mesStr}-20`
    );
    expect(result.valido).toBe(true);
  });

  it('calcula elegibilidad cuando puede solicitar en su mes', () => {
    const referencia = new Date('2026-06-10T12:00:00');
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: false,
      referencia,
    });

    expect(elegibilidad.puedeSolicitar).toBe(true);
    expect(elegibilidad.nombreMesCumpleanos).toBe('junio');
  });

  it('bloquea cuando ya tomó el día del año', () => {
    const referencia = new Date('2026-06-10T12:00:00');
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: true,
      referencia,
    });

    expect(elegibilidad.puedeSolicitar).toBe(false);
    expect(elegibilidad.yaTomado).toBe(true);
  });

  it('bloquea sin fecha de nacimiento registrada', () => {
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: null,
      yaTomado: false,
    });

    expect(elegibilidad.puedeSolicitar).toBe(false);
    expect(elegibilidad.tieneFechaNacimiento).toBe(false);
  });

  it('bloquea fuera del mes aunque no haya tomado el día', () => {
    const referencia = new Date('2026-03-10T12:00:00');
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: false,
      referencia,
    });

    expect(elegibilidad.puedeSolicitar).toBe(false);
    expect(elegibilidad.esMesActual).toBe(false);
  });

  it('devuelve el rango completo del mes de cumpleaños', () => {
    expect(obtenerLimitesMesCumpleanos(2, 2024)).toEqual({
      fechaMinimaPermitida: '2024-02-01',
      fechaMaximaPermitida: '2024-02-29',
    });
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: false,
      referencia: new Date('2026-06-10T12:00:00'),
    });
    expect(elegibilidad.fechaNacimiento).toBe('1990-06-15');
    expect(elegibilidad.anio).toBe(2026);
    expect(elegibilidad.fechaMinimaPermitida).toBe('2026-06-01');
    expect(elegibilidad.fechaMaximaPermitida).toBe('2026-06-30');
  });

  it('exige exactamente un día y la misma fecha de inicio y fin', () => {
    expect(validarEstructuraSolicitudCumpleanos({
      fechaInicio: '2026-06-10',
      fechaFin: '2026-06-11',
      diasSolicitados: 1,
    }).valido).toBe(false);
    expect(validarEstructuraSolicitudCumpleanos({
      fechaInicio: '2026-06-10',
      fechaFin: '2026-06-10',
      diasSolicitados: 2,
    }).valido).toBe(false);
    expect(validarEstructuraSolicitudCumpleanos({
      fechaInicio: '2026-06-10',
      fechaFin: '2026-06-10',
      diasSolicitados: 1,
    }).valido).toBe(true);
  });

  it('no permite solicitar anticipadamente desde otro mes', () => {
    const result = validarFechaSolicitudCumpleanos(
      '1990-06-15',
      '2026-06-20',
      new Date('2026-05-20T12:00:00')
    );
    expect(result.valido).toBe(false);
    expect(result.error).toContain('junio');
  });
});
