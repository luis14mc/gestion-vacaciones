import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  parseSafeDate,
} from '@/lib/utils/date-format';

describe('date-format', () => {
  it('parseSafeDate acepta YYYY-MM-DD', () => {
    const date = parseSafeDate('2024-01-03');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(3);
  });

  it('parseSafeDate acepta ISO con zona horaria', () => {
    const date = parseSafeDate('2024-01-03T00:00:00.000Z');
    expect(date).not.toBeNull();
    expect(formatDate(date)).toBe('03/01/2024');
  });

  it('parseSafeDate acepta timestamp PostgreSQL con espacio', () => {
    expect(formatDate('2024-01-03 00:00:00+00')).toBe('03/01/2024');
  });

  it('parseSafeDate acepta Date object', () => {
    expect(formatDate(new Date(2024, 0, 3))).toBe('03/01/2024');
  });

  it('formatDate devuelve em dash para null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formatDate devuelve em dash para string inválido', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formatDate acepta dd/MM/yyyy ya formateado', () => {
    expect(formatDate('03/01/2024')).toBe('03/01/2024');
  });

  it('formatDateTime incluye hora en zona Honduras', () => {
    const formatted = formatDateTime('2024-06-15T18:30:00.000Z');
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
});
