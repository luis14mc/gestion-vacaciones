/**
 * Política de contraseñas configurable (Configuración → Seguridad).
 * Valida una contraseña contra seguridad.password_min_length y los
 * requisitos de mayúscula/número/carácter especial. Antes estos ajustes
 * eran decorativos: la creación de usuarios no los aplicaba.
 */
import { obtenerConfigs, asBool, asNumber } from './service';

/**
 * @returns null si la contraseña cumple la política; un mensaje si no.
 */
export async function validarPasswordPolitica(password: string): Promise<string | null> {
  const cfg = await obtenerConfigs([
    'seguridad.password_min_length',
    'seguridad.password_requiere_mayuscula',
    'seguridad.password_requiere_numero',
    'seguridad.password_requiere_especial',
  ]);

  const minLen = asNumber(cfg['seguridad.password_min_length'], 8);
  const reqMayus = asBool(cfg['seguridad.password_requiere_mayuscula']);
  const reqNum = asBool(cfg['seguridad.password_requiere_numero']);
  const reqEsp = asBool(cfg['seguridad.password_requiere_especial']);

  if (password.length < minLen) {
    return `La contraseña debe tener al menos ${minLen} caracteres.`;
  }
  if (reqMayus && !/[A-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }
  if (reqNum && !/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  if (reqEsp && !/[^A-Za-z0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un carácter especial.';
  }
  return null;
}
