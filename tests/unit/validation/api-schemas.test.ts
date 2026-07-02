import { describe, it, expect } from 'vitest';
import {
  asignacionMasivaSchema,
  asignarRolSchema,
  cambiarPasswordSchema,
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
