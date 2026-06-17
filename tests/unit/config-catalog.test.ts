import { describe, it, expect } from 'vitest';
import { validarConfig, getConfigMeta, CONFIG_KEYS } from '@/lib/config/catalog';

describe('config catalog - validarConfig', () => {
  it('rechaza claves desconocidas', () => {
    expect(validarConfig('clave.inexistente', 'x')).toContain('desconocida');
  });

  it('acepta un booleano válido y rechaza uno inválido', () => {
    expect(validarConfig('vacaciones.permitir_medio_dia', 'true')).toBeNull();
    expect(validarConfig('vacaciones.permitir_medio_dia', 'si')).not.toBeNull();
  });

  it('valida rangos numéricos', () => {
    expect(validarConfig('vacaciones.dias_anuales_default', '15')).toBeNull();
    expect(validarConfig('vacaciones.dias_anuales_default', '0')).not.toBeNull();
    expect(validarConfig('vacaciones.dias_anuales_default', '999')).not.toBeNull();
  });

  it('valida email del remitente', () => {
    expect(validarConfig('notificaciones.email_remitente', 'a@b.com')).toBeNull();
    expect(validarConfig('notificaciones.email_remitente', 'no-es-email')).not.toBeNull();
  });

  it('valida puerto SMTP', () => {
    expect(validarConfig('notificaciones.smtp_port', '587')).toBeNull();
    expect(validarConfig('notificaciones.smtp_port', '70000')).not.toBeNull();
  });
});

describe('config catalog - getConfigMeta', () => {
  it('clasifica categoria por prefijo (app -> general)', () => {
    expect(getConfigMeta('app.nombre').categoria).toBe('general');
    expect(getConfigMeta('seguridad.intentos_login_max').categoria).toBe('seguridad');
  });

  it('marca públicas solo general y vacaciones', () => {
    expect(getConfigMeta('app.nombre').esPublico).toBe(true);
    expect(getConfigMeta('vacaciones.dias_anuales_default').esPublico).toBe(true);
    expect(getConfigMeta('notificaciones.smtp_password').esPublico).toBe(false);
    expect(getConfigMeta('seguridad.password_min_length').esPublico).toBe(false);
  });

  it('infiere tipoDato', () => {
    expect(getConfigMeta('notificaciones.smtp_password').tipoDato).toBe('password');
    expect(getConfigMeta('notificaciones.email_remitente').tipoDato).toBe('email');
    expect(getConfigMeta('vacaciones.permitir_medio_dia').tipoDato).toBe('boolean');
    expect(getConfigMeta('seguridad.password_min_length').tipoDato).toBe('number');
    expect(getConfigMeta('app.nombre').tipoDato).toBe('string');
  });

  it('el catálogo cubre las claves esperadas', () => {
    expect(CONFIG_KEYS.has('notificaciones.smtp_host')).toBe(true);
    expect(CONFIG_KEYS.size).toBeGreaterThan(30);
  });
});
