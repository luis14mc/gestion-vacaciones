import { describe, it, expect } from 'vitest';
import { resolverFlujoInicialSolicitud } from '@/lib/domain/solicitud-flujo-inicial';

describe('solicitud-flujo-inicial', () => {
  describe('resolverFlujoInicialSolicitud', () => {
    it('Empleado normal → pendiente_jefe', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: false,
      });
      expect(flujo.estadoInicial).toBe('pendiente_jefe');
      expect(flujo.metadataInicial.flujoAprobacion).toBe('empleado_jefe_rrhh');
    });

    it('Jefe con Director → pendiente_director', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director',
      });
      expect(flujo.estadoInicial).toBe('pendiente_director');
    });

    it('Jefe sin Director → pendiente_secretario_general', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      });
      expect(flujo.estadoInicial).toBe('pendiente_secretario_general');
      expect(flujo.metadataInicial.aprobadorSegundoNivelTipo).toBe(
        'director_secretaria_general'
      );
    });

    it('Director → pendiente_rrhh', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: true,
        esJefe: false,
      });
      expect(flujo.estadoInicial).toBe('pendiente_rrhh');
      expect(flujo.metadataInicial.flujoAprobacion).toBe('director_con_vobo_ministro');
    });
  });
});
