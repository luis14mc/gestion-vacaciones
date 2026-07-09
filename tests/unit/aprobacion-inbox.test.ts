import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ACCIONABLES_APROBACION,
  determinarAccionAprobacion,
  esEstadoAccionableAprobacion,
  solicitudVisibleEnBandeja,
} from '@/lib/domain/aprobacion-inbox';

describe('aprobacion-inbox — Fase 2', () => {
  it('estados accionables cubren todo el flujo de aprobación', () => {
    expect(ESTADOS_ACCIONABLES_APROBACION).toContain('pendiente_jefe');
    expect(ESTADOS_ACCIONABLES_APROBACION).toContain('aprobada_jefe');
    expect(ESTADOS_ACCIONABLES_APROBACION).toContain('pendiente_director');
    expect(ESTADOS_ACCIONABLES_APROBACION).toContain('pendiente_secretario_general');
    expect(ESTADOS_ACCIONABLES_APROBACION).toContain('pendiente_rrhh');

    expect(esEstadoAccionableAprobacion('pendiente_jefe')).toBe(true);
    expect(esEstadoAccionableAprobacion('pendiente_director')).toBe(true);
    expect(esEstadoAccionableAprobacion('pendiente_secretario_general')).toBe(true);
    expect(esEstadoAccionableAprobacion('pendiente_rrhh')).toBe(true);
    expect(esEstadoAccionableAprobacion('aprobada_jefe')).toBe(true);

    expect(esEstadoAccionableAprobacion('rechazada_jefe')).toBe(false);
    expect(esEstadoAccionableAprobacion('aprobada_rrhh')).toBe(false);
    expect(esEstadoAccionableAprobacion('finalizada')).toBe(false);
    expect(esEstadoAccionableAprobacion('cancelada')).toBe(false);
  });

  describe('Jefe (no RRHH/Admin)', () => {
    it('ve pendiente_jefe de su equipo', () => {
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 20, estado: 'pendiente_jefe' },
          {
            sessionId: 10,
            equipoIds: [20],
            roles: {
              esAdmin: false,
              esRrhh: false,
              esJefe: true,
              esDirector: false,
              esSecretarioGeneral: false,
            },
          }
        )
      ).toBe(true);
    });

    it('NO ve pendiente_director ni pendiente_secretario_general ni pendiente_rrhh', () => {
      const ctx = {
        sessionId: 10,
        equipoIds: [20],
        roles: {
          esAdmin: false,
          esRrhh: false,
          esJefe: true,
          esDirector: false,
          esSecretarioGeneral: false,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_director' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 20, estado: 'pendiente_secretario_general' },
          ctx
        )
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_rrhh' }, ctx)
      ).toBe(false);
    });
  });

  describe('Director', () => {
    it('ve pendiente_director (asumiendo filtro por id)', () => {
      const ctx = {
        sessionId: 50,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: false,
          esJefe: false,
          esDirector: true,
          esSecretarioGeneral: false,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_director' }, ctx)
      ).toBe(true);
    });

    it('NO ve pendiente_rrhh ni pendiente_secretario_general', () => {
      const ctx = {
        sessionId: 50,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: false,
          esJefe: false,
          esDirector: true,
          esSecretarioGeneral: false,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_rrhh' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 20, estado: 'pendiente_secretario_general' },
          ctx
        )
      ).toBe(false);
    });
  });

  describe('Secretario General', () => {
    it('ve pendiente_secretario_general', () => {
      const ctx = {
        sessionId: 99,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: false,
          esJefe: false,
          esDirector: false,
          esSecretarioGeneral: true,
        },
      };
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 20, estado: 'pendiente_secretario_general' },
          ctx
        )
      ).toBe(true);
    });

    it('NO ve pendiente_director ni pendiente_rrhh', () => {
      const ctx = {
        sessionId: 99,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: false,
          esJefe: false,
          esDirector: false,
          esSecretarioGeneral: true,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_director' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_rrhh' }, ctx)
      ).toBe(false);
    });
  });

  describe('RRHH', () => {
    it('ve pendiente_rrhh y legacy aprobada_jefe', () => {
      const ctx = {
        sessionId: 70,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: true,
          esJefe: false,
          esDirector: false,
          esSecretarioGeneral: false,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_rrhh' }, ctx)
      ).toBe(true);
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'aprobada_jefe' }, ctx)
      ).toBe(true);
    });

    it('NO ve pendiente_director ni pendiente_secretario_general', () => {
      const ctx = {
        sessionId: 70,
        equipoIds: [],
        roles: {
          esAdmin: false,
          esRrhh: true,
          esJefe: false,
          esDirector: false,
          esSecretarioGeneral: false,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 20, estado: 'pendiente_director' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 20, estado: 'pendiente_secretario_general' },
          ctx
        )
      ).toBe(false);
    });
  });

  describe('Auto-exclusión', () => {
    it('ningún rol ve su propia solicitud', () => {
      const ctx = {
        sessionId: 10,
        equipoIds: [10],
        roles: {
          esAdmin: true,
          esRrhh: true,
          esJefe: true,
          esDirector: true,
          esSecretarioGeneral: true,
        },
      };
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 10, estado: 'pendiente_jefe' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 10, estado: 'pendiente_director' }, ctx)
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja(
          { usuarioId: 10, estado: 'pendiente_secretario_general' },
          ctx
        )
      ).toBe(false);
      expect(
        solicitudVisibleEnBandeja({ usuarioId: 10, estado: 'pendiente_rrhh' }, ctx)
      ).toBe(false);
    });
  });

  describe('determinarAccionAprobacion', () => {
    it('mapea estado + acción a la transición backend correcta', () => {
      expect(determinarAccionAprobacion('aprobar', 'pendiente_jefe')).toBe('aprobar_jefe');
      expect(determinarAccionAprobacion('aprobar', 'pendiente_director')).toBe('aprobar_director');
      expect(determinarAccionAprobacion('aprobar', 'pendiente_secretario_general')).toBe(
        'aprobar_secretario_general'
      );
      expect(determinarAccionAprobacion('aprobar', 'pendiente_rrhh')).toBe('aprobar_rrhh');
      expect(determinarAccionAprobacion('aprobar', 'aprobada_jefe')).toBe('aprobar_rrhh');

      expect(determinarAccionAprobacion('rechazar', 'pendiente_jefe')).toBe('rechazar_jefe');
      expect(determinarAccionAprobacion('rechazar', 'pendiente_director')).toBe('rechazar_director');
      expect(determinarAccionAprobacion('rechazar', 'pendiente_secretario_general')).toBe(
        'rechazar_secretario_general'
      );
      expect(determinarAccionAprobacion('rechazar', 'pendiente_rrhh')).toBe('rechazar_rrhh');
    });

    it('bloquea estados no accionables', () => {
      expect(() => determinarAccionAprobacion('aprobar', 'rechazada_jefe')).toThrow();
      expect(() => determinarAccionAprobacion('aprobar', 'aprobada_rrhh')).toThrow();
    });
  });
});