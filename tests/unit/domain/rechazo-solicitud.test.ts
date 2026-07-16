import { describe, expect, it } from 'vitest';
import {
  ESTADOS_RECHAZO_PREVIO_RRHH,
  esEstadoRechazado,
  esRechazoPrevioRRHH,
  nivelRechazoAuditoriaDesdeEstado,
  nivelRechazoDesdeEstado,
} from '@/lib/domain/rechazo-solicitud';

describe('rechazo-solicitud — BLOQUE 3', () => {
  it('identifica estados finales de rechazo previo a RRHH', () => {
    for (const estado of ESTADOS_RECHAZO_PREVIO_RRHH) {
      expect(esRechazoPrevioRRHH(estado)).toBe(true);
    }
    expect(esRechazoPrevioRRHH('rechazada_rrhh')).toBe(false);
    expect(esRechazoPrevioRRHH('pendiente_rrhh')).toBe(false);
  });

  it('expone nivel legible por estado', () => {
    expect(nivelRechazoDesdeEstado('rechazada_jefe')).toBe('Jefe inmediato');
    expect(nivelRechazoDesdeEstado('rechazada_director')).toBe('Director de Área');
    expect(nivelRechazoDesdeEstado('rechazada_secretario_general')).toBe(
      'Director de Secretaría General'
    );
    expect(nivelRechazoDesdeEstado('aprobada_rrhh')).toBeNull();
  });

  it('expone nivel de auditoría por estado', () => {
    expect(nivelRechazoAuditoriaDesdeEstado('rechazada_jefe')).toBe('jefe');
    expect(nivelRechazoAuditoriaDesdeEstado('rechazada_director')).toBe('director');
    expect(nivelRechazoAuditoriaDesdeEstado('rechazada_secretario_general')).toBe(
      'secretario_general'
    );
  });

  it('agrupa todos los estados de rechazo', () => {
    expect(esEstadoRechazado('rechazada_jefe')).toBe(true);
    expect(esEstadoRechazado('rechazada_director')).toBe(true);
    expect(esEstadoRechazado('rechazada_secretario_general')).toBe(true);
    expect(esEstadoRechazado('rechazada_rrhh')).toBe(true);
    expect(esEstadoRechazado('cancelada')).toBe(false);
  });
});
