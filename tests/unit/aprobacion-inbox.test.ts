import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ACCIONABLES_APROBACION,
  determinarAccionAprobacion,
  esEstadoAccionableAprobacion,
  solicitudVisibleEnBandeja,
} from '@/lib/domain/aprobacion-inbox';

describe('aprobacion-inbox', () => {
  it('solo permite estados accionables', () => {
    expect(ESTADOS_ACCIONABLES_APROBACION).toEqual(['pendiente_jefe', 'aprobada_jefe']);
    expect(esEstadoAccionableAprobacion('pendiente_jefe')).toBe(true);
    expect(esEstadoAccionableAprobacion('aprobada_jefe')).toBe(true);
    expect(esEstadoAccionableAprobacion('rechazada_jefe')).toBe(false);
    expect(esEstadoAccionableAprobacion('aprobada_rrhh')).toBe(false);
    expect(esEstadoAccionableAprobacion('finalizada')).toBe(false);
    expect(esEstadoAccionableAprobacion('cancelada')).toBe(false);
  });

  it('jefe ve pendiente_jefe de su equipo, no estados finales', () => {
    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'pendiente_jefe' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: false, esJefe: true, esDirector: false },
        }
      )
    ).toBe(true);

    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'rechazada_jefe' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: false, esJefe: true, esDirector: false },
        }
      )
    ).toBe(false);

    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'aprobada_rrhh' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: false, esJefe: true, esDirector: false },
        }
      )
    ).toBe(false);
  });

  it('RRHH ve aprobada_jefe, no rechazada_jefe', () => {
    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'aprobada_jefe' },
        {
          sessionId: 99,
          equipoIds: [],
          roles: { esAdmin: false, esRrhh: true, esJefe: false, esDirector: false },
        }
      )
    ).toBe(true);

    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'rechazada_jefe' },
        {
          sessionId: 99,
          equipoIds: [],
          roles: { esAdmin: false, esRrhh: true, esJefe: false, esDirector: false },
        }
      )
    ).toBe(false);
  });

  it('usuario jefe + RRHH ve ambos conjuntos accionables', () => {
    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 20, estado: 'pendiente_jefe' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: true, esJefe: true, esDirector: false },
        }
      )
    ).toBe(true);

    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 30, estado: 'aprobada_jefe' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: true, esJefe: true, esDirector: false },
        }
      )
    ).toBe(true);

    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 30, estado: 'finalizada' },
        {
          sessionId: 10,
          equipoIds: [20],
          roles: { esAdmin: false, esRrhh: true, esJefe: true, esDirector: false },
        }
      )
    ).toBe(false);
  });

  it('no permite autoaprobación de solicitudes propias', () => {
    expect(
      solicitudVisibleEnBandeja(
        { usuarioId: 10, estado: 'pendiente_jefe' },
        {
          sessionId: 10,
          equipoIds: [10],
          roles: { esAdmin: false, esRrhh: true, esJefe: true, esDirector: false },
        }
      )
    ).toBe(false);
  });

  it('determinarAccionAprobacion bloquea estados no accionables', () => {
    expect(() => determinarAccionAprobacion('aprobar', 'rechazada_jefe')).toThrow(
      'La solicitud ya no está pendiente de aprobación'
    );
    expect(() => determinarAccionAprobacion('aprobar', 'aprobada_rrhh')).toThrow(
      'La solicitud ya no está pendiente de aprobación'
    );
    expect(determinarAccionAprobacion('aprobar', 'pendiente_jefe')).toBe('aprobar_jefe');
    expect(determinarAccionAprobacion('aprobar', 'aprobada_jefe')).toBe('aprobar_rrhh');
    expect(determinarAccionAprobacion('rechazar', 'pendiente_jefe')).toBe('rechazar_jefe');
    expect(determinarAccionAprobacion('rechazar', 'aprobada_jefe')).toBe('rechazar_rrhh');
  });
});
