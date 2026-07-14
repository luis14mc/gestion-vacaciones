import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cargarDatosFlujoSolicitante,
  resolverFlujoSolicitante,
  type DatosFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';

const mockResolverFlujo = vi.fn();

vi.mock('@/lib/domain/aprobadores', () => ({
  resolverFlujoAprobacionSolicitud: (...args: unknown[]) => mockResolverFlujo(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    query: {
      usuarios: { findFirst: vi.fn(async () => null) },
      departamentos: { findFirst: vi.fn(async () => null) },
    },
  },
}));

describe('solicitud-flujo-solicitante — Fase 2 (corrección)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('resolverFlujoSolicitante', () => {
    it('Director → pendiente_rrhh (VoBo Ministro)', async () => {
      mockResolverFlujo.mockResolvedValueOnce({
        requiereVoBoMinistro: true,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: false,
        pasaDirectoRrhh: true,
        aprobadorInicialTipo: 'rrhh',
        aprobadorInicialId: null,
        aprobadorInicialNombre: null,
        aprobadorSegundoNivelTipo: null,
        siguienteDespuesDeAprobacion: null,
        mensajeFlujo: 'VoBo Ministro',
        pasosProceso: ['VoBo', 'RRHH'],
        errorFlujo: false,
      });

      const datos: DatosFlujoSolicitante = {
        id: 1,
        esDirector: true,
        esJefe: true,
        departamentoId: 1,
        departamentoNombre: 'Tecnología',
        jefeSuperiorId: null,
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereVoBoMinistro).toBe(true);
      expect(flujo.pasaDirectoRrhh).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(mockResolverFlujo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, esDirector: true }),
        'vacaciones'
      );
    });

    it('Jefe con Director → flujo pendiente_director', async () => {
      mockResolverFlujo.mockResolvedValueOnce({
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: true,
        requiereAprobacionSecretariaGeneral: false,
        pasaDirectoRrhh: false,
        aprobadorInicialTipo: 'director',
        aprobadorInicialId: 50,
        aprobadorInicialNombre: 'Dir. TI',
        aprobadorSegundoNivelTipo: 'director',
        siguienteDespuesDeAprobacion: 'rrhh',
        mensajeFlujo: 'Director luego RRHH',
        pasosProceso: ['Director', 'RRHH'],
        errorFlujo: false,
      });

      const datos: DatosFlujoSolicitante = {
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 1,
        departamentoNombre: 'Tecnología',
        jefeSuperiorId: 50,
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionDirector).toBe(true);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director');
      expect(flujo.aprobadorInicialTipo).toBe('director');
    });

    it('Jefe sin Director → Director de Secretaría General', async () => {
      mockResolverFlujo.mockResolvedValueOnce({
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: true,
        pasaDirectoRrhh: false,
        aprobadorInicialTipo: 'director_secretaria_general',
        aprobadorInicialId: 99,
        aprobadorInicialNombre: 'Dir. SG',
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
        siguienteDespuesDeAprobacion: 'rrhh',
        mensajeFlujo: 'Dir. Secretaría General',
        pasosProceso: ['Dir SG', 'RRHH'],
        errorFlujo: false,
      });

      const datos: DatosFlujoSolicitante = {
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 2,
        departamentoNombre: 'Logística',
        jefeSuperiorId: null,
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(true);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director_secretaria_general');
      expect(flujo.aprobadorInicialTipo).toBe('director_secretaria_general');
    });

    it('Empleado normal → Jefe → RRHH sin Director', async () => {
      mockResolverFlujo.mockResolvedValueOnce({
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: true,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: false,
        pasaDirectoRrhh: false,
        aprobadorInicialTipo: 'jefe',
        aprobadorInicialId: 20,
        aprobadorInicialNombre: 'Jefe TI',
        aprobadorSegundoNivelTipo: null,
        siguienteDespuesDeAprobacion: 'rrhh',
        mensajeFlujo: 'Jefe luego RRHH',
        pasosProceso: ['Jefe', 'RRHH'],
        errorFlujo: false,
      });

      const datos: DatosFlujoSolicitante = {
        id: 30,
        esDirector: false,
        esJefe: false,
        departamentoId: 3,
        departamentoNombre: 'Operaciones',
        jefeSuperiorId: 20,
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionJefe).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorSegundoNivelTipo).toBeNull();
      expect(flujo.aprobadorInicialTipo).toBe('jefe');
    });

    it('Jefe sin Director Y sin Dir. SG → errorFlujo', async () => {
      mockResolverFlujo.mockResolvedValueOnce({
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: true,
        pasaDirectoRrhh: false,
        aprobadorInicialTipo: 'rrhh',
        aprobadorInicialId: null,
        aprobadorInicialNombre: null,
        aprobadorSegundoNivelTipo: null,
        siguienteDespuesDeAprobacion: null,
        mensajeFlujo:
          'No hay Director asignado al departamento Secretaría General para aprobación sustituta.',
        pasosProceso: ['No se puede crear la solicitud'],
        errorFlujo: true,
      });

      const datos: DatosFlujoSolicitante = {
        id: 20,
        esDirector: false,
        esJefe: true,
        departamentoId: 99,
        departamentoNombre: 'Sin director',
        jefeSuperiorId: null,
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.errorFlujo).toBe(true);
      expect(flujo.mensajeFlujo).toContain('Secretaría General');
    });
  });

  describe('cargarDatosFlujoSolicitante', () => {
    it('devuelve null si el usuario no existe', async () => {
      const result = await cargarDatosFlujoSolicitante(99999);
      expect(result).toBeNull();
    });
  });
});
