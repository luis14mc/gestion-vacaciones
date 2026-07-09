import { describe, it, expect } from 'vitest';
import { resolverFlujoInicialSolicitud } from '@/lib/domain/solicitud-flujo-inicial';

describe('solicitud-flujo-inicial — Fase 2', () => {
  describe('resolverFlujoInicialSolicitud', () => {
    it('Empleado normal → pendiente_jefe', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: false,
        aprobadorSegundoNivelTipo: 'director',
      });

      expect(flujo.estadoInicial).toBe('pendiente_jefe');
      expect(flujo.autoAprobacionJefe).toBeUndefined();
    });

    it('Jefe con Director disponible → pendiente_director', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director',
      });

      expect(flujo.estadoInicial).toBe('pendiente_director');
      expect(flujo.metadataInicial.aprobadorSegundoNivelTipo).toBe('director');
    });

    it('Jefe sin Director → pendiente_secretario_general', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'secretario_general',
      });

      expect(flujo.estadoInicial).toBe('pendiente_secretario_general');
      expect(flujo.metadataInicial.aprobadorSegundoNivelTipo).toBe('secretario_general');
    });

    it('Director → pendiente_rrhh (VoBo Ministro validado por RRHH)', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: true,
        esJefe: true,
      });

      expect(flujo.estadoInicial).toBe('pendiente_rrhh');
      expect(flujo.metadataInicial.flujoAprobacion).toBe('director_con_vobo_ministro');
      expect(flujo.metadataInicial.requiereVoBoMinistro).toBe(true);
    });
  });
});