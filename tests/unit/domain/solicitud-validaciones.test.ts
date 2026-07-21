import { describe, it, expect } from 'vitest';
import {
  calcularFechaMinimaSolicitud,
  esFinDeSemana,
  tipoDescuentaSaldo,
  validarAnticipacionMinima,
  validarFechaNoPasada,
  validarHorasPermisoSalida,
  validarOrdenFechas,
  validarRangoSinFinDeSemana,
  validarReglasFechasSolicitud,
} from '@/lib/domain/solicitud-validaciones';

describe('solicitud-validaciones', () => {
  const hoy = new Date(2026, 6, 17); // 17/07/2026 viernes

  describe('calcularFechaMinimaSolicitud', () => {
    it('con dias_anticipacion=2 la fecha mínima es hoy + 2 días (inclusive)', () => {
      expect(calcularFechaMinimaSolicitud(hoy, 2)).toBe('2026-07-19');
    });

    it('con dias_anticipacion=0 la fecha mínima es hoy', () => {
      expect(calcularFechaMinimaSolicitud(hoy, 0)).toBe('2026-07-17');
    });
  });

  describe('validarAnticipacionMinima', () => {
    it('rechaza un día antes de la fecha mínima', () => {
      const result = validarAnticipacionMinima('2026-07-18', 2, hoy);
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/anticipación/);
      expect(result.error).toMatch(/19\/07\/2026/);
    });

    it('acepta la fecha mínima exacta', () => {
      const result = validarAnticipacionMinima('2026-07-19', 2, hoy);
      expect(result.valido).toBe(true);
    });

    it('acepta fechas posteriores a la mínima', () => {
      const result = validarAnticipacionMinima('2026-07-22', 2, hoy);
      expect(result.valido).toBe(true);
    });
  });

  describe('validarFechaNoPasada', () => {
    it('rechaza fechas anteriores a hoy', () => {
      const result = validarFechaNoPasada('2026-07-16', hoy);
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/fechas anteriores/);
    });
  });

  describe('esFinDeSemana y validarRangoSinFinDeSemana', () => {
    it('detecta sábado', () => {
      expect(esFinDeSemana('2026-07-18')).toBe(true);
    });

    it('detecta domingo', () => {
      expect(esFinDeSemana('2026-07-19')).toBe(true);
    });

    it('permiso_salida en sábado falla', () => {
      const result = validarRangoSinFinDeSemana('permiso_salida', '2026-07-18', '2026-07-18');
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/sábado o domingo/);
    });

    it('lunes laboral pasa', () => {
      const result = validarRangoSinFinDeSemana('permiso_salida', '2026-07-20', '2026-07-20');
      expect(result.valido).toBe(true);
    });

    it('licencia_medica permite fin de semana', () => {
      const result = validarRangoSinFinDeSemana('licencia_medica', '2026-07-18', '2026-07-19');
      expect(result.valido).toBe(true);
    });

    it('vacaciones con rango que incluye sábado falla', () => {
      const result = validarRangoSinFinDeSemana('vacaciones', '2026-07-17', '2026-07-20');
      expect(result.valido).toBe(false);
    });
  });

  describe('validarHorasPermisoSalida', () => {
    it('08:00 a 09:00 válido para 1-2h', () => {
      expect(validarHorasPermisoSalida('1-2h', '08:00', '09:00').valido).toBe(true);
    });

    it('08:00 a 10:00 válido para 1-2h', () => {
      expect(validarHorasPermisoSalida('1-2h', '08:00', '10:00').valido).toBe(true);
    });

    it('08:00 a 10:30 inválido para 1-2h', () => {
      const result = validarHorasPermisoSalida('1-2h', '08:00', '10:30');
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/no puede exceder 2 horas/);
    });

    it('13:00 a 12:00 inválido', () => {
      const result = validarHorasPermisoSalida('1-2h', '13:00', '12:00');
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/posterior a la hora de salida/);
    });

    it('medio día no puede exceder 4 horas', () => {
      const result = validarHorasPermisoSalida('2-4h', '08:00', '13:00');
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/no puede exceder 4 horas/);
    });

    it('día completo no requiere horas', () => {
      expect(validarHorasPermisoSalida('dia_completo', undefined, undefined).valido).toBe(true);
    });
  });

  describe('tipoDescuentaSaldo', () => {
    it('1-2h no descuenta', () => {
      expect(tipoDescuentaSaldo('permiso_salida', '1-2h')).toBe(false);
    });

    it('medio día no descuenta', () => {
      expect(tipoDescuentaSaldo('permiso_salida', '2-4h')).toBe(false);
    });

    it('día completo descuenta', () => {
      expect(tipoDescuentaSaldo('permiso_salida', 'dia_completo')).toBe(true);
    });
  });

  describe('validarReglasFechasSolicitud — orden', () => {
    it('fecha pasada devuelve error de fecha, no de saldo', () => {
      const result = validarReglasFechasSolicitud({
        tipo: 'vacaciones',
        fechaInicio: '2026-07-16',
        fechaFin: '2026-07-20',
        diasAnticipacion: 0,
        hoy,
      });
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/fechas anteriores/);
    });

    it('anticipación insuficiente devuelve error de anticipación', () => {
      const result = validarReglasFechasSolicitud({
        tipo: 'permiso_salida',
        fechaInicio: '2026-07-18',
        duracionPermiso: '1-2h',
        horaSalida: '08:00',
        horaRegreso: '09:00',
        diasAnticipacion: 2,
        hoy,
      });
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/anticipación/);
    });

    it('fecha fin anterior a inicio', () => {
      const result = validarOrdenFechas('2026-07-22', '2026-07-20');
      expect(result.valido).toBe(false);
      expect(result.error).toMatch(/fecha fin no puede ser anterior/);
    });
  });
});
