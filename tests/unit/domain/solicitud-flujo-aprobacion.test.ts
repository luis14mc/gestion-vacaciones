import { describe, it, expect } from 'vitest';
import {
  resolverFlujoAprobacionNuevaSolicitud,
  mensajeFlujoVisible,
} from '@/lib/domain/solicitud-flujo-aprobacion';
import { FLUJO_ESPECIAL_JEFE_DIR_ADMIN } from '@/lib/domain/solicitud-flujo-inicial';

describe('solicitud-flujo-aprobacion', () => {
  it('Jefe de Dirección Administrativa: pasa directo a RRHH sin VoBo', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Dirección Administrativa',
      tipo: 'vacaciones',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
    expect(flujo.requiereAprobacionDirector).toBe(false);
    expect(flujo.pasaDirectoRrhh).toBe(true);
    expect(flujo.flujoEspecial).toBe(FLUJO_ESPECIAL_JEFE_DIR_ADMIN);
    expect(flujo.pasosProceso[0]).toMatch(/Derivación directa a Recursos Humanos/i);
  });

  it('Director normal: requiere VoBo del Ministro', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
      tipo: 'vacaciones',
    });

    expect(flujo.requiereVoBoMinistro).toBe(true);
    expect(flujo.pasaDirectoRrhh).toBe(false);
    expect(flujo.pasosProceso[0]).toMatch(/VoBo Ministro/i);
  });

  it('Director en permiso de salida: flujo director con VoBo condicionado por duración', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
      tipo: 'permiso_salida',
    });

    expect(flujo.requiereVoBoMinistro).toBe(true);
    expect(flujo.pasosProceso[0]).toMatch(/VoBo Ministro/i);
  });

  it('Director en cumpleaños: no requiere VoBo', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
      tipo: 'dia_cumpleanos',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
  });

  it('Director en licencia médica: flujo de jefe/empleado sin VoBo', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
      tipo: 'licencia_medica',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
    expect(flujo.requiereAprobacionJefe).toBe(true);
  });

  it('Jefe normal: requiere aprobación de Director', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Tecnología',
      tipo: 'vacaciones',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
    expect(flujo.requiereAprobacionDirector).toBe(true);
    expect(flujo.pasosProceso[0]).toMatch(/Director de Área/i);
  });

  it('Empleado normal: requiere aprobación de jefe', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: false,
      esJefe: false,
      departamentoNombre: 'Dirección Administrativa',
      tipo: 'vacaciones',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
    expect(flujo.requiereAprobacionJefe).toBe(true);
    expect(flujo.pasosProceso[0]).toMatch(/Jefe Inmediato/i);
  });

  it('mensajeFlujoVisible: director permiso 1-2h sin mencionar VoBo obligatorio', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
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

  it('mensajeFlujoVisible: director permiso día completo mantiene mensaje VoBo', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
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
