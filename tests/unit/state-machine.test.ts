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
  esSubordinadoDirecto: true,
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
  esSubordinadoDirecto: true,
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

  describe('Flujo completo Fase 2: empleado pendiente_jefe → pendiente_rrhh → aprobada_rrhh', () => {
    it('empleado puede enviar borrador → pendiente_jefe', () => {
      const resultado = transicionar('borrador', 'enviar', empleado, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_jefe');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'RESERVAR_BALANCE' })
      );
    });

    it('jefe aprueba pendiente_jefe → pendiente_rrhh (sin Director)', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', jefe, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_rrhh');
    });

    it('Director aprueba pendiente_director → pendiente_rrhh', () => {
      const directorCtx: TransicionContexto = {
        usuarioId: 50,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        aprobadorSegundoNivelId: 50,
        aprobadorSegundoNivelTipo: 'director',
      };
      const resultado = transicionar('pendiente_director', 'aprobar_director', directorCtx, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_rrhh');
    });

    it('Director de Secretaría General aprueba pendiente_secretario_general → pendiente_rrhh', () => {
      const sgCtx: TransicionContexto = {
        usuarioId: 99,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSecretarioGeneral: false,
        aprobadorSegundoNivelId: 99,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      };
      const resultado = transicionar(
        'pendiente_secretario_general',
        'aprobar_secretario_general',
        sgCtx,
        5
      );
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_rrhh');
    });

    it('RRHH aprueba pendiente_rrhh → aprobada_rrhh', () => {
      const resultado = transicionar('pendiente_rrhh', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_rrhh');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'CONFIRMAR_BALANCE' })
      );
    });

    it('Legacy: aprobada_jefe sigue aprobable por RRHH (compatibilidad hacia atrás)', () => {
      const resultado = transicionar('aprobada_jefe', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('aprobada_rrhh');
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

    it('RRHH puede rechazar solicitud aprobada por jefe (legacy)', () => {
      const resultado = transicionar('aprobada_jefe', 'rechazar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_rrhh');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'LIBERAR_BALANCE' })
      );
    });

    it('RRHH puede rechazar pendiente_rrhh', () => {
      const resultado = transicionar('pendiente_rrhh', 'rechazar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_rrhh');
    });

    it('Director puede rechazar pendiente_director', () => {
      const directorCtx: TransicionContexto = {
        usuarioId: 50,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        aprobadorSegundoNivelId: 50,
        aprobadorSegundoNivelTipo: 'director',
      };
      const resultado = transicionar('pendiente_director', 'rechazar_director', directorCtx, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_director');
    });

    it('Dir. Secretaría General puede rechazar pendiente_secretario_general', () => {
      const sgCtx: TransicionContexto = {
        usuarioId: 99,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSecretarioGeneral: false,
        aprobadorSegundoNivelId: 99,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      };
      const resultado = transicionar(
        'pendiente_secretario_general',
        'rechazar_secretario_general',
        sgCtx,
        5
      );
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_secretario_general');
    });
  });

  // ─── Guards de permisos ───

  describe('Guards de permisos', () => {
    it('empleado NO puede aprobar como jefe', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', empleado, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('Jefe o Director');
    });

    it('director puede aprobar solicitud pendiente_jefe → pendiente_rrhh', () => {
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', director, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_rrhh');
    });

    it('jefe NO puede aprobar como RRHH', () => {
      const resultado = transicionar('pendiente_rrhh', 'aprobar_rrhh', jefe, 5);
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
        esSubordinadoDirecto: true,
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
        esSubordinadoDirecto: true,
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
        esSubordinadoDirecto: true,
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
        esSubordinadoDirecto: true,
        solicitanteEsJefe: true,
      };
      const resultado = transicionar('pendiente_jefe', 'aprobar_jefe', directorAprobador, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('pendiente_rrhh');
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
        esSubordinadoDirecto: true,
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
      expect(transicionar('pendiente_rrhh', 'aprobar_rrhh', admin, 5).exito).toBe(true);
    });

    it('jefe NO puede aprobar a alguien que no es subordinado directo', () => {
      const resultado = transicionar(
        'pendiente_jefe',
        'aprobar_jefe',
        { ...jefe, esSubordinadoDirecto: false },
        5
      );
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain('equipo directo');
    });

    it('director sin subordinados directos puede usar fallback de departamento', () => {
      const resultado = transicionar(
        'pendiente_jefe',
        'aprobar_jefe',
        { ...director, esSubordinadoDirecto: false, directorSinSubordinadosDirectos: true },
        5
      );
      expect(resultado.exito).toBe(true);
    });

it('usuario con rol Jefe y RRHH NO puede aprobar su propia solicitud', () => {
      const dobleRol: TransicionContexto = {
        usuarioId: 40,
        solicitanteId: 40,
        esDirector: false,
        esJefe: true,
        esRrhh: true,
        esAdmin: false,
        departamentoAprobador: 1,
        departamentoSolicitante: 1,
      };
      expect(transicionar('pendiente_jefe', 'aprobar_jefe', dobleRol, 5).exito).toBe(false);
      expect(transicionar('pendiente_rrhh', 'aprobar_rrhh', dobleRol, 5).exito).toBe(false);
    });

    it('Director solo puede aprobar pendiente_director de SU ID esperado', () => {
      const directorEsperado: TransicionContexto = {
        usuarioId: 50,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        aprobadorSegundoNivelId: 50,
        aprobadorSegundoNivelTipo: 'director',
      };
      const directorOtro: TransicionContexto = {
        ...directorEsperado,
        usuarioId: 51,
      };
      const ok = transicionar('pendiente_director', 'aprobar_director', directorEsperado, 5);
      const bad = transicionar('pendiente_director', 'aprobar_director', directorOtro, 5);
      expect(ok.exito).toBe(true);
      expect(bad.exito).toBe(false);
      expect(bad.error).toMatch(/no le corresponde/i);
    });

    it('Dir. Secretaría General solo puede aprobar pendiente_secretario_general de SU ID', () => {
      const sgEsperado: TransicionContexto = {
        usuarioId: 99,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSecretarioGeneral: false,
        aprobadorSegundoNivelId: 99,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      };
      const sgOtro: TransicionContexto = {
        ...sgEsperado,
        usuarioId: 100,
      };
      const ok = transicionar(
        'pendiente_secretario_general',
        'aprobar_secretario_general',
        sgEsperado,
        5
      );
      const bad = transicionar(
        'pendiente_secretario_general',
        'aprobar_secretario_general',
        sgOtro,
        5
      );
      expect(ok.exito).toBe(true);
      expect(bad.exito).toBe(false);
    });

    it('Dir. SG NO puede aprobar su propia solicitud aunque sea aprobador', () => {
      const sgSolicitante: TransicionContexto = {
        usuarioId: 99,
        solicitanteId: 99,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSecretarioGeneral: false,
        aprobadorSegundoNivelId: 99,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      };
      const r = transicionar(
        'pendiente_secretario_general',
        'aprobar_secretario_general',
        sgSolicitante,
        5
      );
      expect(r.exito).toBe(false);
      expect(r.error).toMatch(/propia solicitud/i);
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

  // ─── Fase 4: Rechazos finales por nivel (no escapan a RRHH) ───

  describe('Fase 4: rechazos previos a RRHH son estados finales', () => {
    it('pendiente_jefe + rechazar_jefe → rechazada_jefe (LIBERAR_BALANCE)', () => {
      const resultado = transicionar('pendiente_jefe', 'rechazar_jefe', jefe, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_jefe');
      expect(resultado.efectos).toContainEqual(
        expect.objectContaining({ tipo: 'LIBERAR_BALANCE' })
      );
    });

    it('pendiente_director + rechazar_director → rechazada_director', () => {
      const directorCtx: TransicionContexto = {
        usuarioId: 50,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        aprobadorSegundoNivelId: 50,
        aprobadorSegundoNivelTipo: 'director',
      };
      const resultado = transicionar('pendiente_director', 'rechazar_director', directorCtx, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_director');
    });

    it('pendiente_secretario_general + rechazar_secretario_general → rechazada_secretario_general', () => {
      const sgCtx: TransicionContexto = {
        usuarioId: 99,
        solicitanteId: 10,
        esDirector: true,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSecretarioGeneral: false,
        aprobadorSegundoNivelId: 99,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
      };
      const resultado = transicionar(
        'pendiente_secretario_general',
        'rechazar_secretario_general',
        sgCtx,
        5
      );
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('rechazada_secretario_general');
    });

    it('rechazada_jefe es estado final (RRHH no puede aprobar)', () => {
      const resultado = transicionar('rechazada_jefe', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('rechazada_director es estado final (RRHH no puede aprobar)', () => {
      const resultado = transicionar('rechazada_director', 'aprobar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('rechazada_secretario_general es estado final (RRHH no puede aprobar)', () => {
      const resultado = transicionar(
        'rechazada_secretario_general',
        'aprobar_rrhh',
        rrhh,
        5
      );
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('rechazada_jefe: RRHH no puede rechazar tampoco', () => {
      const resultado = transicionar('rechazada_jefe', 'rechazar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('rechazada_director: RRHH no puede rechazar tampoco', () => {
      const resultado = transicionar('rechazada_director', 'rechazar_rrhh', rrhh, 5);
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('rechazada_secretario_general: RRHH no puede rechazar tampoco', () => {
      const resultado = transicionar(
        'rechazada_secretario_general',
        'rechazar_rrhh',
        rrhh,
        5
      );
      expect(resultado.exito).toBe(false);
      expect(resultado.error).toMatch(/final/i);
    });

    it('obtenerAccionesDisponibles retorna vacío para rechazada_jefe', () => {
      expect(obtenerAccionesDisponibles('rechazada_jefe')).toHaveLength(0);
    });

    it('obtenerAccionesDisponibles retorna vacío para rechazada_director', () => {
      expect(obtenerAccionesDisponibles('rechazada_director')).toHaveLength(0);
    });

    it('obtenerAccionesDisponibles retorna vacío para rechazada_secretario_general', () => {
      expect(obtenerAccionesDisponibles('rechazada_secretario_general')).toHaveLength(0);
    });

    it('esEstadoFinal reconoce rechazada_jefe/director/secretario como finales', async () => {
      const { esEstadoFinal } = await import('@/lib/domain/state-machine');
      expect(esEstadoFinal('rechazada_jefe')).toBe(true);
      expect(esEstadoFinal('rechazada_director')).toBe(true);
      expect(esEstadoFinal('rechazada_secretario_general')).toBe(true);
      expect(esEstadoFinal('rechazada_rrhh')).toBe(true);
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
    it('el sistema puede finalizar una solicitud aprobada_rrhh', () => {
      const sistema: TransicionContexto = {
        usuarioId: 0,
        solicitanteId: 10,
        esDirector: false,
        esJefe: false,
        esRrhh: false,
        esAdmin: false,
        esSistema: true,
      };
      const resultado = transicionar('aprobada_rrhh', 'finalizar', sistema, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('finalizada');
    });

    it('un admin también puede finalizar manualmente', () => {
      const resultado = transicionar('aprobada_rrhh', 'finalizar', admin, 5);
      expect(resultado.exito).toBe(true);
      expect(resultado.estadoNuevo).toBe('finalizada');
    });

    it('RRHH (sin ser sistema/admin) NO puede finalizar', () => {
      const resultado = transicionar('aprobada_rrhh', 'finalizar', rrhh, 5);
      expect(resultado.exito).toBe(false);
    });

    it('finalizada es estado final (no transiciona)', () => {
      const resultado = transicionar('finalizada', 'finalizar', admin, 5);
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

    it('obtenerAccionesDisponibles retorna acciones para pendiente_director', () => {
      const acciones = obtenerAccionesDisponibles('pendiente_director');
      expect(acciones).toContain('aprobar_director');
      expect(acciones).toContain('rechazar_director');
    });

    it('obtenerAccionesDisponibles retorna acciones para pendiente_secretario_general', () => {
      const acciones = obtenerAccionesDisponibles('pendiente_secretario_general');
      expect(acciones).toContain('aprobar_secretario_general');
      expect(acciones).toContain('rechazar_secretario_general');
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

    it('ESTADOS_CONFIG tiene 15 estados (Fase 2)', () => {
      expect(Object.keys(ESTADOS_CONFIG)).toHaveLength(15);
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
