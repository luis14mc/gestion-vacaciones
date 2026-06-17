/**
 * ============================================================
 * TESTS: State Machine - Solicitudes CNI
 * ============================================================
 * @description Tests unitarios de la máquina de estados pura.
 *   No requiere BD, no requiere mocks complejos.
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import {
  transicionar,
  obtenerAccionesDisponibles,
  puedeTransicionar,
  obtenerMapaTransiciones,
  ESTADOS_CONFIG,
  type TransicionContexto,
} from '@/lib/domain/state-machine';

// =====================================================
// HELPERS
// =====================================================

const empleado: TransicionContexto = {
  usuarioId: 10,
  solicitanteId: 10,
  esDirector: false,
  esJefe: false,
  esRrhh: false,
  esAdmin: false,
  tipo: 'vacaciones',
};

const director: TransicionContexto = {
  usuarioId: 15,
  solicitanteId: 10,
  esDirector: true,
  esJefe: false,
  esRrhh: false,
  esAdmin: false,
  tipo: 'vacaciones',
  // Mismo departamento que el solicitante (regla CNI de alcance)
  departamentoAprobador: 1,
  departamentoSolicitante: 1,
};

const jefe: TransicionContexto = {
  usuarioId: 20,
  solicitanteId: 10,
  esDirector: false,
  esJefe: true,
  esRrhh: false,
  esAdmin: false,
  tipo: 'vacaciones',
  // Mismo departamento que el solicitante (regla CNI de alcance)
  departamentoAprobador: 1,
  departamentoSolicitante: 1,
};

const rrhh: TransicionContexto = {
  usuarioId: 30,
  solicitanteId: 10,
  esDirector: false,
  esJefe: false,
  esRrhh: true,
  esAdmin: false,
  tipo: 'vacaciones',
};

const admin: TransicionContexto = {
  usuarioId: 1,
  solicitanteId: 10,
  esDirector: false,
  esJefe: false,
  esRrhh: false,
  esAdmin: true,
  tipo: 'vacaciones',
};

// =====================================================
// TESTS
// =====================================================

describe('State Machine - Solicitudes', () => {
  // ─── Flujo Happy Path ───

  describe('Flujo completo: borrador → pendiente_jefe → aprobada_jefe → aprobada_rrhh', () => {
    it('empleado puede enviar borrador', () => {
      const resultado = transicionar('borrador', 'enviar', empleado, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_jefe');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'RESERVAR_BALANCE' })
      );
    });

    it('jefe puede aprobar solicitud pendiente', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefe, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_jefe');
    });

    it('RRHH puede aprobar solicitud aprobada por jefe', () => {
      const resultado = transicionar('aprobada_jefe', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_rrhh');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'CONFIRMAR_BALANCE' })
      );
    });
  });

  // ─── Rechazos ───

  describe('Rechazos', () => {
    it('jefe puede rechazar solicitud pendiente', () => {
      const resultado = transicionar('pendiente_jefe', 'rechazar_jefe', jefe, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_jefe');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'LIBERAR_BALANCE' })
      );
    });

    it('RRHH puede rechazar solicitud aprobada por jefe', () => {
      const resultado = transicionar('aprobada_jefe', 'rechazar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_rrhh');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'LIBERAR_BALANCE' })
      );
    });
  });

  // ─── Guards de permisos ───

  describe('Guards de permisos', () => {
    it('empleado NO puede aprobar como jefe', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', empleado, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('Jefe o Director');
    });

    it('director puede aprobar solicitud pendiente', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', director, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_jefe');
    });

    it('jefe NO puede aprobar como RRHH', () => {
      const resultado = transicionar('aprobada_jefe', 'aprobar_rrhh', jefe, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('RRHH');
    });

    it('jefe NO puede aprobar su propia solicitud', () => {
      const jefeSolicitante: TransicionContexto = {
        usuarioId: 20,
        solicitanteId: 20,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefeSolicitante, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('propia solicitud');
    });

    it('jefe NO puede rechazar su propia solicitud', () => {
      const jefeSolicitante: TransicionContexto = {
        usuarioId: 20,
        solicitanteId: 20,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
      };
      const resultado = transicionar('pendiente_jefe', 'rechazar_jefe', jefeSolicitante, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('propia solicitud');
    });

    it('director NO puede aprobar su propia solicitud', () => {
      const directorSolicitante: TransicionContexto = {
        usuarioId: 15,
        solicitanteId: 15,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', directorSolicitante, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('propia solicitud');
    });

    it('jefe NO puede aprobar solicitud de OTRO departamento (escalada horizontal)', () => {
      const jefeOtroDepto: TransicionContexto = {
        usuarioId: 21,
        solicitanteId: 10,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
        departamentoAprobador: 2,
        departamentoSolicitante: 1,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefeOtroDepto, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('mismo departamento');
    });

    it('jefe SIN dato de departamento es denegado (default seguro)', () => {
      const jefeSinDepto: TransicionContexto = {
        usuarioId: 22,
        solicitanteId: 10,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefeSinDepto, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('mismo departamento');
    });

    it('un Jefe NO puede aprobar la solicitud de otro Jefe del mismo depto', () => {
      const jefeAprobador: TransicionContexto = {
        usuarioId: 20,
        solicitanteId: 25,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
        departamentoAprobador: 1,
        departamentoSolicitante: 1,
        solicitanteEsJefe: true,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefeAprobador, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('Director');
    });

    it('el Director SI puede aprobar la solicitud de un Jefe del mismo depto', () => {
      const directorAprobador: TransicionContexto = {
        usuarioId: 15,
        solicitanteId: 25,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        departamentoAprobador: 1,
        departamentoSolicitante: 1,
        solicitanteEsJefe: true,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', directorAprobador, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_jefe');
    });

    it('un Jefe SI puede aprobar a un empleado normal del mismo depto', () => {
      const jefeAprobador: TransicionContexto = {
        usuarioId: 20,
        solicitanteId: 10,
        esDirector: false,
        esJefe: true,
        esRrhh: false,
        esAdmin: false,
        departamentoAprobador: 1,
        departamentoSolicitante: 1,
        solicitanteEsJefe: false,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefeAprobador, 5);
      expect(resultado.exito).toBe(true);
    });

    it('admin aprueba aunque difieran los departamentos (bypass)', () => {
      const adminOtroDepto: TransicionContexto = {
        ...admin,
        departamentoAprobador: 99,
        departamentoSolicitante: 1,
      };
      expect(transicionar('pendiente_jefe', 'aprobar_jefe', adminOtroDepto, 5).exito).toBe(true);
    });

    it('admin puede hacer cualquier acción', () => {
      expect(transicionar('pendiente_jefe', 'aprobar_jefe', admin, 5).exito).toBe(true);
      expect(transicionar('aprobada_jefe', 'aprobar_rrhh', admin, 5).exito).toBe(true);
    });
  });

  // ─── Cancelación ───

  describe('Cancelación', () => {
    it('solicitante puede cancelar solicitud pendiente', () => {
      const resultado = transicionar('pendiente_jefe', 'cancelar', empleado, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('cancelada');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'LIBERAR_BALANCE' })
      );
    });

    it('RRHH puede cancelar solicitud aprobada', () => {
      const resultado = transicionar('aprobada_rrhh', 'cancelar', rrhh, 5);
      // aprobada_rrhh es estado final (no permite transiciones)
      expect(resultado.exito).toBe(false);
    });

    it('otro empleado NO puede cancelar solicitud ajena', () => {
      const otro: TransicionContexto = { ...empleado, usuarioId: 99 };
      const resultado = transicionar('pendiente_jefe', 'cancelar', otro, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('permisos');
    });

    it('NO se puede cancelar solicitud finalizada', () => {
      const resultado = transicionar('finalizada', 'cancelar', admin, 5);
      expect(resultado.exito).toBe(false);
    });

    it('NO se puede cancelar solicitud rechazada', () => {
      const resultado = transicionar('rechazada_jefe', 'cancelar', empleado, 5);
      expect(resultado.exito).toBe(false);
    });
  });

  // ─── Transiciones inválidas ───

  describe('Transiciones inválidas', () => {
    it('no se puede aprobar_rrhh desde pendiente_jefe', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('Transición inválida');
    });

    it('no se puede enviar una solicitud ya aprobada', () => {
      const resultado = transicionar('aprobada_jefe', 'enviar', empleado, 5);
      expect(resultado.exito).toBe(false);
    });

    it('no se puede aprobar una solicitud finalizada', () => {
      const resultado = transicionar('finalizada', 'aprobar_jefe', jefe, 5);
      expect(resultado.exito).toBe(false);
    });
  });

  // ─── Cron (transiciones automáticas) ───

  describe('Transiciones automáticas (cron)', () => {
    it('aprobada_rrhh es estado final (no transiciona)', () => {
      const resultado = transicionar('aprobada_rrhh', 'finalizar', rrhh, 5);
      expect(resultado.exito).toBe(false);
    });

    it('aprobada_rrhh bloquea transiciones incluso para admin', () => {
      const resultado = transicionar('aprobada_rrhh', 'finalizar', admin, 5);
      expect(resultado.exito).toBe(false);
    });
  });

  // ─── Utilidades ───

  describe('Utilidades', () => {
    it('obtenerAccionesDisponibles retorna acciones para pendiente_jefe', () => {
      const acciones = obtenerAccionesDisponibles('pendiente_jefe');
      expect(acciones).toContain('aprobar_jefe');
      expect(acciones).toContain('rechazar_jefe');
      expect(acciones).toContain('cancelar');
    });

    it('obtenerAccionesDisponibles retorna vacío para finalizada', () => {
      const acciones = obtenerAccionesDisponibles('finalizada');
      expect(acciones).toHaveLength(0);
    });

    it('puedeTransicionar dice si y no correctamente', () => {
      expect(puedeTransicionar('pendiente_jefe', 'aprobar_jefe', jefe).valido).toBe(true);
      expect(puedeTransicionar('pendiente_jefe', 'aprobar_jefe', empleado).valido).toBe(false);
    });

    it('obtenerMapaTransiciones retorna array no vacío', () => {
      const mapa = obtenerMapaTransiciones();
      expect(mapa.length).toBeGreaterThan(0);
      expect(mapa[0]).toHaveProperty('desde');
      expect(mapa[0]).toHaveProperty('hacia');
      expect(mapa[0]).toHaveProperty('accion');
    });

    it('ESTADOS_CONFIG tiene 8 estados', () => {
      expect(Object.keys(ESTADOS_CONFIG)).toHaveLength(8);
    });

    it('cada estado tiene label, color y esFinal', () => {
      Object.values(ESTADOS_CONFIG).forEach((cfg) => {
        expect(cfg).toHaveProperty('label');
        expect(cfg).toHaveProperty('bgColor');
        expect(cfg).toHaveProperty('textColor');
        expect(typeof cfg.esFinal).toBe('boolean');
      });
    });
  });
});
