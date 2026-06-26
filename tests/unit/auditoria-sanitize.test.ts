import { describe, expect, it } from 'vitest';
import {
  parseDetallesAuditoria,
  sanitizarDetallesAuditoria,
} from '@/lib/domain/auditoria/sanitize';

describe('auditoria sanitize', () => {
  it('enmascara campos sensibles', () => {
    const result = sanitizarDetallesAuditoria({
      smtp_password: 'secret123',
      password: 'abc',
      token: 'jwt',
      clave: 'visible',
    }) as Record<string, unknown>;

    expect(result.smtp_password).toBe('***');
    expect(result.password).toBe('***');
    expect(result.token).toBe('***');
    expect(result.clave).toBe('visible');
  });

  it('parsea JSON válido', () => {
    const { parsed, textoPlano } = parseDetallesAuditoria('{"evento":"login_exitoso"}');
    expect(parsed?.evento).toBe('login_exitoso');
    expect(textoPlano).toBeNull();
  });

  it('no rompe con texto plano inválido', () => {
    const { parsed, textoPlano } = parseDetallesAuditoria('evento manual: prueba');
    expect(parsed).toBeNull();
    expect(textoPlano).toContain('evento manual');
  });
});
