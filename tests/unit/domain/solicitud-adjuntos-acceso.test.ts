import { describe, it, expect } from 'vitest';
import {
  puedeVerAdjuntosSolicitud,
  usuarioSubioAlgúnAdjunto,
  evaluarAccesoAdjuntoInstitucional,
} from '@/lib/domain/solicitud-adjuntos-acceso';

describe('puedeVerAdjuntosSolicitud', () => {
  const solicitud = {
    usuarioId: 10,
    aprobadaJefePor: 20,
    aprobadaDirectorPor: null,
    aprobadaSecretarioPor: null,
    aprobadaRrhhPor: 50,
  };

  const adjuntos = [
    { tipo: 'vobo_jefe', data: 'data:...', uploadedBy: 30 },
  ];

  it('permite al solicitante ver adjuntos de su solicitud', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 10, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
  });

  it('permite al usuario que subió el adjunto aunque no sea aprobador', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 30, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
  });

  it('permite a RRHH y Admin', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 99, esAdmin: false, esRrhh: true, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 99, esAdmin: true, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
  });

  it('permite a quien participó en el flujo de aprobación', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 20, esAdmin: false, esRrhh: false, esJefe: true, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 50, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(true);
  });

  it('deniega a usuario externo sin rol ni relación con la solicitud', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 99, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        solicitud,
        adjuntos
      )
    ).toBe(false);
  });

  it('solicitante sigue viendo adjuntos en estado final aprobada_rrhh', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 10, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        { ...solicitud, aprobadaRrhhPor: 50 },
        adjuntos
      )
    ).toBe(true);
  });

  it('solicitante sigue viendo adjuntos en estado final rechazada_jefe', () => {
    expect(
      puedeVerAdjuntosSolicitud(
        { id: 10, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
        { ...solicitud, aprobadaJefePor: 20 },
        adjuntos
      )
    ).toBe(true);
  });
});

describe('usuarioSubioAlgúnAdjunto', () => {
  it('detecta uploadedBy en cualquier adjunto', () => {
    expect(
      usuarioSubioAlgúnAdjunto(7, [{ uploadedBy: 7, data: 'data:...' }])
    ).toBe(true);
    expect(
      usuarioSubioAlgúnAdjunto(7, [{ uploadedBy: 8, data: 'data:...' }])
    ).toBe(false);
  });
});

describe('evaluarAccesoAdjuntoInstitucional', () => {
  const solicitud = { usuarioId: 10, aprobadaJefePor: 20 };

  it('marca visualizadorEsUploader cuando corresponde', () => {
    const acceso = evaluarAccesoAdjuntoInstitucional({
      session: { id: 30, esAdmin: false, esRrhh: false, esJefe: false, esDirector: false, esSecretarioGeneral: false },
      solicitud,
      adjunto: { uploadedBy: 30 },
    });
    expect(acceso.autorizado).toBe(true);
    expect(acceso.visualizadorEsUploader).toBe(true);
    expect(acceso.visualizadorEsSolicitante).toBe(false);
  });
});
