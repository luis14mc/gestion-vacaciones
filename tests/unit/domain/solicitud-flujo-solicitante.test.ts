import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cargarDatosFlujoSolicitante,
  resolverFlujoSolicitante,
  type DatosFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';

const mockResolverAprobador = vi.fn();

vi.mock('@/lib/domain/aprobadores', () => ({
  resolverAprobadorSegundoNivel: (...args: unknown[]) =>
    mockResolverAprobador(...args),
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

describe('solicitud-flujo-solicitante — Fase 2', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('resolverFlujoSolicitante', () => {
    it('Director → pendiente_rrhh (VoBo Ministro) sin consultar aprobador de segundo nivel', async () => {
      const datos: DatosFlujoSolicitante = {
        esDirector: true,
        esJefe: true,
        esSecretarioGeneral: false,
        departamentoId: 1,
        departamentoNombre: 'Tecnología',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereVoBoMinistro).toBe(true);
      expect(flujo.pasaDirectoRrhh).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretarioGeneral).toBe(false);
      expect(mockResolverAprobador).not.toHaveBeenCalled();
    });

    it('Jefe con Director disponible → flujo pendiente_director', async () => {
      mockResolverAprobador.mockResolvedValueOnce({
        tipoAprobador: 'director',
        usuarioId: 50,
        motivo: 'director_asignado',
        nombre: 'Dir. TI',
      });

      const datos: DatosFlujoSolicitante = {
        esDirector: false,
        esJefe: true,
        esSecretarioGeneral: false,
        departamentoId: 1,
        departamentoNombre: 'Tecnología',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionDirector).toBe(true);
      expect(flujo.requiereAprobacionSecretarioGeneral).toBe(false);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director');
      expect(flujo.aprobadorSegundoNivelNombre).toBe('Dir. TI');
    });

    it('Jefe sin Director → cae a Secretario General', async () => {
      mockResolverAprobador.mockResolvedValueOnce({
        tipoAprobador: 'secretario_general',
        usuarioId: 99,
        motivo: 'sin_director',
        nombre: 'Sec. General',
      });

      const datos: DatosFlujoSolicitante = {
        esDirector: false,
        esJefe: true,
        esSecretarioGeneral: false,
        departamentoId: 2,
        departamentoNombre: 'Logística',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionSecretarioGeneral).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('secretario_general');
    });

    it('Empleado normal con Director → flujo Jefe → Director → RRHH', async () => {
      mockResolverAprobador.mockResolvedValueOnce({
        tipoAprobador: 'director',
        usuarioId: 70,
        motivo: 'director_asignado',
        nombre: 'Dir. OPS',
      });

      const datos: DatosFlujoSolicitante = {
        esDirector: false,
        esJefe: false,
        esSecretarioGeneral: false,
        departamentoId: 3,
        departamentoNombre: 'Operaciones',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionJefe).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretarioGeneral).toBe(false);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director');
    });

    it('Empleado sin Director → cae a Secretario General', async () => {
      mockResolverAprobador.mockResolvedValueOnce({
        tipoAprobador: 'secretario_general',
        usuarioId: 99,
        motivo: 'sin_director',
        nombre: 'Sec. General',
      });

      const datos: DatosFlujoSolicitante = {
        esDirector: false,
        esJefe: false,
        esSecretarioGeneral: false,
        departamentoId: 4,
        departamentoNombre: 'RRHH',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.requiereAprobacionSecretarioGeneral).toBe(true);
      expect(flujo.aprobadorSegundoNivelTipo).toBe('secretario_general');
    });

    it('Jefe sin Director Y sin Secretario General → mensaje de error', async () => {
      mockResolverAprobador.mockRejectedValueOnce(
        new Error(
          'No hay Director de Área asignado al departamento ni Secretario General configurado para aprobación sustituta.'
        )
      );

      const datos: DatosFlujoSolicitante = {
        esDirector: false,
        esJefe: true,
        esSecretarioGeneral: false,
        departamentoId: 99,
        departamentoNombre: 'Sin director',
      };

      const flujo = await resolverFlujoSolicitante(datos, 'vacaciones');
      expect(flujo.pasosProceso).toEqual(['No se puede crear la solicitud']);
      expect(flujo.mensajeFlujo).toContain('Secretario General');
    });
  });

  describe('cargarDatosFlujoSolicitante', () => {
    it('devuelve null si el usuario no existe', async () => {
      const result = await cargarDatosFlujoSolicitante(99999);
      expect(result).toBeNull();
    });
  });
});