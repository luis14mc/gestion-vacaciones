import { describe, it, expect } from 'vitest';
import { generarPasswordTemporal } from '@/lib/security/password';

describe('generarPasswordTemporal', () => {
  it('respeta la longitud mínima de 12 aunque se pida menos', () => {
    expect(generarPasswordTemporal(4).length).toBe(12);
  });

  it('genera la longitud solicitada cuando es mayor a 12', () => {
    expect(generarPasswordTemporal(20).length).toBe(20);
  });

  it('incluye mayúscula, minúscula, dígito y carácter especial', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generarPasswordTemporal(12);
      expect(/[A-Z]/.test(pw)).toBe(true);
      expect(/[a-z]/.test(pw)).toBe(true);
      expect(/[0-9]/.test(pw)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(pw)).toBe(true);
    }
  });

  it('genera contraseñas distintas en llamadas sucesivas', () => {
    const a = generarPasswordTemporal();
    const b = generarPasswordTemporal();
    expect(a).not.toBe(b);
  });
});
