import { describe, it, expect, vi, beforeEach } from 'vitest';

const ERROR_SG =
  'No hay Director asignado al departamento Secretaría General para aprobación sustituta.';

function mockSelectSequence(responses: unknown[][]) {
  let call = 0;
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              const idx = call++;
              return Promise.resolve(responses[idx] ?? []);
            }),
          })),
        })),
      })),
    },
  };
}

describe('aprobadores.ts — Fase 2 Director de Secretaría General', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('obtenerDirectorSecretariaGeneral', () => {
    it('lanza error controlado si no existe el departamento', async () => {
      vi.doMock('@/lib/db', () => mockSelectSequence([[]]));
      const { obtenerDirectorSecretariaGeneral } = await import('@/lib/domain/aprobadores');
      await expect(obtenerDirectorSecretariaGeneral()).rejects.toThrow(ERROR_SG);
    });

    it('lanza error si el departamento no tiene director asignado', async () => {
      vi.doMock(
        '@/lib/db',
        () => mockSelectSequence([[{ id: 10, jefeId: null, nombre: 'Secretaría General' }]])
      );
      const { obtenerDirectorSecretariaGeneral } = await import('@/lib/domain/aprobadores');
      await expect(obtenerDirectorSecretariaGeneral()).rejects.toThrow(ERROR_SG);
    });

    it('devuelve el Director activo del departamento Secretaría General', async () => {
      vi.doMock(
        '@/lib/db',
        () =>
          mockSelectSequence([
            [{ id: 10, jefeId: 99, nombre: 'Secretaría General' }],
            [
              {
                id: 99,
                nombre: 'Dir.',
                apellido: 'SG',
                activo: true,
                deletedAt: null,
              },
            ],
          ])
      );
      const { obtenerDirectorSecretariaGeneral } = await import('@/lib/domain/aprobadores');
      const dir = await obtenerDirectorSecretariaGeneral();
      expect(dir).toEqual({ id: 99, nombre: 'Dir. SG' });
    });
  });

  describe('resolverFlujoAprobacionSolicitud', () => {
    it('empleado con jefe → requiereAprobacionJefe, sin Director ni SG', async () => {
      vi.doMock(
        '@/lib/db',
        () =>
          mockSelectSequence([
            [
              {
                id: 20,
                nombre: 'Jefe',
                apellido: 'TI',
                activo: true,
                deletedAt: null,
              },
            ],
          ])
      );

      const { resolverFlujoAprobacionSolicitud } = await import('@/lib/domain/aprobadores');
      const flujo = await resolverFlujoAprobacionSolicitud({
        id: 30,
        esDirector: false,
        esJefe: false,
        departamentoId: 1,
        jefeSuperiorId: 20,
      });

      expect(flujo.errorFlujo).toBe(false);
      expect(flujo.requiereAprobacionJefe).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('jefe');
      expect(flujo.aprobadorInicialId).toBe(20);
      expect(flujo.siguienteDespuesDeAprobacion).toBe('rrhh');
      expect(flujo.aprobadorSegundoNivelTipo).toBeNull();
      expect(flujo.mensajeFlujo).toMatch(/jefe superior/i);
    });

    it('empleado sin jefe → error controlado', async () => {
      vi.doMock('@/lib/db', () => mockSelectSequence([[]]));
      const { resolverFlujoAprobacionSolicitud, ERROR_SIN_JEFE_SUPERIOR } = await import(
        '@/lib/domain/aprobadores'
      );
      const flujo = await resolverFlujoAprobacionSolicitud({
        id: 30,
        esDirector: false,
        esJefe: false,
        departamentoId: 1,
        jefeSuperiorId: null,
      });
      expect(flujo.errorFlujo).toBe(true);
      expect(flujo.mensajeFlujo).toBe(ERROR_SIN_JEFE_SUPERIOR);
    });

    it('jefe con Director → aprobadorInicialTipo director', async () => {
      // Call 1: buscarUsuarioDirectorActivo(jefeSuperiorId) → director
      // Call 2: estaUsuarioDisponible → activo
      vi.doMock(
        '@/lib/db',
        () =>
          mockSelectSequence([
            [
              {
                id: 50,
                nombre: 'Dir',
                apellido: 'TI',
                esDirector: true,
                activo: true,
                deletedAt: null,
              },
            ],
            [{ activo: true, deletedAt: null }],
          ])
      );

      const { resolverFlujoAprobacionSolicitud } = await import('@/lib/domain/aprobadores');
      const flujo = await resolverFlujoAprobacionSolicitud({
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 1,
        jefeSuperiorId: 50,
      });

      expect(flujo.errorFlujo).toBe(false);
      expect(flujo.requiereAprobacionDirector).toBe(true);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('director');
      expect(flujo.aprobadorInicialId).toBe(50);
      expect(flujo.siguienteDespuesDeAprobacion).toBe('rrhh');
    });

    it('jefe sin Director → busca Director de Secretaría General', async () => {
      // Call order in resolverAprobadorSegundoNivel / obtenerDirectorSuperiorJefe:
      // 1. buscarUsuarioDirectorActivo(jefeSuperiorId) — no es director
      // 2. depto.jefeId
      // 3. fallback esDirector en depto
      // 4. dept Secretaría General
      // 5. buscarUsuarioActivo(jefeId SG)
      vi.doMock(
        '@/lib/db',
        () =>
          mockSelectSequence([
            [
              {
                id: 21,
                nombre: 'Otro',
                apellido: 'Jefe',
                esDirector: false,
                activo: true,
                deletedAt: null,
              },
            ],
            [{ jefeId: null }],
            [],
            [{ id: 99, jefeId: 77, nombre: 'Secretaría General' }],
            [
              {
                id: 77,
                nombre: 'Dir',
                apellido: 'SG',
                activo: true,
                deletedAt: null,
              },
            ],
          ])
      );

      const { resolverFlujoAprobacionSolicitud } = await import('@/lib/domain/aprobadores');
      const flujo = await resolverFlujoAprobacionSolicitud({
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 2,
        jefeSuperiorId: 21,
      });

      expect(flujo.errorFlujo).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(true);
      expect(flujo.aprobadorInicialTipo).toBe('director_secretaria_general');
      expect(flujo.aprobadorInicialId).toBe(77);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director_secretaria_general');
      expect(flujo.mensajeFlujo).toMatch(/Director de Secretaría General/i);
    });

    it('jefe sin Director y sin Dir. SG → error controlado', async () => {
      vi.doMock('@/lib/db', () => mockSelectSequence([[], [], [], []]));

      const { resolverFlujoAprobacionSolicitud, ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL } =
        await import('@/lib/domain/aprobadores');
      const flujo = await resolverFlujoAprobacionSolicitud({
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 2,
        jefeSuperiorId: null,
      });

      expect(flujo.errorFlujo).toBe(true);
      expect(flujo.mensajeFlujo).toBe(ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL);
    });
  });
});
