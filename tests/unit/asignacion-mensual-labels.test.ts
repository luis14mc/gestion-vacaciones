import { describe, it, expect } from 'vitest';
import {
  formatDiasMensualesRegla,
  labelTramoAsignacionMensual,
} from '@/lib/domain/asignacion-mensual-labels';

describe('asignacion-mensual-labels', () => {
  it('labelTramoAsignacionMensual refleja año laboral en devengo', () => {
    expect(labelTramoAsignacionMensual(0)).toContain('1.er');
    expect(labelTramoAsignacionMensual(1)).toContain('2.º');
    expect(labelTramoAsignacionMensual(2)).toContain('3.er');
    expect(labelTramoAsignacionMensual(4)).toContain('5.º');
  });

  it('formatDiasMensualesRegla compacta decimales', () => {
    expect(formatDiasMensualesRegla(1)).toBe('1');
    expect(formatDiasMensualesRegla(1.25)).toBe('1.25');
    expect(formatDiasMensualesRegla(0.8333)).toBe('0.8333');
  });
});
