import { describe, it, expect } from 'vitest';
import * as UsuariosService from '../../../src/services/usuarios.service';

describe('usuarios.service.ts - Estructura y Exportaciones', () => {
  it('debe exportar todas las funciones principales del servicio', () => {
    expect(UsuariosService.crearUsuario).toBeDefined();
    expect(typeof UsuariosService.crearUsuario).toBe('function');
    
    expect(UsuariosService.actualizarUsuario).toBeDefined();
    expect(typeof UsuariosService.actualizarUsuario).toBe('function');
    
    expect(UsuariosService.desactivarUsuario).toBeDefined();
    expect(typeof UsuariosService.desactivarUsuario).toBe('function');
    
    expect(UsuariosService.asignarRol).toBeDefined();
    expect(typeof UsuariosService.asignarRol).toBe('function');
    
    expect(UsuariosService.cambiarPassword).toBeDefined();
    expect(typeof UsuariosService.cambiarPassword).toBe('function');
    
    expect(UsuariosService.listarUsuarios).toBeDefined();
    expect(typeof UsuariosService.listarUsuarios).toBe('function');
  });

  it('debe tener las firmas correctas (async)', () => {
    expect(UsuariosService.crearUsuario.constructor.name).toBe('AsyncFunction');
    expect(UsuariosService.actualizarUsuario.constructor.name).toBe('AsyncFunction');
    expect(UsuariosService.cambiarPassword.constructor.name).toBe('AsyncFunction');
  });

  it('debe documentar casos de uso esenciales', () => {
    const serviceFunctions = [
      'crearUsuario',
      'actualizarUsuario',
      'desactivarUsuario',
      'asignarRol',
      'cambiarPassword',
      'listarUsuarios'
    ];
    
    serviceFunctions.forEach(fnName => {
      expect(UsuariosService).toHaveProperty(fnName);
    });
  });
});
