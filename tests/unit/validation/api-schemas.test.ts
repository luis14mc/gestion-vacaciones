import { describe, it, expect } from 'vitest';
import {
  asignacionMasivaSchema,
  asignarRolSchema,
  balanceAjusteSchema,
  cambiarPasswordSchema,
  cantidadDiasSchema,
} from '@/lib/validation/api-schemas';
import {
  rateLimitKeyEmail,
  rateLimitKeyIp,
} from '@/lib/rate-limiter';

describe('api-schemas', () => {
  it('rechaza cantidadAsignada negativa en asignación masiva', () => {
    const result = asignacionMasivaSchema.safeParse({
      departamentoId: 1,
      tipoAusencia: 'vacaciones',
      cantidadAsignada: -5,
    });
    expect(result.success).toBe(false);
  });

  it.each([23.7, 0.5, 1.25, 12.6667])('acepta cantidad decimal %s', (cantidad) => {
    expect(
      cantidadDiasSchema.safeParse(cantidad).success ||
        cantidadDiasSchema.safeParse(String(cantidad)).success
    ).toBe(true);
  });

  it('rechaza más de 4 decimales en cantidadDiasSchema', () => {
    expect(cantidadDiasSchema.safeParse(12.66678).success).toBe(false);
  });

  it('rechaza texto no numérico en balanceAjusteSchema', () => {
    const result = balanceAjusteSchema.safeParse({
      usuarioId: 1,
      tipoAusencia: 'vacaciones',
      cantidadInicial: 'no-es-numero',
      anio: 2026,
    });
    expect(result.success).toBe(false);
  });

  it('acepta 23.70 en balanceAjusteSchema sin truncar', () => {
    const result = balanceAjusteSchema.safeParse({
      usuarioId: 1,
      tipoAusencia: 'vacaciones',
      cantidadInicial: '23.70',
      anio: 2026,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cantidadInicial).toBe(23.7);
    }
  });

  it('acepta rolCodigo de la whitelist', () => {
    const result = asignarRolSchema.safeParse({
      usuarioId: 1,
      rolCodigo: 'RRHH',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nueva contraseña igual a la actual', () => {
    const result = cambiarPasswordSchema.safeParse({
      currentPassword: 'abc123',
      newPassword: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('rate-limiter keys', () => {
  it('normaliza email en minúsculas', () => {
    expect(rateLimitKeyEmail('User@CNI.HN')).toBe('login:email:user@cni.hn');
  });

  it('genera clave por IP', () => {
    expect(rateLimitKeyIp('203.0.113.1')).toBe('login:ip:203.0.113.1');
  });
});
