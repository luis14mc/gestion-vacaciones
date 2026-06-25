import { describe, it, expect } from 'vitest';
import {
  calcularElegibilidadCumpleanos,
  esMesCumpleanos,
  nombreMes,
  obtenerMesCumpleanos,
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
    const result = validarFechaSolicitudCumpleanos('1990-06-15', '2025-06-10');
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
});
