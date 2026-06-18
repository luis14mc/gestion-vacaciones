/**
 * Generador de contraseñas temporales seguras.
 * Garantiza al menos una mayúscula, una minúscula, un dígito y un
 * carácter especial, para satisfacer cualquier política razonable.
 */
import { randomInt } from 'crypto';

const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O ambiguas
const MINUS = 'abcdefghijkmnpqrstuvwxyz'; // sin l/o ambiguas
const DIGITS = '23456789'; // sin 0/1 ambiguos
const ESPECIAL = '!@#$%&*?';
const TODOS = MAYUS + MINUS + DIGITS + ESPECIAL;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/**
 * Genera una contraseña temporal de la longitud indicada (mínimo 12).
 */
export function generarPasswordTemporal(longitud = 12): string {
  const len = Math.max(12, longitud);
  const base = [pick(MAYUS), pick(MINUS), pick(DIGITS), pick(ESPECIAL)];
  while (base.length < len) {
    base.push(pick(TODOS));
  }
  // Mezcla Fisher-Yates para no dejar el patrón fijo al inicio
  for (let i = base.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}
