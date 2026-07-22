/**
 * Utilidades de configuración seguras para el cliente (sin acceso a BD).
 */
import {
  CONFIG_KEYS,
  CONFIG_DEFAULT_VALUES,
  getConfigMeta,
  type ConfigMeta,
} from '@/lib/config/catalog';

export const CONFIG_PASSWORD_MASK = '********';
export const SMTP_PASSWORD_CLAVE = 'notificaciones.smtp_password';

export interface ConfiguracionFila {
  id?: number;
  clave: string;
  valor: string;
  descripcion?: string | null;
  categoria: string;
  tipoDato?: string | null;
  esPublico?: boolean | null;
  updatedAt?: string | null;
}

export interface ConfiguracionCliente extends ConfiguracionFila {
  id: number;
  persistido: boolean;
  tieneValor?: boolean;
}

function enmascararValorSensible(fila: ConfiguracionFila): ConfiguracionCliente {
  const id = fila.id ?? 0;
  const persistido = id > 0;

  if (fila.clave === SMTP_PASSWORD_CLAVE) {
    const tieneValor = persistido && Boolean(String(fila.valor ?? '').trim());
    return {
      ...fila,
      id,
      valor: '',
      categoria: fila.categoria,
      persistido,
      tieneValor,
    };
  }

  return {
    ...fila,
    id,
    valor: fila.valor ?? '',
    categoria: fila.categoria,
    persistido,
  };
}

/** Completa claves faltantes con defaults del catálogo para la respuesta al cliente. */
export function prepararConfiguracionParaCliente(
  filas: ConfiguracionFila[],
  options: { esAdmin: boolean }
): ConfiguracionCliente[] {
  const porClave = new Map(filas.map((f) => [f.clave, f]));
  const clavesVisibles = options.esAdmin
    ? [...CONFIG_KEYS]
    : [...CONFIG_KEYS].filter((clave) => getConfigMeta(clave).esPublico);

  return clavesVisibles.map((clave) => {
    const existente = porClave.get(clave);
    if (existente) {
      return enmascararValorSensible(existente);
    }

    const meta = getConfigMeta(clave);
    return enmascararValorSensible({
      id: 0,
      clave,
      valor: CONFIG_DEFAULT_VALUES[clave] ?? '',
      categoria: meta.categoria,
      tipoDato: meta.tipoDato,
      esPublico: meta.esPublico,
    });
  });
}

/** Omite actualización de contraseña SMTP si el usuario no la cambió. */
export function debeOmitirActualizacionSmtpPassword(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true;
  const texto = String(valor).trim();
  return texto === '' || texto === CONFIG_PASSWORD_MASK;
}

export function metaParaClave(clave: string): ConfigMeta {
  return getConfigMeta(clave);
}

export function resolverConfigItem(
  clave: string,
  configs: ConfiguracionCliente[]
): ConfiguracionCliente {
  const existente = configs.find((c) => c.clave === clave);
  if (existente) return existente;

  const meta = getConfigMeta(clave);
  return enmascararValorSensible({
    id: 0,
    clave,
    valor: CONFIG_DEFAULT_VALUES[clave] ?? '',
    categoria: meta.categoria,
    tipoDato: meta.tipoDato,
    esPublico: meta.esPublico,
  });
}
