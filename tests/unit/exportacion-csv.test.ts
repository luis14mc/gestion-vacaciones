import { describe, expect, it } from 'vitest';
import { escapeCsvValue, filasACsv } from '@/lib/domain/exportacion/csv';
import { normalizarFormatoExportacion } from '@/services/exportacion.service';

describe('exportacion csv', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(escapeCsvValue('Ana "Pérez"')).toBe('"Ana ""Pérez"""');
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('linea\nnueva')).toBe('"linea\nnueva"');
  });

  it('neutraliza CSV injection con prefijo seguro', () => {
    expect(escapeCsvValue('=1+1')).toBe('"\'=1+1"');
    expect(escapeCsvValue('+1234')).toBe('"\'+1234"');
    expect(escapeCsvValue('-cmd')).toBe('"\'-cmd"');
    expect(escapeCsvValue('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });

  it('archivo vacío incluye encabezados y nota', () => {
    const csv = filasACsv([], [{ key: 'colaborador', header: 'Colaborador' }], { sinDatos: true });
    expect(csv.split('\n')[0]).toContain('Colaborador');
    expect(csv).toContain('Sin datos para los filtros seleccionados');
  });
});

describe('exportacion formatos', () => {
  it('csv devuelve csv', () => {
    expect(normalizarFormatoExportacion('csv')).toBe('csv');
  });

  it('excel se mapea a xlsx, no a csv', () => {
    expect(normalizarFormatoExportacion('excel')).toBe('xlsx');
    expect(normalizarFormatoExportacion('xlsx')).toBe('xlsx');
  });

  it('rechaza formatos desconocidos', () => {
    expect(normalizarFormatoExportacion('doc')).toBeNull();
  });
});
