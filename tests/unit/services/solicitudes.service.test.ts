import { describe, it, expect } from 'vitest';
import * as SolicitudesService from '../../../src/services/solicitudes.service';
import * as WorkflowService from '../../../src/services/workflow.service';

describe('solicitudes.service.ts - API pública', () => {
  it('exporta operaciones CRUD/listado activas', () => {
    expect(SolicitudesService.crearSolicitud).toBeDefined();
    expect(typeof SolicitudesService.crearSolicitud).toBe('function');

    expect(SolicitudesService.listarSolicitudes).toBeDefined();
    expect(typeof SolicitudesService.listarSolicitudes).toBe('function');

    expect(SolicitudesService.obtenerSolicitudPorId).toBeDefined();
    expect(typeof SolicitudesService.obtenerSolicitudPorId).toBe('function');
  });

  it('no expone funciones legacy de aprobación (workflow es la vía viva)', () => {
    expect(SolicitudesService).not.toHaveProperty('aprobarSolicitudJefe');
    expect(SolicitudesService).not.toHaveProperty('aprobarSolicitudRRHH');
    expect(SolicitudesService).not.toHaveProperty('rechazarSolicitud');
    expect(SolicitudesService).not.toHaveProperty('cancelarSolicitud');
  });

  it('delega transiciones de estado a workflow.service', () => {
    expect(WorkflowService.ejecutarAccion).toBeDefined();
    expect(typeof WorkflowService.ejecutarAccion).toBe('function');
    expect(WorkflowService.obtenerAccionesParaSolicitud).toBeDefined();
    expect(WorkflowService.procesarTransicionesAutomaticas).toBeDefined();
  });
});
