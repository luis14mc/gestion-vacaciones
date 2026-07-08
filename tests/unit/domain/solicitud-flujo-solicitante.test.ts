import { describe, it, expect } from 'vitest';
import {
  resolverFlujoSolicitante,
  type DatosFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';

describe('solicitud-flujo-solicitante', () => {
  it('delega en resolverFlujoAprobacionNuevaSolicitud', () => {
    const datos: DatosFlujoSolicitante = {
      esDirector: false,
      esJefe: true,
      departamentoNombre: 'Dirección Administrativa',
    };

    const flujo = resolverFlujoSolicitante(datos, 'vacaciones');

    expect(flujo.pasaDirectoRrhh).toBe(true);
    expect(flujo.requiereVoBoMinistro).toBe(false);
  });
});
