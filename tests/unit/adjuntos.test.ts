import { describe, it, expect } from 'vitest';
import { validarAdjuntos, MAX_ARCHIVOS } from '@/lib/security/adjuntos';

// Helpers: construir base64 con firma valida
const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const PDF = b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('validarAdjuntos', () => {
  it('acepta null / vacío', () => {
    expect(validarAdjuntos(null)).toBeNull();
    expect(validarAdjuntos([])).toBeNull();
  });

  it('acepta PDF, PNG y JPG válidos', () => {
    expect(validarAdjuntos([{ nombre: 'a.pdf', data: PDF }])).toBeNull();
    expect(validarAdjuntos([{ nombre: 'b.png', data: PNG }])).toBeNull();
    expect(validarAdjuntos([{ nombre: 'c.jpg', data: JPG }])).toBeNull();
  });

  it('acepta data URL', () => {
    expect(validarAdjuntos([{ nombre: 'a.pdf', data: `data:application/pdf;base64,${PDF}` }])).toBeNull();
  });

  it('rechaza tipo no permitido aunque el nombre sea .pdf', () => {
    const txt = Buffer.from('hola mundo texto plano').toString('base64');
    expect(validarAdjuntos([{ nombre: 'malicioso.pdf', data: txt }])).toContain('tipo permitido');
  });

  it('rechaza base64 inválido', () => {
    expect(validarAdjuntos([{ nombre: 'x', data: '!!!no-base64!!!' }])).toContain('base64');
  });

  it('rechaza si supera la cantidad máxima', () => {
    const muchos = Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => ({ nombre: `f${i}.pdf`, data: PDF }));
    expect(validarAdjuntos(muchos)).toContain('máximo');
  });

  it('rechaza adjunto sin contenido', () => {
    expect(validarAdjuntos([{ nombre: 'x' }])).toContain('contenido');
  });
});
