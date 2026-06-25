import { describe, it, expect } from 'vitest';
import * as SolicitudesService from '../../../src/services/solicitudes.service';

describe('solicitudes.service.ts - Estructura y Exportaciones', () => {
  it('debe exportar todas las funciones principales del servicio', () => {
    expect(SolicitudesService.crearSolicitud).toBeDefined();
    expect(typeof SolicitudesService.crearSolicitud).toBe('function');
    
    expect(SolicitudesService.aprobarSolicitudJefe).toBeDefined();
    expect(typeof SolicitudesService.aprobarSolicitudJefe).toBe('function');
    
    expect(SolicitudesService.aprobarSolicitudRRHH).toBeDefined();
    expect(typeof SolicitudesService.aprobarSolicitudRRHH).toBe('function');
    
    expect(SolicitudesService.rechazarSolicitud).toBeDefined();
    expect(typeof SolicitudesService.rechazarSolicitud).toBe('function');
    
    expect(SolicitudesService.listarSolicitudes).toBeDefined();
    expect(typeof SolicitudesService.listarSolicitudes).toBe('function');
    
    expect(SolicitudesService.obtenerSolicitudPorId).toBeDefined();
    expect(typeof SolicitudesService.obtenerSolicitudPorId).toBe('function');
  });

  it('debe tener las firmas correctas (async)', () => {
    expect(SolicitudesService.crearSolicitud.constructor.name).toBe('AsyncFunction');
    expect(SolicitudesService.aprobarSolicitudJefe.constructor.name).toBe('AsyncFunction');
    expect(SolicitudesService.listarSolicitudes.constructor.name).toBe('AsyncFunction');
  });

  it('debe documentar casos de uso esenciales', () => {
    // Esta suite valida que el servicio existe y está bien estructurado.
    // Para tests funcionales completos, usar tests de integración con DB real.
    const serviceFunctions = [
      'crearSolicitud',
      'aprobarSolicitudJefe', 
      'aprobarSolicitudRRHH',
      'rechazarSolicitud',
      'listarSolicitudes',
      'obtenerSolicitudPorId'
    ];
    
    serviceFunctions.forEach(fnName => {
      expect(SolicitudesService).toHaveProperty(fnName);
    });
  });
});
