import { describe, it, expect } from 'vitest';
import {
  validarCamposImportacionUsuario,
  validarJefeSuperiorImportacion,
} from '@/lib/schemas/usuario-import.schema';

describe('usuario-import.schema', () => {
  it('exige nombre y apellido de al menos 2 caracteres', () => {
    const errores = validarCamposImportacionUsuario({
      email: 'a@b.com',
      nombre: 'A',
      apellido: 'B',
    });
    expect(errores.some((e) => e.includes('nombre'))).toBe(true);
    expect(errores.some((e) => e.includes('apellido'))).toBe(true);
  });

  it('acepta fila valida', () => {
    const errores = validarCamposImportacionUsuario({
      email: 'juan@cni.hn',
      nombre: 'Juan',
      apellido: 'Perez',
      telefono: '9999-0000',
      direccion: 'Tegucigalpa',
    });
    expect(errores).toHaveLength(0);
  });

  it('jefe superior debe ser jefe o director del mismo departamento', () => {
    expect(
      validarJefeSuperiorImportacion(
        {
          email: 'jefe@cni.hn',
          departamentoId: 1,
          esJefe: false,
          esDirector: false,
        },
        1
      )
    ).toMatch(/Jefe o Director/);

    expect(
      validarJefeSuperiorImportacion(
        {
          email: 'jefe@cni.hn',
          departamentoId: 2,
          esJefe: true,
          esDirector: false,
        },
        1
      )
    ).toMatch(/mismo departamento/);

    expect(
      validarJefeSuperiorImportacion(
        {
          email: 'jefe@cni.hn',
          departamentoId: 1,
          esJefe: true,
          esDirector: false,
        },
        1
      )
    ).toBeNull();
  });
});
