import { describe, it, expect } from 'vitest';
import { puedeVerAdjuntosSolicitud } from '@/lib/domain/solicitud-adjuntos-acceso';

describe('puedeVerAdjuntosSolicitud', () => {
  const solicitud = {
    usuarioId: 10,
    aprobadaJefePor: 20,
    aprobadaDirectorPor: null,
    aprobadaSecretarioPor: null,
    aprobadaRrhhPor: 50,
  };

  it('permite al dueño ver sus adjuntos', () => {
    expect(
      puedeVerAdjuntosSolicitud({ id: 10, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(true);
  });

  it('permite a RRHH y Admin', () => {
    expect(
      puedeVerAdjuntosSolicitud({ id: 99, esAdmin: false, esRrhh: true, esJefe: false, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(true);
    expect(
      puedeVerAdjuntosSolicitud({ id: 99, esAdmin: true, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(true);
  });

  it('permite a quien participó en el flujo de aprobación', () => {
    expect(
      puedeVerAdjuntosSolicitud({ id: 20, esAdmin: false, esRrhh: false, esJefe: true, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(true);
    expect(
      puedeVerAdjuntosSolicitud({ id: 50, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(true);
  });

  it('deniega a usuario ajeno sin rol de aprobación', () => {
    expect(
      puedeVerAdjuntosSolicitud({ id: 99, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false }, solicitud)
    ).toBe(false);
  });
});
