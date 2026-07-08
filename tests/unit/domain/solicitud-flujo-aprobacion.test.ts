import { describe, it, expect } from 'vitest';
import { resolverFlujoAprobacionNuevaSolicitud } from '@/lib/domain/solicitud-flujo-aprobacion';
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

  it('Director en cumpleaños: no requiere VoBo', () => {
    const flujo = resolverFlujoAprobacionNuevaSolicitud({
      esDirector: true,
      esJefe: false,
      departamentoNombre: 'Operaciones',
      tipo: 'dia_cumpleanos',
    });

    expect(flujo.requiereVoBoMinistro).toBe(false);
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
});
