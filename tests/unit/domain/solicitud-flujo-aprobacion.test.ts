import { describe, it, expect } from 'vitest';
import {
  resolverFlujoAprobacionNuevaSolicitud,
  mensajeFlujoVisible,
} from '@/lib/domain/solicitud-flujo-aprobacion';

describe('solicitud-flujo-aprobacion — Fase 2 (corrección)', () => {
  describe('Director', () => {
    it('Director normal: requiere VoBo del Ministro', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'vacaciones',
      });

      expect(flujo.requiereVoBoMinistro).toBe(true);
      expect(flujo.pasaDirectoRrhh).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('rrhh');
      expect(flujo.pasosProceso[0]).toMatch(/VoBo Ministro/i);
    });

    it('Director en permiso de salida: VoBo condicionado por duración', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'permiso_salida',
      });

      expect(flujo.requiereVoBoMinistro).toBe(true);
      expect(flujo.pasosProceso[0]).toMatch(/VoBo Ministro/i);
    });

    it('Director en cumpleaños: no requiere VoBo', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'dia_cumpleanos',
      });

      expect(flujo.requiereVoBoMinistro).toBe(false);
    });

    it('Director en licencia médica: flujo de empleado sin VoBo', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'licencia_medica',
      });

      expect(flujo.requiereVoBoMinistro).toBe(false);
      expect(flujo.requiereAprobacionJefe).toBe(true);
    });
  });

  describe('Jefe', () => {
    it('Jefe con Director disponible: pendiente Director', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director',
        aprobadorSegundoNivelNombre: 'Dir. TI',
        tipo: 'vacaciones',
      });

      expect(flujo.requiereAprobacionDirector).toBe(true);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('director');
      expect(flujo.siguienteDespuesDeAprobacion).toBe('rrhh');
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director');
      expect(flujo.pasosProceso[0]).toMatch(/Director de Área/i);
    });

    it('Jefe sin Director: cae a Director de Secretaría General', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
        aprobadorSegundoNivelNombre: 'Dir. SG',
        tipo: 'vacaciones',
      });

      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('director_secretaria_general');
      expect(flujo.aprobadorSegundoNivelTipo).toBe('director_secretaria_general');
      expect(flujo.mensajeFlujo).toMatch(/Director de Secretaría General/i);
      expect(flujo.pasosProceso[0]).toMatch(/Secretaría General/i);
    });

    it('Jefe en cumpleaños: no requiere VoBo y va por jefe', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: false,
        esJefe: true,
        aprobadorSegundoNivelTipo: 'director',
        tipo: 'dia_cumpleanos',
      });

      expect(flujo.requiereVoBoMinistro).toBe(false);
      expect(flujo.requiereAprobacionJefe).toBe(true);
    });
  });

  describe('Empleado', () => {
    it('Empleado normal: flujo Jefe → RRHH (sin Director)', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: false,
        esJefe: false,
        tipo: 'vacaciones',
      });

      expect(flujo.requiereAprobacionJefe).toBe(true);
      expect(flujo.requiereAprobacionDirector).toBe(false);
      expect(flujo.requiereAprobacionSecretariaGeneral).toBe(false);
      expect(flujo.aprobadorInicialTipo).toBe('jefe');
      expect(flujo.siguienteDespuesDeAprobacion).toBe('rrhh');
      expect(flujo.aprobadorSegundoNivelTipo).toBeNull();
      expect(flujo.pasosProceso[0]).toMatch(/Jefe Inmediato/i);
      expect(flujo.pasosProceso[1]).toMatch(/Recursos Humanos/i);
      expect(flujo.pasosProceso.join(' ')).not.toMatch(/Director de Área/i);
    });
  });

  describe('mensajeFlujoVisible', () => {
    it('director permiso 1-2h sin mencionar VoBo obligatorio', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'permiso_salida',
      });

      const mensaje = mensajeFlujoVisible({
        flujo,
        tipo: 'permiso_salida',
        duracionPermiso: '1-2h',
      });

      expect(mensaje).toMatch(/No se requiere VoBo del Ministro/i);
      expect(mensaje).not.toMatch(/debe adjuntar el VoBo/i);
    });

    it('director permiso día completo mantiene mensaje VoBo', () => {
      const flujo = resolverFlujoAprobacionNuevaSolicitud({
        esDirector: true,
        esJefe: false,
        tipo: 'permiso_salida',
      });

      const mensaje = mensajeFlujoVisible({
        flujo,
        tipo: 'permiso_salida',
        duracionPermiso: 'dia_completo',
      });

      expect(mensaje).toMatch(/debe adjuntar el VoBo del Ministro/i);
    });
  });
});
