import { describe, expect, it } from 'vitest';
import {
  debeExigirVoBoMinistro,
  esDirectorConFlujoVoBo,
  requiereVoBoDirector,
  validarVoBoDirectorAdjunto,
} from '@/lib/domain/solicitud-adjuntos';

describe('solicitud-adjuntos — VoBo Ministro', () => {
  it('director con permiso 1-2h no requiere VoBo', () => {
    expect(
      debeExigirVoBoMinistro({
        requiereVoBoFlujo: true,
        tipo: 'permiso_salida',
        duracionPermiso: '1-2h',
      })
    ).toBe(false);
    expect(
      requiereVoBoDirector({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'permiso_salida',
        duracionPermiso: '1-2h',
      })
    ).toBe(false);
  });

  it('director con permiso medio día (2-4h) no requiere VoBo', () => {
    expect(
      debeExigirVoBoMinistro({
        requiereVoBoFlujo: true,
        tipo: 'permiso_salida',
        duracionPermiso: '2-4h',
      })
    ).toBe(false);
  });

  it('director con permiso día completo sí requiere VoBo', () => {
    expect(
      debeExigirVoBoMinistro({
        requiereVoBoFlujo: true,
        tipo: 'permiso_salida',
        duracionPermiso: 'dia_completo',
      })
    ).toBe(true);
    expect(
      validarVoBoDirectorAdjunto({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'permiso_salida',
        duracionPermiso: 'dia_completo',
        documentosAdjuntos: [],
      })
    ).toMatch(/VoBo del Ministro/i);
  });

  it('director con vacaciones sí requiere VoBo', () => {
    expect(
      debeExigirVoBoMinistro({
        requiereVoBoFlujo: true,
        tipo: 'vacaciones',
      })
    ).toBe(true);
  });

  it('licencia médica no entra en flujo VoBo del director', () => {
    expect(
      esDirectorConFlujoVoBo({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'licencia_medica',
      })
    ).toBe(false);
  });
});
