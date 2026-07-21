import { describe, it, expect } from 'vitest';
import { esErrorValidacionNegocioCrearSolicitud } from '@/lib/domain/solicitud-errores-negocio';

describe('esErrorValidacionNegocioCrearSolicitud', () => {
  it('reconoce anticipación insuficiente de vacaciones', () => {
    const error = new Error(
      'Debe solicitar con al menos 5 día(s) de anticipación. Fecha mínima permitida: 22/07/2026.'
    );
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(true);
  });

  it('reconoce saldo insuficiente con mensaje canónico', () => {
    const error = new Error('No tiene días disponibles suficientes.');
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(true);
  });

  it('reconoce superposición de fechas', () => {
    const error = new Error(
      'Ya tiene una solicitud activa que se superpone con las fechas seleccionadas.'
    );
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(true);
  });

  it('reconoce balance insuficiente', () => {
    const error = new Error(
      'Balance insuficiente. Disponible: 2 días, solicitado: 10 días'
    );
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(true);
  });

  it('reconoce errores de día de cumpleaños', () => {
    const error = new Error('Ya utilizó su día libre por cumpleaños este año.');
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(true);
  });

  it('no trata errores técnicos de postgres como validación de negocio', () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(false);
  });

  it('no trata errores de conexión como validación de negocio', () => {
    const error = new Error('connection refused');
    expect(esErrorValidacionNegocioCrearSolicitud(error)).toBe(false);
  });
});
