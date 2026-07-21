import { describe, it, expect } from 'vitest';
import {
  resolverRequisitosAdjuntosSolicitud,
  validarAdjuntosObligatorios,
  normalizarAdjuntosHistoricos,
  etiquetaAdjunto,
} from '@/lib/domain/requisitos-adjuntos';

describe('requisitos-adjuntos — Fase 3 VoBo obligatorio', () => {
  describe('resolverRequisitosAdjuntosSolicitud', () => {
    it('Empleado normal requiere vobo_jefe', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: false, esJefe: false },
        tipoSolicitud: 'vacaciones',
        flujoAprobacion: {
          requiereVoBoMinistro: false,
          aprobadorSegundoNivelTipo: 'director',
        },
      });
      expect(r.requiereVoBo).toBe(true);
      expect(r.tipoVoBoRequerido).toBe('vobo_jefe');
      expect(r.etiquetaVoBo).toBe('VoBo del Jefe inmediato');
      expect(r.adjuntosRequeridos).toHaveLength(1);
      expect(r.adjuntosRequeridos[0].tipo).toBe('vobo_jefe');
    });

    it('Jefe con Director disponible requiere vobo_director', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: false, esJefe: true },
        tipoSolicitud: 'vacaciones',
        flujoAprobacion: {
          requiereVoBoMinistro: false,
          aprobadorSegundoNivelTipo: 'director',
        },
      });
      expect(r.tipoVoBoRequerido).toBe('vobo_director');
      expect(r.etiquetaVoBo).toBe('VoBo del Director de Área');
      expect(r.adjuntosRequeridos[0].obligatorio).toBe(true);
    });

    it('Jefe sin Director requiere vobo_secretario_general (Dir. SG)', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: false, esJefe: true },
        tipoSolicitud: 'vacaciones',
        flujoAprobacion: {
          requiereVoBoMinistro: false,
          aprobadorSegundoNivelTipo: 'director_secretaria_general',
        },
      });
      expect(r.tipoVoBoRequerido).toBe('vobo_secretario_general');
      expect(r.etiquetaVoBo).toBe('VoBo del Director de Secretaría General');
    });

    it('Director en vacaciones requiere vobo_ministro', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: true, esJefe: false },
        tipoSolicitud: 'vacaciones',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.tipoVoBoRequerido).toBe('vobo_ministro');
      expect(r.etiquetaVoBo).toBe('VoBo del Ministro');
    });

    it('Director en permiso 1-2h NO requiere VoBo', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: true, esJefe: false },
        tipoSolicitud: 'permiso_salida',
        duracionPermiso: '1-2h',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.tipoVoBoRequerido).toBeNull();
      expect(r.requiereVoBo).toBe(false);
      expect(r.adjuntosRequeridos).toHaveLength(0);
    });

    it('Director en permiso día completo requiere VoBo', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: true, esJefe: false },
        tipoSolicitud: 'permiso_salida',
        duracionPermiso: 'dia_completo',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.tipoVoBoRequerido).toBe('vobo_ministro');
    });

    it('Director en cumpleaños NO requiere VoBo', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: true, esJefe: false },
        tipoSolicitud: 'dia_cumpleanos',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.tipoVoBoRequerido).toBeNull();
      expect(r.adjuntosRequeridos).toHaveLength(0);
    });

    it('Director de Secretaría General (esDirector) requiere vobo_ministro', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: {
          esDirector: true,
          esJefe: false,
        },
        tipoSolicitud: 'vacaciones',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.tipoVoBoRequerido).toBe('vobo_ministro');
      expect(r.etiquetaVoBo).toBe('VoBo del Ministro');
    });

    it('Licencia médica de empleado normal requiere VoBo + constancia', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: false, esJefe: false },
        tipoSolicitud: 'licencia_medica',
        flujoAprobacion: {
          requiereVoBoMinistro: false,
          aprobadorSegundoNivelTipo: 'director',
        },
      });
      expect(r.requiereConstanciaMedica).toBe(true);
      const tipos = r.adjuntosRequeridos.map((a) => a.tipo);
      expect(tipos).toContain('vobo_jefe');
      expect(tipos).toContain('constancia_medica');
      expect(r.adjuntosRequeridos).toHaveLength(2);
    });

    it('Licencia médica de Director requiere VoBo Ministro + constancia', () => {
      const r = resolverRequisitosAdjuntosSolicitud({
        usuarioSolicitante: { esDirector: true, esJefe: false },
        tipoSolicitud: 'licencia_medica',
        flujoAprobacion: { requiereVoBoMinistro: true },
      });
      expect(r.requiereConstanciaMedica).toBe(true);
      const tipos = r.adjuntosRequeridos.map((a) => a.tipo);
      expect(tipos).toContain('vobo_ministro');
      expect(tipos).toContain('constancia_medica');
    });
  });

  describe('validarAdjuntosObligatorios', () => {
    it('devuelve null si no hay adjuntos requeridos', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: false,
          tipoVoBoRequerido: null,
          etiquetaVoBo: null,
          requiereConstanciaMedica: false,
          adjuntosRequeridos: [],
        },
        documentosAdjuntos: [],
      });
      expect(r).toBeNull();
    });

    it('devuelve null si todos los obligatorios están presentes', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: true,
          tipoVoBoRequerido: 'vobo_jefe',
          etiquetaVoBo: 'VoBo del Jefe',
          requiereConstanciaMedica: false,
          adjuntosRequeridos: [
            { tipo: 'vobo_jefe', etiqueta: 'X', mensajeFaltante: 'Falta', obligatorio: true },
          ],
        },
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      });
      expect(r).toBeNull();
    });

    it('devuelve mensaje claro cuando falta el VoBo del Jefe', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: true,
          tipoVoBoRequerido: 'vobo_jefe',
          etiquetaVoBo: 'VoBo del Jefe',
          requiereConstanciaMedica: false,
          adjuntosRequeridos: [
            { tipo: 'vobo_jefe', etiqueta: 'X', mensajeFaltante: 'Debe adjuntar el VoBo del Jefe inmediato.', obligatorio: true },
          ],
        },
        documentosAdjuntos: [],
      });
      expect(r).toBe('Debe adjuntar el VoBo del Jefe inmediato.');
    });

    it('devuelve mensaje claro cuando falta la constancia médica', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: true,
          tipoVoBoRequerido: 'vobo_jefe',
          etiquetaVoBo: 'X',
          requiereConstanciaMedica: true,
          adjuntosRequeridos: [
            { tipo: 'vobo_jefe', etiqueta: 'X', mensajeFaltante: 'Falta VoBo', obligatorio: true },
            { tipo: 'constancia_medica', etiqueta: 'X', mensajeFaltante: 'Debe adjuntar la constancia médica.', obligatorio: true },
          ],
        },
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      });
      expect(r).toBe('Debe adjuntar la constancia médica.');
    });

    it('rechaza adjunto con tipo incorrecto', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: true,
          tipoVoBoRequerido: 'vobo_ministro',
          etiquetaVoBo: 'X',
          requiereConstanciaMedica: false,
          adjuntosRequeridos: [
            { tipo: 'vobo_ministro', etiqueta: 'X', mensajeFaltante: 'Falta VoBo Ministro', obligatorio: true },
          ],
        },
        documentosAdjuntos: [{ tipo: 'vobo_jefe', data: 'data:...' }],
      });
      expect(r).toBe('Falta VoBo Ministro');
    });

    it('acepta adjunto que solo trae `nombre` (compatibilidad histórica)', () => {
      const r = validarAdjuntosObligatorios({
        requisitos: {
          requiereVoBo: true,
          tipoVoBoRequerido: 'vobo_ministro',
          etiquetaVoBo: 'X',
          requiereConstanciaMedica: false,
          adjuntosRequeridos: [
            { tipo: 'vobo_ministro', etiqueta: 'X', mensajeFaltante: 'Falta VoBo', obligatorio: true },
          ],
        },
        // Sin campo `tipo` (solo `nombre`), como en solicitudes legacy
        documentosAdjuntos: [{ nombre: 'vobo_ministro', data: 'data:...' }],
      });
      expect(r).toBeNull();
    });
  });

  describe('prepararAdjuntosVisor', () => {
    it('incluye adjuntos sin data embebida para carga vía API', async () => {
      const { prepararAdjuntosVisor } = await import('@/lib/domain/requisitos-adjuntos');
      const out = prepararAdjuntosVisor([
        { tipo: 'vobo_jefe', nombre: 'vobo.pdf' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].indiceOriginal).toBe(0);
      expect(out[0].data).toBeUndefined();
      expect(out[0].nombre).toBe('vobo.pdf');
    });
  });

  describe('normalizarAdjuntosHistoricos', () => {
    it('mapea adjuntos sin tipo hacia el campo `tipo`', () => {
      const out = normalizarAdjuntosHistoricos([
        { nombre: 'vobo_ministro', data: 'data:...' },
        { nombre: 'constancia_medica', data: 'data:...' },
      ]);
      expect(out).toHaveLength(2);
      expect(out[0].tipo).toBe('vobo_ministro');
      expect(out[0].nombre).toBe('vobo_ministro');
      expect(out[1].tipo).toBe('constancia_medica');
    });

    it('preserva tipo cuando ya existe', () => {
      const out = normalizarAdjuntosHistoricos([
        { tipo: 'vobo_jefe', nombre: 'correo.pdf', data: 'data:...' },
      ]);
      expect(out[0].tipo).toBe('vobo_jefe');
      expect(out[0].nombre).toBe('correo.pdf');
    });

    it('preserva indiceOriginal del arreglo original', () => {
      const out = normalizarAdjuntosHistoricos([
        { nombre: 'sin-data' },
        { nombre: 'con-data', data: 'data:...' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].indiceOriginal).toBe(1);
    });

    it('filtra adjuntos sin data', () => {
      const out = normalizarAdjuntosHistoricos([
        { nombre: 'sin-data' },
        { nombre: 'con-data', data: 'data:...' },
      ]);
      expect(out).toHaveLength(1);
    });

    it('devuelve [] para entrada inválida', () => {
      expect(normalizarAdjuntosHistoricos(null)).toEqual([]);
      expect(normalizarAdjuntosHistoricos(undefined)).toEqual([]);
      expect(normalizarAdjuntosHistoricos('not-an-array')).toEqual([]);
    });
  });

  describe('etiquetaAdjunto', () => {
    it('devuelve etiqueta legible para tipos conocidos', () => {
      expect(etiquetaAdjunto('vobo_jefe')).toBe('VoBo del Jefe inmediato');
      expect(etiquetaAdjunto('vobo_director')).toBe('VoBo del Director de Área');
      expect(etiquetaAdjunto('vobo_secretario_general')).toBe(
        'VoBo del Director de Secretaría General'
      );
      expect(etiquetaAdjunto('vobo_ministro')).toBe('VoBo del Ministro');
      expect(etiquetaAdjunto('constancia_medica')).toBe('Constancia médica');
    });

    it('devuelve el mismo string para tipos desconocidos', () => {
      expect(etiquetaAdjunto('adjunto_xyz')).toBe('adjunto_xyz');
    });
  });
});