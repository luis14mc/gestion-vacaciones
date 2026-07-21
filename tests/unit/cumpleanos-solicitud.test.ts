import { describe, expect, it } from 'vitest';
import {
  calcularElegibilidadCumpleanos,
  validarFechaSolicitudCumpleanos,
} from '@/lib/domain/cumpleanos';
import {
  requiereVoBoDirector,
  validarVoBoDirectorAdjunto,
  validarVoBoDirectorService,
} from '@/lib/domain/solicitud-adjuntos';
import { solicitudSchema } from '@/lib/validations/solicitud.schema';

describe('dia_cumpleanos - elegibilidad', () => {
  it('usuario con fechaNacimiento en mes actual puede solicitar', () => {
    const referencia = new Date('2026-06-10T12:00:00');
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: false,
      referencia,
    });

    expect(elegibilidad.puedeSolicitar).toBe(true);
    expect(
      validarFechaSolicitudCumpleanos('1990-06-15', '2026-06-20', referencia).valido
    ).toBe(true);
  });

  it('usuario sin fechaNacimiento no puede solicitar', () => {
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: null,
      yaTomado: false,
    });

    expect(elegibilidad.puedeSolicitar).toBe(false);
    expect(validarFechaSolicitudCumpleanos('', '2026-06-20').valido).toBe(false);
  });

  it('usuario que ya utilizó el beneficio no puede repetir', () => {
    const referencia = new Date('2026-06-10T12:00:00');
    const elegibilidad = calcularElegibilidadCumpleanos({
      fechaNacimiento: '1990-06-15',
      yaTomado: true,
      referencia,
    });

    expect(elegibilidad.puedeSolicitar).toBe(false);
    expect(elegibilidad.yaTomado).toBe(true);
  });
});

describe('dia_cumpleanos - VoBo director', () => {
  it('director puede crear dia_cumpleanos sin VoBo', () => {
    expect(
      requiereVoBoDirector({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'dia_cumpleanos',
      })
    ).toBe(false);

    expect(
      validarVoBoDirectorAdjunto({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'dia_cumpleanos',
        documentosAdjuntos: [],
      })
    ).toBeNull();

    expect(
      validarVoBoDirectorService({
        esDirector: true,
        tipo: 'dia_cumpleanos',
        documentosAdjuntos: [],
      })
    ).toBeNull();
  });

  it('director sigue necesitando VoBo para vacaciones', () => {
    expect(
      requiereVoBoDirector({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'vacaciones',
      })
    ).toBe(true);

    expect(
      validarVoBoDirectorAdjunto({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'vacaciones',
        documentosAdjuntos: [],
      })
    ).toContain('VoBo del Ministro');
  });

  it('director con licencia médica no requiere VoBo (solo constancia)', () => {
    expect(
      requiereVoBoDirector({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'licencia_medica',
      })
    ).toBe(false);

    expect(
      validarVoBoDirectorService({
        esDirector: true,
        tipo: 'licencia_medica',
        documentosAdjuntos: [],
      })
    ).toBeNull();
  });

  it('director con adjunto vobo_ministro pasa validación de route', () => {
    expect(
      validarVoBoDirectorAdjunto({
        esDirector: true,
        esSolicitudPropia: true,
        tipo: 'vacaciones',
        documentosAdjuntos: [{ nombre: 'vobo_ministro', data: 'base64-data' }],
      })
    ).toBeNull();
  });
});

describe('dia_cumpleanos - formulario schema', () => {
  it('solo exige fechaInicio para dia_cumpleanos', () => {
    const result = solicitudSchema.safeParse({
      tipoAusenciaId: 'dia_cumpleanos',
      unidad: 'dias',
      fechaInicio: '2026-08-10',
      fechaFin: '',
      requiereMotivo: false,
      diasAnticipacion: 0,
    });

    expect(result.success).toBe(true);
  });

  it('vacaciones sigue exigiendo fechaFin', () => {
    const result = solicitudSchema.safeParse({
      tipoAusenciaId: 'vacaciones',
      unidad: 'dias',
      fechaInicio: '2026-06-15',
      fechaFin: '',
      requiereMotivo: false,
    });

    expect(result.success).toBe(false);
  });
});
