import { describe, it, expect } from 'vitest';
import {
  CONFIG_KEYS,
  CONFIG_DEFAULT_VALUES,
  clavesSinDefaultEnCatalogo,
  validarConfig,
} from '@/lib/config/catalog';
import {
  prepararConfiguracionParaCliente,
  debeOmitirActualizacionSmtpPassword,
  CONFIG_PASSWORD_MASK,
  SMTP_PASSWORD_CLAVE,
  asegurarConfiguracionesEnDb,
} from '@/lib/config/bootstrap-config';

describe('CONFIG_DEFAULT_VALUES', () => {
  it('tiene default para todas las claves del catálogo', () => {
    expect(clavesSinDefaultEnCatalogo()).toEqual([]);
    expect(Object.keys(CONFIG_DEFAULT_VALUES).length).toBeGreaterThanOrEqual(CONFIG_KEYS.size);
  });

  it('incluye valores institucionales clave', () => {
    expect(CONFIG_DEFAULT_VALUES['app.nombre']).toBe('Sistema de Vacaciones CNI');
    expect(CONFIG_DEFAULT_VALUES['vacaciones.dias_anticipacion']).toBe('2');
    expect(CONFIG_DEFAULT_VALUES['notificaciones.smtp_password']).toBe('');
  });
});

describe('prepararConfiguracionParaCliente', () => {
  it('completa claves faltantes con defaults cuando BD está vacía', () => {
    const data = prepararConfiguracionParaCliente([], { esAdmin: true });
    expect(data.length).toBe(CONFIG_KEYS.size);
    expect(data.find((c) => c.clave === 'app.nombre')?.valor).toBe('Sistema de Vacaciones CNI');
    expect(data.find((c) => c.clave === 'app.nombre')?.persistido).toBe(false);
  });

  it('no expone smtp_password en texto claro', () => {
    const data = prepararConfiguracionParaCliente(
      [
        {
          id: 1,
          clave: SMTP_PASSWORD_CLAVE,
          valor: 'secreto-real',
          categoria: 'notificaciones',
        },
      ],
      { esAdmin: true }
    );
    const smtp = data.find((c) => c.clave === SMTP_PASSWORD_CLAVE);
    expect(smtp?.valor).toBe('');
    expect(smtp?.tieneValor).toBe(true);
  });

  it('admin recibe todas las categorías visibles en catálogo', () => {
    const data = prepararConfiguracionParaCliente([], { esAdmin: true });
    const claves = new Set(data.map((d) => d.clave));
    expect(claves.has('app.nombre')).toBe(true);
    expect(claves.has('vacaciones.dias_anticipacion')).toBe(true);
    expect(claves.has('notificaciones.smtp_host')).toBe(true);
    expect(claves.has('departamentos.validar_conflictos')).toBe(true);
    expect(claves.has('seguridad.password_min_length')).toBe(true);
  });
});

describe('debeOmitirActualizacionSmtpPassword', () => {
  it('omite vacío y máscara', () => {
    expect(debeOmitirActualizacionSmtpPassword('')).toBe(true);
    expect(debeOmitirActualizacionSmtpPassword(CONFIG_PASSWORD_MASK)).toBe(true);
    expect(debeOmitirActualizacionSmtpPassword('nueva-clave')).toBe(false);
  });
});

describe('asegurarConfiguracionesEnDb', () => {
  it('inserta solo claves faltantes y es idempotente', async () => {
    const enBd = new Set<string>(['app.nombre']);
    const insertadas: string[] = [];

    const mockDb = {
      select: () => ({
        from: async () => [...enBd].map((clave) => ({ clave })),
      }),
      insert: () => ({
        values: async (row: { clave: string }) => {
          insertadas.push(row.clave);
          enBd.add(row.clave);
        },
      }),
    };

    const first = await asegurarConfiguracionesEnDb(mockDb as never);
    expect(first.insertadas).toBe(CONFIG_KEYS.size - 1);

    const second = await asegurarConfiguracionesEnDb(mockDb as never);
    expect(second.insertadas).toBe(0);
    expect(insertadas.length).toBe(CONFIG_KEYS.size - 1);
  });
});

describe('validarConfig con defaults del catálogo', () => {
  it('acepta valores por defecto de general y vacaciones', () => {
    expect(validarConfig('app.nombre', CONFIG_DEFAULT_VALUES['app.nombre'])).toBeNull();
    expect(validarConfig('vacaciones.dias_anticipacion', '2')).toBeNull();
    expect(validarConfig('departamentos.max_ausencias_simultaneas', '3')).toBeNull();
  });
});
