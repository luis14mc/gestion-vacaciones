import { describe, it, expect } from 'vitest';
import {
  resolverFlujoInicialSolicitud,
  COMENTARIO_JEFE_EXCEPCION_DIR_ADMIN,
  FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
  esDepartamentoDireccionAdministrativa,
} from '@/lib/domain/solicitud-flujo-inicial';

describe('solicitud-flujo-inicial', () => {
  describe('esDepartamentoDireccionAdministrativa', () => {
    it('acepta variaciones de acentos y mayúsculas', () => {
      expect(esDepartamentoDireccionAdministrativa('Dirección Administrativa')).toBe(true);
      expect(esDepartamentoDireccionAdministrativa('Direccion Administrativa')).toBe(true);
      expect(esDepartamentoDireccionAdministrativa('  direccion administrativa  ')).toBe(true);
      expect(esDepartamentoDireccionAdministrativa('Tecnología')).toBe(false);
    });
  });

  describe('resolverFlujoInicialSolicitud', () => {
    it('Jefe de Dirección Administrativa → aprobada_jefe con metadata de excepción', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        departamentoNombre: 'Dirección Administrativa',
      });

      expect(flujo.estadoInicial).toBe('aprobada_jefe');
      expect(flujo.autoAprobacionJefe?.comentarioJefe).toBe(COMENTARIO_JEFE_EXCEPCION_DIR_ADMIN);
      expect(flujo.metadataInicial).toEqual({
        flujoEspecial: FLUJO_ESPECIAL_JEFE_DIR_ADMIN,
        derivadoDirectoRrhh: true,
      });
    });

    it('Empleado normal de Dirección Administrativa → pendiente_jefe', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: false,
        departamentoNombre: 'Dirección Administrativa',
      });

      expect(flujo.estadoInicial).toBe('pendiente_jefe');
      expect(flujo.autoAprobacionJefe).toBeUndefined();
      expect(flujo.metadataInicial).toEqual({});
    });

    it('Jefe de otro departamento → pendiente_jefe', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: true,
        departamentoNombre: 'Tecnología',
      });

      expect(flujo.estadoInicial).toBe('pendiente_jefe');
      expect(flujo.autoAprobacionJefe).toBeUndefined();
    });

    it('Director de cualquier departamento → aprobada_jefe (flujo actual)', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: true,
        esJefe: true,
        departamentoNombre: 'Dirección Administrativa',
      });

      expect(flujo.estadoInicial).toBe('aprobada_jefe');
      expect(flujo.autoAprobacionJefe?.comentarioJefe).toBe(
        'Auto-aprobado (solicitud creada por Director)'
      );
      expect(flujo.metadataInicial).toEqual({});
    });

    it('no aplica excepción si esJefe es false aunque el nombre del departamento coincida', () => {
      const flujo = resolverFlujoInicialSolicitud({
        esDirector: false,
        esJefe: false,
        departamentoNombre: 'Direccion Administrativa',
      });

      expect(flujo.estadoInicial).toBe('pendiente_jefe');
    });
  });
});
